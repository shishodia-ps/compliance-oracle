import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/invoices
 * Fetch invoice documents (documentType = INVOICE) with extracted data
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Get user's organization
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'User not associated with any organization' }, { status: 400 });
    }

    const where: any = {
      organizationId: membership.organizationId,
      documentType: 'INVOICE',
    };

    if (status) {
      where.status = status;
    }

    // Fetch documents with their associated Invoice records (if any)
    const documents = await prisma.document.findMany({
      where,
      select: {
        id: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        status: true,
        processingStage: true,
        processingError: true,
        createdAt: true,
        updatedAt: true,
        // Include extractionData
        extractionData: {
          select: {
            items: true,
            metadata: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Also fetch Invoice records separately for these documents
    const documentIds = documents.map(d => d.id);
    const invoiceRecords = await prisma.invoice.findMany({
      where: {
        documentId: { in: documentIds },
      },
    });

    // Create a map for quick lookup
    const invoiceMap = new Map(invoiceRecords.map(inv => [inv.documentId, inv]));

    // Map to invoice format with extracted fields
    const mappedInvoices = documents.map(doc => {
      const invoiceData = invoiceMap.get(doc.id);
      const extractionData = doc.extractionData;
      const items = extractionData?.items as any;
      const metadata = extractionData?.metadata as any;
      
      return {
        id: doc.id,
        fileName: doc.fileName,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        uploadedAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        status: mapDocumentStatus(doc.status, doc.processingStage),
        processingStage: doc.processingStage,
        error: doc.processingError,
        // Extracted fields (prioritize Invoice table, fallback to extractionData)
        vendorName: invoiceData?.vendorName || metadata?.vendor || items?.vendorName || null,
        employeeName: invoiceData?.employeeName || metadata?.employeeName || null,
        amount: invoiceData?.total || invoiceData?.amount || items?.totalAmount || items?.amount || null,
        currency: invoiceData?.currency || metadata?.currency || 'USD',
        category: invoiceData?.category || metadata?.category || null,
        invoiceDate: invoiceData?.invoiceDate?.toISOString() || metadata?.invoiceDate || metadata?.date || null,
        invoiceNumber: invoiceData?.invoiceNumber || metadata?.invoiceNumber || null,
      };
    });

    return NextResponse.json({ invoices: mappedInvoices });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

/**
 * Map document status to invoice ingestion status
 */
function mapDocumentStatus(status: string, stage: string | null): string {
  if (status === 'ERROR') return 'Failed';
  if (status === 'ANALYZED' || status === 'COMPLETED') return 'Ready';
  
  // Map processing stages
  if (stage === 'PARSING' || stage === 'EXTRACTING') return 'Parsing';
  if (stage === 'INDEXING') return 'Indexed';
  if (status === 'PROCESSING') return 'Processing';
  
  return 'Queued';
}
