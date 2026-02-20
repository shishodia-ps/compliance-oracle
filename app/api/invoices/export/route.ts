import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/invoices/export?format=excel|json
 * Export invoices with filters to Excel or JSON
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    
    // Get filters from query params
    const category = searchParams.get('category');
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');
    const vendor = searchParams.get('vendor');
    const employee = searchParams.get('employee');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Get user's organization
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    // Build where clause
    const where: any = {
      organizationId: membership.organizationId,
      documentType: 'INVOICE',
      status: 'ANALYZED', // Only export processed invoices
    };

    // Fetch documents with invoice data
    const documents = await prisma.document.findMany({
      where,
      select: {
        id: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        status: true,
        createdAt: true,
        extractionData: {
          select: {
            items: true,
            metadata: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get Invoice records
    const documentIds = documents.map(d => d.id);
    
    // Build filter conditions
    const invoiceWhere: any = {
      documentId: { in: documentIds },
    };
    if (category) invoiceWhere.category = category;
    if (vendor) invoiceWhere.vendorName = vendor;
    if (employee) invoiceWhere.employeeName = employee;
    if (minAmount) invoiceWhere.total = { gte: parseFloat(minAmount) };
    if (maxAmount) invoiceWhere.total = { ...(invoiceWhere.total || {}), lte: parseFloat(maxAmount) };
    if (dateFrom) invoiceWhere.invoiceDate = { gte: new Date(dateFrom) };
    if (dateTo) invoiceWhere.invoiceDate = { ...(invoiceWhere.invoiceDate || {}), lte: new Date(dateTo) };
    
    const invoiceRecords = await prisma.invoice.findMany({
      where: invoiceWhere,
    });

    // Create export data
    const exportData = invoiceRecords.map(inv => ({
      'Invoice ID': inv.id.slice(0, 8),
      'File Name': inv.fileName,
      'Vendor': inv.vendorName || '-',
      'Invoice Number': inv.invoiceNumber || '-',
      'Invoice Date': inv.invoiceDate?.toISOString().split('T')[0] || '-',
      'Due Date': inv.dueDate?.toISOString().split('T')[0] || '-',
      'Amount': inv.amount || '-',
      'Tax': inv.taxAmount || '-',
      'Total': inv.total || '-',
      'Currency': inv.currency,
      'Category': inv.category,
      'Employee': inv.employeeName || '-',
      'Status': inv.reimbursable,
      'Risk Score': inv.riskScore,
      'Uploaded': inv.createdAt.toISOString().split('T')[0],
    }));

    if (format === 'json') {
      // Return JSON
      return NextResponse.json({
        exportedAt: new Date().toISOString(),
        count: exportData.length,
        invoices: exportData,
      });
    } else {
      // Return simple CSV format
      const headers = Object.keys(exportData[0] || {});
      const csvRows = [
        headers.join(','),
        ...exportData.map(row => 
          headers.map(h => {
            const val = (row as any)[h];
            // Escape values with commas or quotes
            if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          }).join(',')
        ),
      ];
      
      const csv = csvRows.join('\n');
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="invoices_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    );
  }
}
