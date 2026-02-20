import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

/**
 * POST /api/documents/[id]/share
 * Create a shareable link for a document
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { expiresInDays = 7, canDownload = true } = await request.json();

    // Get user's organization
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    // Verify document exists and belongs to org
    const document = await prisma.document.findFirst({
      where: {
        id,
        organizationId: membership.organizationId,
      },
      select: { id: true, name: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Generate share token
    const shareToken = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Create share record
    const share = await prisma.documentShare.create({
      data: {
        documentId: id,
        createdById: session.user.id,
        shareToken,
        expiresAt,
        canDownload,
      },
    });

    // Generate share URL
    const shareUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/share/${shareToken}`;

    return NextResponse.json({
      shareUrl,
      shareToken,
      expiresAt,
      canDownload,
    });
  } catch (error) {
    console.error('Share creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create share link' },
      { status: 500 }
    );
  }
}
