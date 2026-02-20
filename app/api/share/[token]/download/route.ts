import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readFile } from 'fs/promises';
import path from 'path';

/**
 * GET /api/share/[token]/download
 * Download document via share token
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || token.length !== 64) {
      return NextResponse.json(
        { error: 'Invalid share token format' },
        { status: 400 }
      );
    }

    // Find share record
    const share = await prisma.documentShare.findUnique({
      where: { shareToken: token },
      include: {
        document: true,
      },
    });

    if (!share) {
      return NextResponse.json(
        { error: 'Share link not found' },
        { status: 404 }
      );
    }

    // Check if expired
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'Share link has expired' },
        { status: 410 }
      );
    }

    // Check download permission
    if (!share.canDownload) {
      return NextResponse.json(
        { error: 'Download not permitted for this share' },
        { status: 403 }
      );
    }

    // Verify file exists
    const filePath = share.document.storageKey;
    if (!filePath) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Read and return file
    const fileBuffer = await readFile(filePath);
    
    // Get filename
    const fileName = share.document.fileName || path.basename(filePath);
    const fileType = share.document.fileType || 'application/octet-stream';

    // Log download (increment access count to track total interactions)
    await prisma.documentShare.update({
      where: { id: share.id },
      data: {
        accessCount: { increment: 1 },
        lastAccessed: new Date(),
      },
    });

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': fileType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('Share download error:', error);
    
    if (error.code === 'ENOENT') {
      return NextResponse.json(
        { error: 'File not found on server' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    );
  }
}
