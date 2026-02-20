import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/citations
 * Get citations for review
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryId = searchParams.get('queryId');
    const status = searchParams.get('status');
    const matterId = searchParams.get('matterId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)));

    const where: any = {};

    if (queryId) {
      where.queryId = queryId;
    }

    if (status) {
      where.reviewStatus = status;
    }

    if (matterId) {
      where.document = {
        matterId,
      };
    }

    const [total, citations] = await Promise.all([
      prisma.citationRecord.count({ where }),
      prisma.citationRecord.findMany({
        where,
        include: {
          searchChunk: true,
          searchQuery: {
            select: {
              queryText: true,
              userId: true,
            },
          },
          reviewedBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      citations,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });

  } catch (error) {
    console.error('Error fetching citations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch citations' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/citations
 * Update citation review status
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { citationId, reviewStatus, comment } = body;

    if (!citationId || !reviewStatus) {
      return NextResponse.json(
        { error: 'citationId and reviewStatus are required' },
        { status: 400 }
      );
    }

    const validStatuses = ['pending', 'approved', 'rejected', 'commented'];
    if (!validStatuses.includes(reviewStatus)) {
      return NextResponse.json(
        { error: 'Invalid review status' },
        { status: 400 }
      );
    }

    const citation = await prisma.citationRecord.update({
      where: { id: citationId },
      data: {
        reviewStatus,
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        reviewComment: comment,
      },
    });

    // Create audit log
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CITATION_REVIEW',
        resourceType: 'citation',
        resourceId: citationId,
        details: { reviewStatus, comment },
      },
    }).catch(e => console.error('Audit log failed:', e));

    return NextResponse.json({ citation });

  } catch (error) {
    console.error('Error updating citation:', error);
    return NextResponse.json(
      { error: 'Failed to update citation' },
      { status: 500 }
    );
  }
}
