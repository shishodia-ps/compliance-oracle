import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/adverse-media/check/{id}/results
 * Get check results (poll endpoint)
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
      return NextResponse.json(
        { error: 'No organization' },
        { status: 400 }
      );
    }

    // Get check with entities
    const check = await prisma.adverseMediaCheck.findFirst({
      where: {
        id,
        organizationId: membership.organizationId,
      },
      include: {
        entities: {
          orderBy: {
            riskScore: 'desc',
          },
        },
      },
    });

    if (!check) {
      return NextResponse.json(
        { error: 'Check not found' },
        { status: 404 }
      );
    }

    // Format response
    const response = {
      checkId: check.id,
      status: check.status,
      inputType: check.inputType,
      createdAt: check.createdAt,
      completedAt: check.completedAt,
      overallRisk: calculateOverallRisk(check.entities),
      entityCount: check.entities.length,
      entities: check.entities.map(entity => ({
        id: entity.id,
        name: entity.name,
        normalizedName: entity.normalizedName,
        jurisdiction: entity.jurisdiction,
        industry: entity.industry,
        matchConfidence: entity.matchConfidence,
        matchReasoning: entity.matchReasoning,
        riskScore: entity.riskScore,
        riskCategory: entity.riskCategory,
        findings: entity.findings,
        counts: {
          sanctions: entity.sanctionsCount,
          regulatory: entity.regulatoryCount,
          news: entity.newsCount,
          web: entity.webCount,
        },
        sources: entity.sources,
        isMonitored: entity.isMonitored,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get check results error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch results' },
      { status: 500 }
    );
  }
}

/**
 * Calculate overall risk from entities
 */
function calculateOverallRisk(entities: any[]): { score: number; category: string } {
  if (entities.length === 0) {
    return { score: 0, category: 'Low' };
  }

  const avgScore = entities.reduce((sum, e) => sum + (e.riskScore || 0), 0) / entities.length;
  const maxScore = Math.max(...entities.map(e => e.riskScore || 0));
  
  // Weight max score more heavily
  const weightedScore = Math.round(maxScore * 0.6 + avgScore * 0.4);

  let category = 'Low';
  if (weightedScore >= 70) category = 'High';
  else if (weightedScore >= 40) category = 'Medium';

  return { score: weightedScore, category };
}
