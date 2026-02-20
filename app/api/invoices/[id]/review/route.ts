import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ReimbursementStatus } from '@prisma/client';

/**
 * POST /api/invoices/[id]/review
 * Review/approve invoice (manager action)
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
    const body = await request.json();
    const { decision, notes } = body;

    if (!decision || !['APPROVED', 'REJECTED', 'NEEDS_REVIEW'].includes(decision)) {
      return NextResponse.json(
        { error: 'Invalid decision. Must be APPROVED, REJECTED, or NEEDS_REVIEW' },
        { status: 400 }
      );
    }

    // Get user's organization
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'User not associated with any organization' }, { status: 400 });
    }

    // Verify invoice exists and belongs to org
    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
        organizationId: membership.organizationId,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Update invoice with manager decision
    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        reimbursable: decision as ReimbursementStatus,
        reimbursementReason: notes || null,
        reviewedById: session.user.id,
        reviewedAt: new Date(),
      },
      include: {
        reviewedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create audit log
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: membership.organizationId,
        action: 'INVOICE_REVIEW',
        resourceType: 'invoice',
        resourceId: invoice.id,
        details: { decision, notes, previousDecision: invoice.reimbursable },
      },
    }).catch(e => console.error('Audit log failed:', e));

    return NextResponse.json({
      success: true,
      invoice: updatedInvoice,
    });
  } catch (error) {
    console.error('Error reviewing invoice:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to review invoice' },
      { status: 500 }
    );
  }
}
