import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { documentQueue } from '@/lib/queue';
import { writeFile } from 'fs/promises';
import { mkdir } from 'fs/promises';
import path from 'path';
import { validateInvoiceUpload } from '@/lib/file-validation';
import { formatErrorResponse } from '@/lib/errors';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

interface UploadErrorDetails {
  fileType?: string;
  fileSize?: number;
  fileName?: string;
  maxSize?: number;
  allowedTypes?: string[];
  guidance?: string[];
}

/**
 * POST /api/invoices/upload
 * Upload invoice with enhanced validation and specific error guidance
 */
export async function POST(request: NextRequest) {
  let fileName: string | null = null;
  let fileSize: number = 0;
  
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { 
          error: 'Authentication required. Please log in to upload invoices.',
          code: 'UNAUTHORIZED' 
        },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const vendor = formData.get('vendor') as string | null;
    const amount = formData.get('amount') as string | null;

    if (!file) {
      return NextResponse.json(
        { 
          error: 'No file selected',
          code: 'MISSING_FILE',
          details: {
            guidance: [
              'Click "Choose File" or drag and drop an invoice',
              'Supported formats: PDF, PNG, JPG, JPEG',
              'Maximum file size: 20MB'
            ]
          }
        },
        { status: 400 }
      );
    }

    fileName = file.name;
    fileSize = file.size;

    // Get file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Enhanced validation with specific guidance
    try {
      await validateInvoiceUpload(file, buffer);
    } catch (validationError: any) {
      const details: UploadErrorDetails = {
        fileType: file.type,
        fileSize: file.size,
        fileName: file.name,
        maxSize: 20 * 1024 * 1024,
        allowedTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
      };

      // Parse validation error and provide specific guidance
      const errorMessage = validationError.message || '';
      
      if (errorMessage.includes('size')) {
        details.guidance = [
          `Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB, but maximum is 20MB`,
          'Try these solutions:',
          '• For PDFs: Use a PDF compression tool online',
          '• For images: Reduce resolution or use JPG instead of PNG',
          '• Scan at 150-200 DPI instead of 300+ DPI',
          '• Remove unnecessary pages if multi-page PDF'
        ];
      } else if (errorMessage.includes('format') || errorMessage.includes('type') || errorMessage.includes('extension')) {
        const extension = file.name.split('.').pop()?.toLowerCase();
        details.guidance = [
          `File format '.${extension}' is not supported`,
          'Supported formats:',
          '• PDF - Best for multi-page invoices (Recommended)',
          '• PNG - Good for single-page, high quality',
          '• JPG/JPEG - Good compression, smaller file size',
          '',
          'How to convert:',
          '• Use your phone\'s scan-to-PDF feature',
          '• Online converters: ilovepdf.com, convertio.co',
          '• Windows: Print to PDF',
          '• Mac: Export as PDF from Preview'
        ];
      } else if (errorMessage.includes('spoofing') || errorMessage.includes('content')) {
        details.guidance = [
          'File content does not match the file extension',
          'This can happen when:',
          '• A file is renamed with wrong extension (e.g., .exe renamed to .pdf)',
          '• The file is corrupted during download/transfer',
          '• The file was created with non-standard software',
          '',
          'Solutions:',
          '• Re-save the file using proper software (Adobe Reader, etc.)',
          '• Re-download the invoice from the original source',
          '• Print to PDF if viewing in a browser',
        ];
      } else if (errorMessage.includes('Executable') || errorMessage.includes('security')) {
        details.guidance = [
          'Security alert: Potential executable content detected',
          'For your safety, we only accept document and image files',
          '',
          'If this is a legitimate invoice:',
          '• Print the file to PDF',
          '• Take a screenshot and save as PNG/JPG',
          '• Contact your vendor for a proper PDF invoice'
        ];
      } else {
        details.guidance = [
          'File validation failed',
          'Please ensure your invoice is:',
          '• A valid PDF, PNG, or JPG file',
          '• Not password protected or encrypted',
          '• Not corrupted or incomplete',
          '',
          'Error details: ' + errorMessage
        ];
      }

      return NextResponse.json(
        { 
          error: 'Invoice upload failed',
          code: 'VALIDATION_ERROR',
          details
        },
        { status: 400 }
      );
    }

    // Get user's organization
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    });

    if (!membership) {
      return NextResponse.json(
        { 
          error: 'No organization membership found',
          code: 'NO_ORGANIZATION',
          details: {
            guidance: [
              'You need to be part of an organization to upload invoices',
              'Contact your administrator to be added to an organization'
            ]
          }
        },
        { status: 400 }
      );
    }

    // Create document record
    const document = await prisma.document.create({
      data: {
        name: file.name,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        storageKey: '', // Updated after saving
        status: 'UPLOADED',
        documentType: 'INVOICE',
        organizationId: membership.organizationId,
      },
    });

    // Ensure upload directory exists
    const orgDir = path.join(UPLOAD_DIR, membership.organizationId);
    await mkdir(orgDir, { recursive: true });

    // Save file
    const fileNameSafe = `${document.id}_${file.name}`;
    const filePath = path.join(orgDir, fileNameSafe);
    await writeFile(filePath, buffer);

    // Update document with storage key
    await prisma.document.update({
      where: { id: document.id },
      data: { storageKey: filePath },
    });

    // Add to processing queue
    let jobId: string | null = null;
    try {
      const job = await documentQueue.add('process-document', {
        documentId: document.id,
        filePath,
        fileName: file.name,
        organizationId: membership.organizationId,
        userId: session.user.id,
      });
      jobId = job.id.toString();

      await prisma.document.update({
        where: { id: document.id },
        data: {
          status: 'PROCESSING',
          processingJobId: jobId,
          processingStage: 'PARSING',
        },
      });
    } catch (queueError: any) {
      console.error('Queue error:', queueError);
      
      return NextResponse.json({
        success: true,
        invoiceId: document.id,
        warning: 'Invoice saved but AI processing is temporarily unavailable.',
        recovery: {
          action: 'Processing will be automatically retried',
          estimatedTime: 'Within 5 minutes',
          checkStatus: `/api/documents/${document.id}/progress`,
        }
      }, { status: 202 });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: membership.organizationId,
        action: 'INVOICE_UPLOADED',
        resourceType: 'invoice',
        resourceId: document.id,
        details: { 
          fileName: file.name, 
          fileSize: file.size, 
          fileType: file.type,
          jobId,
          vendor: vendor || null,
          expectedAmount: amount || null,
        },
      },
    });

    return NextResponse.json({
      success: true,
      invoiceId: document.id,
      jobId,
      message: 'Invoice uploaded and queued for AI processing',
      nextSteps: {
        processing: 'AI will extract vendor, amount, line items, and dates',
        estimatedTime: '30-60 seconds',
        checkStatus: `/api/documents/${document.id}/progress`,
        viewResults: `/app/invoices`,
      },
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
      }
    });

  } catch (error: any) {
    console.error('Invoice upload error:', error);
    
    const { error: message, code, statusCode, details } = formatErrorResponse(error);
    
    return NextResponse.json(
      { 
        error: message, 
        code, 
        details: {
          ...details,
          fileName,
          fileSize,
          timestamp: new Date().toISOString(),
        }
      },
      { status: statusCode }
    );
  }
}
