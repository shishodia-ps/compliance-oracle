import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { unlink } from 'fs/promises';

/**
 * DELETE /api/invoices/[id]
 * Delete an invoice (document with type INVOICE)
 */
export async function DELETE(
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

    // Try to delete the physical file (don't fail if file doesn't exist)
    try {
      if (document.storageKey) {
        await unlink(document.storageKey);
      }
    } catch (err) {
      console.log('File already deleted or not found:', err);
    }

    // Delete the document record (cascade will handle related records)
    await prisma.document.delete({
      where: { id },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: membership.organizationId,
        action: 'INVOICE_DELETED',
        resourceType: 'invoice',
        resourceId: id,
        details: { fileName: document.fileName },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Invoice deleted successfully',
    });

  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete invoice' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/invoices/[id]
 * Get a single invoice - tries Invoice table first, falls back to Document
 */
export async function GET(
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

    // First try to find Invoice record (for processed invoices)
    const invoiceRecord = await prisma.invoice.findFirst({
      where: {
        OR: [
          { id },
          { documentId: id },
        ],
        organizationId: membership.organizationId,
      },
      include: {
        document: true,
        lineItems: true,
        riskFlags: {
          include: {
            relatedInvoice: {
              select: {
                id: true,
                invoiceNumber: true,
                invoiceDate: true,
                total: true,
              },
            },
          },
        },
        vendor: true,
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (invoiceRecord) {
      // Map status to display format (same as list API)
      const docStatus = mapInvoiceStatus(invoiceRecord.status);
      
      // Return Invoice format
      return NextResponse.json({
        id: invoiceRecord.id,
        vendorName: invoiceRecord.vendorName,
        vendorId: invoiceRecord.vendorId,
        invoiceNumber: invoiceRecord.invoiceNumber,
        invoiceDate: invoiceRecord.invoiceDate?.toISOString() || null,
        dueDate: invoiceRecord.dueDate?.toISOString() || null,
        amount: invoiceRecord.amount,
        taxAmount: invoiceRecord.taxAmount,
        total: invoiceRecord.total,
        currency: invoiceRecord.currency,
        vatRate: invoiceRecord.vatRate,
        category: invoiceRecord.category,
        expenseType: invoiceRecord.expenseType,
        employeeName: invoiceRecord.employeeName,
        employeeId: invoiceRecord.employeeId,
        businessPurpose: invoiceRecord.businessPurpose,
        city: invoiceRecord.city,
        country: invoiceRecord.country,
        reimbursable: invoiceRecord.reimbursable,
        reimbursementReason: invoiceRecord.reimbursementReason,
        riskScore: invoiceRecord.riskScore,
        riskLevel: invoiceRecord.riskLevel,
        status: docStatus,
        processingError: invoiceRecord.processingError,
        fileName: invoiceRecord.document?.fileName || 'Unknown',
        fileType: invoiceRecord.document?.fileType || 'application/pdf',
        fileSize: invoiceRecord.document?.fileSize || 0,
        storageKey: invoiceRecord.document?.storageKey || '',
        createdAt: invoiceRecord.createdAt.toISOString(),
        updatedAt: invoiceRecord.updatedAt.toISOString(),
        document: invoiceRecord.document,
        uploadedBy: invoiceRecord.uploadedBy,
        reviewedBy: invoiceRecord.reviewedBy,
        reviewedAt: invoiceRecord.reviewedAt?.toISOString() || null,
        lineItems: invoiceRecord.lineItems || [],
        riskFlags: invoiceRecord.riskFlags || [],
        vendor: invoiceRecord.vendor,
      });
    }

    // Fall back to Document record (for newly uploaded invoices not yet processed)
    const document = await prisma.document.findFirst({
      where: {
        id,
        organizationId: membership.organizationId,
        documentType: 'INVOICE',
      },
      include: {
        extractionData: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Return Document format as fallback (simplified)
    return NextResponse.json({
      id: document.id,
      vendorName: null,
      vendorId: null,
      invoiceNumber: null,
      invoiceDate: null,
      dueDate: null,
      amount: null,
      taxAmount: null,
      total: null,
      currency: 'EUR',
      vatRate: null,
      category: 'OTHER',
      expenseType: null,
      employeeName: null,
      employeeId: null,
      businessPurpose: null,
      city: null,
      country: null,
      reimbursable: 'PENDING',
      reimbursementReason: null,
      riskScore: 0,
      riskLevel: 'LOW',
      status: document.status === 'ERROR' ? 'ERROR' : 'UPLOADED',
      processingError: document.processingError,
      fileName: document.fileName,
      fileType: document.fileType,
      fileSize: document.fileSize,
      storageKey: document.storageKey,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
      document: {
        id: document.id,
        name: document.name,
        fileName: document.fileName,
        fileType: document.fileType,
        fileSize: document.fileSize,
        storageKey: document.storageKey,
        status: document.status,
      },
      uploadedBy: { id: '', name: null, email: '' },
      reviewedBy: null,
      reviewedAt: null,
      lineItems: [],
      riskFlags: [],
      vendor: null,
    });

  } catch (error) {
    console.error('Get invoice error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    );
  }
}

/**
 * Map InvoiceStatus to display status
 */
function mapInvoiceStatus(status: string): string {
  if (status === 'ERROR') return 'Failed';
  if (status === 'ANALYZED') return 'Ready';
  if (status === 'PARSING') return 'Processing';
  if (status === 'UPLOADED') return 'Queued';
  return status;
}
