import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { mkdir, unlink } from 'fs/promises';
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

/**
 * POST /api/adverse-media/upload
 * Upload PDF/DOCX/XLSX/TXT document to extract company list
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'No organization' },
        { status: 400 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const enforcementMode = String(formData.get('enforcementMode') || '').toLowerCase() === 'true';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type (MIME + extension fallback)
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ];
    const allowedExts = ['pdf', 'docx', 'xlsx', 'txt'];
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';

    if (!allowedTypes.includes(file.type) && !allowedExts.includes(fileExt)) {
      return NextResponse.json(
        { error: 'Invalid file type. Supported: PDF, DOCX, XLSX, TXT' },
        { status: 400 }
      );
    }

    // Save file temporarily
    const uploadsDir = join(process.cwd(), 'uploads', 'adverse-media');
    await mkdir(uploadsDir, { recursive: true });

    const fileName = `${Date.now()}_${file.name}`;
    const filePath = join(uploadsDir, fileName);

    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    // Create check record
    const check = await prisma.adverseMediaCheck.create({
      data: {
        userId: session.user.id,
        organizationId: membership.organizationId,
        inputType: 'document',
        rawInput: file.name,
        status: 'pending',
      },
    });

    try {
      // Queue document extraction and entity detection
      await redis.lpush(
        'adverse-media:document-queue',
        JSON.stringify({
          checkId: check.id,
          filePath,
          fileName: file.name,
          fileType: file.type,
          fileExt,
          options: {
            enforcementMode,
          },
        })
      );

      await redis.publish('adverse-media:new-document', check.id);
    } catch (queueError) {
      await prisma.adverseMediaCheck.update({
        where: { id: check.id },
        data: {
          status: 'error',
          results: {
            error: 'Failed to queue uploaded document for processing',
          },
        },
      });
      await unlink(filePath).catch(() => undefined);
      throw queueError;
    }

    return NextResponse.json({
      checkId: check.id,
      status: 'pending',
      message: 'Document uploaded. Extracting companies...',
      estimatedTime: '30-60s',
      resultsUrl: `/api/adverse-media/check/${check.id}/results`,
    });
  } catch (error) {
    console.error('Adverse media upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    );
  }
}
