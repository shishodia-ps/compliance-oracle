import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { analyzeInvoiceFull } from '@/lib/invoice-ai';

/**
 * POST /api/invoices/[id]/analyze
 * Trigger AI analysis of invoice
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
      return NextResponse.json({ error: 'User not associated with any organization' }, { status: 400 });
    }

    // Get invoice with document content
    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
        organizationId: membership.organizationId,
      },
      include: {
        document: {
          include: {
            extractionData: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Update status to processing
    await prisma.invoice.update({
      where: { id },
      data: { status: 'PARSING' },
    });

    // Get text content
    const text = invoice.document?.extractionData?.content || '';
    
    if (!text) {
      // Trigger document processing first
      if (invoice.document) {
        await prisma.document.update({
          where: { id: invoice.document.id },
          data: { status: 'UPLOADED' },
        });
      }
      return NextResponse.json({ 
        success: false, 
        message: 'Document not yet processed. Queued for processing.' 
      });
    }

    // Run full AI analysis
    const analysis = await analyzeInvoiceFull(text, id, membership.organizationId);

    // Update invoice with extracted data
    await prisma.invoice.update({
      where: { id },
      data: {
        vendorName: analysis.extracted.vendorName,
        invoiceNumber: analysis.extracted.invoiceNumber,
        invoiceDate: analysis.extracted.invoiceDate,
        dueDate: analysis.extracted.dueDate,
        amount: analysis.extracted.subtotal,
        taxAmount: analysis.extracted.taxAmount,
        total: analysis.extracted.total,
        currency: analysis.extracted.currency,
        category: analysis.extracted.category,
        employeeName: analysis.extracted.employeeName,
        employeeId: analysis.extracted.employeeId,
        businessPurpose: analysis.extracted.businessPurpose,
        city: analysis.extracted.city,
        country: analysis.extracted.country,
        reimbursable: analysis.reimbursable,
        reimbursementReason: analysis.decisionReason,
        riskScore: analysis.riskScore,
        riskLevel: analysis.riskLevel,
        status: 'ANALYZED',
        duplicateOfId: analysis.duplicateOf,
      },
    });

    // Create line items
    if (analysis.extracted.lineItems.length > 0) {
      await prisma.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
      await prisma.invoiceLineItem.createMany({
        data: analysis.extracted.lineItems.map(item => ({
          invoiceId: id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          category: analysis.extracted.category,
        })),
      });
    }

    // Create risk flags
    await prisma.invoiceRiskFlag.deleteMany({ where: { invoiceId: id } });
    if (analysis.riskFlags.length > 0) {
      await prisma.invoiceRiskFlag.createMany({
        data: analysis.riskFlags.map(flag => ({
          invoiceId: id,
          flagType: flag.type,
          severity: flag.severity,
          title: flag.title,
          description: flag.description,
          relatedInvoiceId: analysis.duplicateOf,
        })),
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: membership.organizationId,
        action: 'INVOICE_ANALYZED',
        resourceType: 'invoice',
        resourceId: id,
        details: { 
          riskScore: analysis.riskScore,
          category: analysis.extracted.category,
          reimbursable: analysis.reimbursable,
        },
      },
    });

    return NextResponse.json({
      success: true,
      analysis: {
        riskScore: analysis.riskScore,
        riskLevel: analysis.riskLevel,
        reimbursable: analysis.reimbursable,
        decisionReason: analysis.decisionReason,
        category: analysis.extracted.category,
        vendorName: analysis.extracted.vendorName,
        total: analysis.extracted.total,
        riskFlags: analysis.riskFlags.length,
      },
    });
  } catch (error) {
    console.error('Error analyzing invoice:', error);
    
    // Update status to error
    await prisma.invoice.update({
      where: { id: params.id },
      data: { 
        status: 'ERROR',
        processingError: error instanceof Error ? error.message : 'Analysis failed',
      },
    }).catch(() => {});

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze invoice' },
      { status: 500 }
    );
  }
}
