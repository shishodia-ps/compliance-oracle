import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/documents
 * Fetch documents with real counts from database
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const matterId = searchParams.get('matterId');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)));

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
      documentType: { not: 'INVOICE' }, // Exclude invoices - they have their own module
    };

    if (matterId) {
      where.matterId = matterId;
    }

    if (status) {
      where.status = status;
    }

    const [total, documents] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        include: {
          matter: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              risks: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      documents,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/documents
 * Create document record (used by upload or external systems)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, fileName, fileType, fileSize, matterId, documentType = 'OTHER' } = body;

    if (!name || !fileName || !fileSize) {
      return NextResponse.json(
        { error: 'Missing required fields', received: { name, fileName, fileSize } },
        { status: 400 }
      );
    }

    // Get user's organization
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'User not associated with any organization' },
        { status: 400 }
      );
    }

    const document = await prisma.document.create({
      data: {
        name,
        fileName,
        fileType: fileType || 'application/octet-stream',
        fileSize,
        storageKey: `uploads/${fileName}`,
        status: 'UPLOADED',
        documentType,
        organizationId: membership.organizationId,
        matterId: matterId || null,
      },
    });
    
    console.log('Document created:', document.id, 'for matter:', matterId);

    // Auto-create invoice record if document type is INVOICE
    if (documentType === 'INVOICE') {
      await prisma.invoice.create({
        data: {
          documentId: document.id,
          organizationId: membership.organizationId,
          uploadedById: session.user.id,
          fileName,
          fileType,
          fileSize,
          storageKey: `uploads/${fileName}`,
          status: 'UPLOADED',
        },
      });
    }

    // Create audit log
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: membership.organizationId,
        action: 'DOCUMENT_CREATE',
        resourceType: 'document',
        resourceId: document.id,
        details: { fileName, fileSize, documentType },
      },
    }).catch(e => console.error('Audit log failed:', e));

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error('Error creating document:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create document' },
      { status: 500 }
    );
  }
}
