import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { documentQueue } from '@/lib/queue';

/**
 * POST /api/invoices/[id]/retry
 * Retry processing a failed invoice
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

    // Get user's organization
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    // Get the invoice document
    const document = await prisma.document.findFirst({
      where: {
        id,
        organizationId: membership.organizationId,
        documentType: 'INVOICE',
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Re-queue for processing
    const job = await documentQueue.add('process-document', {
      documentId: id,
      filePath: document.storageKey,
      fileName: document.fileName,
      organizationId: membership.organizationId,
      userId: session.user.id,
    });

    // Update document status
    await prisma.document.update({
      where: { id },
      data: {
        status: 'PROCESSING',
        processingStage: 'PARSING',
        processingError: null,
        processingJobId: job.id.toString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Invoice re-queued for processing',
      jobId: job.id,
    });

  } catch (error) {
    console.error('Retry error:', error);
    return NextResponse.json(
      { error: 'Failed to retry processing' },
      { status: 500 }
    );
  }
}
