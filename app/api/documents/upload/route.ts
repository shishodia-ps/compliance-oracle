import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { documentQueue } from '@/lib/queue';
import { writeFile } from 'fs/promises';
import { mkdir } from 'fs/promises';
import path from 'path';
import { validateDocumentUpload } from '@/lib/file-validation';
import { validateFileMime } from './mime-validation';
import { formatErrorResponse } from '@/lib/errors';
import { initializeServer } from '@/lib/init';

// Initialize server on first request
initializeServer();

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

/**
 * POST /api/documents/upload
 * Upload file with enhanced validation and error handling
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentId = formData.get('documentId') as string;

    // Validation checks with specific error messages
    if (!file) {
      return NextResponse.json(
        { 
          error: 'No file provided', 
          code: 'MISSING_FILE',
          details: { field: 'file' }
        },
        { status: 400 }
      );
    }

    if (!documentId) {
      return NextResponse.json(
        { 
          error: 'Document ID required', 
          code: 'MISSING_DOCUMENT_ID',
          details: { field: 'documentId' }
        },
        { status: 400 }
      );
    }

    // Get file buffer for validation
    const buffer = Buffer.from(await file.arrayBuffer());

    // Enhanced file validation
    try {
      await validateDocumentUpload(file, buffer);
    } catch (validationError: any) {
      return NextResponse.json(
        { 
          error: validationError.message,
          code: validationError.code || 'VALIDATION_ERROR',
          details: validationError.details,
        },
        { status: 400 }
      );
    }

    // MIME type validation - verify content matches declared type
    // Skip for Word docs as browsers may report inconsistent MIME types
    const isWordDoc = file.name.endsWith('.docx') || file.name.endsWith('.doc');
    if (!isWordDoc) {
      const mimeValidation = await validateFileMime(file);
      if (!mimeValidation.valid) {
        return NextResponse.json(
          { 
            error: mimeValidation.error || 'MIME type validation failed',
            code: 'MIME_TYPE_MISMATCH',
            details: { 
              declaredType: file.type, 
              actualType: mimeValidation.actualMime 
            },
          },
          { status: 400 }
        );
      }
    }

    // Get document record
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { organization: true },
    });

    if (!document) {
      return NextResponse.json(
        { 
          error: `Document with ID '${documentId}' not found`,
          code: 'NOT_FOUND',
          details: { resource: 'Document', id: documentId }
        },
        { status: 404 }
      );
    }

    // Check organization membership
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: document.organizationId,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { 
          error: 'Access denied to this document',
          code: 'FORBIDDEN',
          details: { documentId, organizationId: document.organizationId }
        },
        { status: 403 }
      );
    }

    // Ensure upload directory exists
    const orgDir = path.join(UPLOAD_DIR, document.organizationId);
    await mkdir(orgDir, { recursive: true });

    // Save file
    const filePath = path.join(orgDir, `${documentId}_${file.name}`);
    await writeFile(filePath, buffer);

    // Update document status
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'UPLOADED',
        storageKey: filePath,
        fileSize: file.size,
        fileType: file.type,
      },
    });

    // Try to add to queue
    let jobId: string | null = null;
    try {
      const job = await documentQueue.add('process-document', {
        documentId,
        filePath,
        fileName: file.name,
        organizationId: document.organizationId,
        userId: session.user.id,
      });
      jobId = job.id.toString();

      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'PROCESSING',
          processingJobId: jobId,
        },
      });
    } catch (queueError: any) {
      console.error('Queue error:', queueError);
      
      // Return partial success with warning
      return NextResponse.json({
        success: true,
        documentId,
        warning: 'File uploaded successfully, but processing queue is temporarily unavailable.',
        recovery: {
          action: 'RETRY_PROCESSING',
          endpoint: `/api/documents/${documentId}/retry`,
          message: 'You can retry processing later from the document page.',
        }
      }, { status: 202 }); // Accepted but processing pending
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: document.organizationId,
        action: 'DOCUMENT_UPLOADED',
        resourceType: 'document',
        resourceId: documentId,
        details: { 
          fileName: file.name, 
          fileSize: file.size, 
          fileType: file.type,
          jobId,
          validated: true,
        },
      },
    });

    return NextResponse.json({
      success: true,
      documentId,
      jobId,
      message: 'File uploaded and queued for processing',
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        uploadedAt: new Date().toISOString(),
      }
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    
    const { error: message, code, statusCode, details } = formatErrorResponse(error);
    
    return NextResponse.json(
      { error: message, code, details },
      { status: statusCode }
    );
  }
}
