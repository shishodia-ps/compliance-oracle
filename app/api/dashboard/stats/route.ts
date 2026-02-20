import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/dashboard/stats
 * Fetch real dashboard statistics from database
 */
export async function GET(request: NextRequest) {
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
      return NextResponse.json({ error: 'User not associated with any organization' }, { status: 400 });
    }

    const orgId = membership.organizationId;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Consolidated queries: 3 aggregations + 2 findMany instead of 10 separate counts
    const [
      docAgg,
      riskAgg,
      matterAgg,
      recentDocuments,
      recentActivity,
    ] = await Promise.all([
      // Document counts + trends in a single query
      prisma.$queryRaw<any[]>`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'ANALYZED')::int AS analyzed,
          COUNT(*) FILTER (WHERE created_at >= ${thirtyDaysAgo})::int AS last_30,
          COUNT(*) FILTER (WHERE created_at >= ${sixtyDaysAgo} AND created_at < ${thirtyDaysAgo})::int AS prev_30
        FROM documents
        WHERE organization_id = ${orgId}
      `,

      // Risk counts in a single query
      prisma.$queryRaw<any[]>`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE r.status = 'OPEN')::int AS open
        FROM risks r
        JOIN documents d ON r.document_id = d.id
        WHERE d.organization_id = ${orgId}
      `,

      // Matter counts in a single query
      prisma.$queryRaw<any[]>`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active
        FROM matters
        WHERE organization_id = ${orgId}
      `,

      // Recent documents
      prisma.document.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          matter: {
            select: { id: true, name: true },
          },
          _count: {
            select: { risks: true },
          },
        },
      }),

      // Recent activity
      prisma.auditLog.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
    ]);

    const docs = docAgg[0] || { total: 0, analyzed: 0, last_30: 0, prev_30: 0 };
    const risks = riskAgg[0] || { total: 0, open: 0 };
    const matters = matterAgg[0] || { total: 0, active: 0 };

    // Calculate percentage changes
    const documentChange = docs.prev_30 === 0
      ? 100
      : Math.round(((docs.last_30 - docs.prev_30) / docs.prev_30) * 100);

    return NextResponse.json({
      stats: {
        documents: {
          total: docs.total,
          analyzed: docs.analyzed,
          change: documentChange,
          trend: documentChange >= 0 ? 'up' : 'down',
        },
        risks: {
          total: risks.total,
          open: risks.open,
        },
        matters: {
          total: matters.total,
          active: matters.active,
        },
      },
      recentDocuments,
      recentActivity,
    }, {
      headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' },
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
