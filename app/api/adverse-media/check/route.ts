import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface CompanyInput {
  name: string;
  country?: string;
  industry?: string;
  registrationNum?: string;
}

interface CheckRequest {
  companies: CompanyInput[];
  options?: {
    depth?: 'quick' | 'standard' | 'deep';
    sources?: string[];
    maxAge?: string;
    enforcementMode?: boolean;
  };
}

/**
 * POST /api/adverse-media/check
 * Initiate adverse media check for one or more companies
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CheckRequest = await request.json();
    const { companies, options = {} } = body;

    if (!companies || companies.length === 0) {
      return NextResponse.json(
        { error: 'At least one company is required' },
        { status: 400 }
      );
    }

    // Limit bulk checks
    const bulkLimit = parseInt(process.env.ADVERSE_MEDIA_BULK_LIMIT || '100');
    if (companies.length > bulkLimit) {
      return NextResponse.json(
        { error: `Maximum ${bulkLimit} companies per check` },
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

    // Determine input type
    const inputType = companies.length === 1 ? 'single' : 'bulk';
    const rawInput = companies.map(c => c.name).join(', ');

    // Create check + entities atomically in DB.
    const check = await prisma.$transaction(async tx => {
      const createdCheck = await tx.adverseMediaCheck.create({
        data: {
          userId: session.user.id,
          organizationId: membership.organizationId,
          inputType,
          rawInput,
          status: 'pending',
        },
      });

      await tx.adverseMediaEntity.createMany({
        data: companies.map(company => ({
          checkId: createdCheck.id,
          name: company.name,
          normalizedName: normalizeCompanyName(company.name),
          jurisdiction: company.country || null,
          industry: company.industry || null,
          registrationNum: company.registrationNum || null,
          riskScore: 0,
          riskCategory: 'Low',
          matchConfidence: 0,
          findings: [],
        })),
      });

      return createdCheck;
    });

    // Queue the check for processing
    try {
      await redis.lpush(
        'adverse-media:queue',
        JSON.stringify({
          checkId: check.id,
          companies,
          options: {
            depth: options.depth || 'standard',
            sources: options.sources || ['sanctions', 'news', 'web'],
            maxAge: options.maxAge || '2y',
            enforcementMode: !!options.enforcementMode,
          },
        })
      );

      // Publish event for worker
      await redis.publish('adverse-media:new-check', check.id);
    } catch (queueError) {
      await prisma.adverseMediaCheck.update({
        where: { id: check.id },
        data: {
          status: 'error',
          results: {
            error: 'Failed to queue check for processing',
          },
        },
      });
      throw queueError;
    }

    return NextResponse.json({
      checkId: check.id,
      status: 'pending',
      entityCount: companies.length,
      estimatedTime: estimateTime(
        companies.length,
        options.depth || 'standard',
        !!options.enforcementMode
      ),
      resultsUrl: `/api/adverse-media/check/${check.id}/results`,
    });
  } catch (error) {
    console.error('Adverse media check error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate check' },
      { status: 500 }
    );
  }
}

/**
 * Normalize company name for deduplication and search
 */
function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(ltd|limited|inc|incorporated|llc|corp|corporation|plc|gmbh|sa|bv|nv)\b/gi, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Estimate processing time based on count and depth
 */
function estimateTime(count: number, depth: string, enforcementMode = false): string {
  const secondsPerCompany = {
    quick: 3,
    standard: 15,
    deep: 60,
  };
  const modeMultiplier = enforcementMode ? 1.35 : 1;
  const totalSeconds = Math.ceil(count * secondsPerCompany[depth] * modeMultiplier);
  
  if (totalSeconds < 60) return `${totalSeconds}s`;
  if (totalSeconds < 120) return '1-2 min';
  return `${Math.ceil(totalSeconds / 60)} min`;
}
