import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
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
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    // Get all documents for the organization with their summaries
    const documents = await prisma.document.findMany({
      where: {
        organizationId: membership.organizationId,
      },
      select: {
        id: true,
        name: true,
        status: true,
        processingError: true,
        createdAt: true,
        summary: {
          select: {
            id: true,
          },
        },
      },
    });

    // Get all invoices for the organization
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId: membership.organizationId,
      },
      select: {
        id: true,
        vendorName: true,
        total: true,
        amount: true,
        status: true,
        createdAt: true,
      },
    });

    // Calculate document compliance
    // A document is compliant if it has a summary and no processing error
    const compliantDocuments = documents.filter(
      (doc) => doc.summary && !doc.processingError
    );
    const documentCompliance = documents.length > 0
      ? Math.round((compliantDocuments.length / documents.length) * 100)
      : 100;

    // Calculate invoice compliance
    // An invoice is compliant if it has vendor name and amount extracted
    const compliantInvoices = invoices.filter(
      (inv) => inv.vendorName && (inv.total !== null || inv.amount !== null)
    );
    const invoiceCompliance = invoices.length > 0
      ? Math.round((compliantInvoices.length / invoices.length) * 100)
      : 100;

    // Calculate retention compliance
    // Documents older than 7 years need attention
    const now = new Date();
    const sevenYearsAgo = new Date(now.getFullYear() - 7, now.getMonth(), now.getDate());
    const expiringDocuments = documents.filter(
      (doc) => new Date(doc.createdAt) < sevenYearsAgo
    );
    const retentionCompliance = documents.length > 0
      ? Math.round(((documents.length - expiringDocuments.length) / documents.length) * 100)
      : 100;

    // Calculate overall compliance
    const overallCompliance = Math.round(
      (documentCompliance + invoiceCompliance + retentionCompliance) / 3
    );

    // Generate recent compliance checks from documents
    const recentChecks = documents
      .slice(0, 10)
      .map((doc) => {
        const issues: string[] = [];
        if (!doc.summary) issues.push('Missing summary');
        if (doc.processingError) issues.push('Processing error');

        return {
          id: doc.id,
          documentName: doc.name,
          status: (doc.summary && !doc.processingError ? 'pass' : 'fail') as 'pass' | 'fail',
          date: doc.createdAt.toISOString(),
          issues,
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      documentCompliance,
      invoiceCompliance,
      retentionCompliance,
      overallCompliance,
      stats: {
        totalDocuments: documents.length,
        compliantDocuments: compliantDocuments.length,
        totalInvoices: invoices.length,
        compliantInvoices: compliantInvoices.length,
        expiringDocuments: expiringDocuments.length,
        missingMetadata: documents.length - compliantDocuments.length,
      },
      recentChecks,
    });
  } catch (error) {
    console.error('Error fetching compliance data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch compliance data' },
      { status: 500 }
    );
  }
}
