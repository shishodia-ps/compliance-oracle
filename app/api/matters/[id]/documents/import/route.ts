import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
    const { documentId } = await request.json();

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID required' },
        { status: 400 }
      );
    }

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

    // Verify matter belongs to organization
    const matter = await prisma.matter.findFirst({
      where: {
        id,
        organizationId: membership.organizationId,
      },
    });

    if (!matter) {
      return NextResponse.json({ error: 'Matter not found' }, { status: 404 });
    }

    // Verify document belongs to organization and is not already in this matter
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        organizationId: membership.organizationId,
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (document.matterId === id) {
      return NextResponse.json(
        { error: 'Document is already in this matter' },
        { status: 400 }
      );
    }

    // Update document to link to this matter
    await prisma.document.update({
      where: { id: documentId },
      data: { matterId: id },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: membership.organizationId,
        action: 'DOCUMENT_IMPORTED_TO_MATTER',
        resourceType: 'document',
        resourceId: documentId,
        details: { matterId: id },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error importing document:', error);
    return NextResponse.json(
      { error: 'Failed to import document' },
      { status: 500 }
    );
  }
}
