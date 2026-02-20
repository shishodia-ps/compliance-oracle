import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/share/[token]
 * Validate share token and return document info
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
        document: {
          select: {
            id: true,
            name: true,
            fileType: true,
            fileName: true,
          },
        },
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

    // Increment access count
    await prisma.documentShare.update({
      where: { id: share.id },
      data: {
        accessCount: { increment: 1 },
        lastAccessed: new Date(),
      },
    });

    return NextResponse.json({
      document: share.document,
      canDownload: share.canDownload,
      expiresAt: share.expiresAt,
    });
  } catch (error) {
    console.error('Share validation error:', error);
    return NextResponse.json(
      { error: 'Failed to validate share link' },
      { status: 500 }
    );
  }
}
