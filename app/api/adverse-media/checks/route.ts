import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/adverse-media/checks
 * List user's adverse media checks with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(50, parseInt(searchParams.get('limit') || '20', 10)));
    const status = searchParams.get('status');

    // Get user's organization
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'No organization' },
        { status: 400 }
      );
    }

    // Build where clause
    const where: any = {
      organizationId: membership.organizationId,
    };

    if (status) {
      where.status = status;
    }

    // Get checks with pagination
    const [total, checks] = await Promise.all([
      prisma.adverseMediaCheck.count({ where }),
      prisma.adverseMediaCheck.findMany({
        where,
        include: {
          entities: {
            select: {
              id: true,
              name: true,
              riskScore: true,
              riskCategory: true,
            },
            take: 5, // Preview first 5 entities
          },
          _count: {
            select: {
              entities: true,
            },
          },
          user: {
            select: {
              name: true,
              email: true,
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

    const checkIds = checks.map(check => check.id);
    const highRiskCounts = checkIds.length > 0
      ? await prisma.adverseMediaEntity.groupBy({
          by: ['checkId'],
          where: {
            checkId: { in: checkIds },
            riskCategory: 'High',
          },
          _count: {
            _all: true,
          },
        })
      : [];
    const highRiskCountByCheckId = new Map(
      highRiskCounts.map(item => [item.checkId, item._count._all])
    );

    // Format response
    const response = {
      checks: checks.map(check => ({
        id: check.id,
        status: check.status,
        inputType: check.inputType,
        rawInput: check.rawInput.slice(0, 100) + (check.rawInput.length > 100 ? '...' : ''),
        entityCount: check._count.entities,
        highRiskCount: highRiskCountByCheckId.get(check.id) || 0,
        createdAt: check.createdAt,
        completedAt: check.completedAt,
        createdBy: check.user.name || check.user.email,
        preview: check.entities.map(e => ({
          name: e.name,
          riskCategory: e.riskCategory,
        })),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('List checks error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch checks' },
      { status: 500 }
    );
  }
}
