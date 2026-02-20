import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const PIPELINE_WORKER_URL = process.env.PIPELINE_WORKER_URL || 'http://localhost:8001';

/**
 * Verify user has access to the matter
 */
async function verifyMatterAccess(userId: string, matterId: string) {
  return prisma.organizationMember.findFirst({
    where: {
      userId,
      organization: {
        matters: {
          some: { id: matterId }
        }
      }
    },
    select: { role: true, organizationId: true }
  });
}

/**
 * POST /api/pipeline/query
 * Query the legal AI pipeline
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orgId, matterId, question, topK = 5 } = body;

    if (!orgId || !matterId || !question) {
      return NextResponse.json(
        { error: 'orgId, matterId, and question are required' },
        { status: 400 }
      );
    }

    // Verify matter access
    const membership = await verifyMatterAccess(session.user.id, matterId);
    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied to this matter' },
        { status: 403 }
      );
    }

    // Call pipeline worker
    const workerResponse = await fetch(`${PIPELINE_WORKER_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgId,
        matterId,
        question,
        topK
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!workerResponse.ok) {
      const errorText = await workerResponse.text();
      
      if (workerResponse.status === 404) {
        return NextResponse.json(
          { error: 'No index found for this matter. Please run ingest first.' },
          { status: 404 }
        );
      }
      
      throw new Error(`Pipeline worker error: ${errorText}`);
    }

    const result = await workerResponse.json();

    // Create audit log (non-blocking)
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: membership.organizationId,
        action: 'PIPELINE_QUERY',
        resourceType: 'pipeline_query',
        details: {
          matterId,
          question: question.substring(0, 200), // Truncate for audit log
          mock: result.mock
        }
      }
    }).catch(e => console.error('Audit log failed:', e));

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error querying pipeline:', error);
    return NextResponse.json(
      { error: 'Failed to query pipeline' },
      { status: 500 }
    );
  }
}
