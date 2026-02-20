import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, documentId } = await params;

    // Check organization membership
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 400 }
      );
    }

    // Verify document belongs to this matter
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        matterId: id,
        organizationId: membership.organizationId,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found in matter' },
        { status: 404 }
      );
    }

    // Remove document from matter (set matterId to null)
    await prisma.document.update({
      where: { id: documentId },
      data: { matterId: null },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: membership.organizationId,
        action: 'DOCUMENT_REMOVED_FROM_MATTER',
        resourceType: 'document',
        resourceId: documentId,
        details: { matterId: id },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing document from matter:', error);
    return NextResponse.json(
      { error: 'Failed to remove document' },
      { status: 500 }
    );
  }
}
