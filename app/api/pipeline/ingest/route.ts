import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const PIPELINE_WORKER_URL = process.env.PIPELINE_WORKER_URL || 'http://localhost:8001';

/**
 * Verify user has access to the matter
 */
async function verifyMatterAccess(userId: string, matterId: string) {
  const membership = await prisma.organizationMember.findFirst({
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
  
  return membership;
}

/**
 * POST /api/pipeline/ingest
 * Start a new pipeline ingest job
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orgId, matterId, documentIds, options = {} } = body;

    if (!orgId || !matterId) {
      return NextResponse.json(
        { error: 'orgId and matterId are required' },
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

    // Only ADMIN and MANAGER can start ingest
    if (!['ADMIN', 'MANAGER'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Call pipeline worker
    const workerResponse = await fetch(`${PIPELINE_WORKER_URL}/jobs/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgId,
        matterId,
        documentIds,
        options: {
          maxConcurrent: options.maxConcurrent || 4,
          model: options.model || 'gpt-4o-mini',
          retryAttempts: options.retryAttempts || 3,
        }
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!workerResponse.ok) {
      const error = await workerResponse.text();
      throw new Error(`Pipeline worker error: ${error}`);
    }

    const { jobId } = await workerResponse.json();

    // Create pipeline job record in database
    const pipelineJob = await prisma.pipelineJob.create({
      data: {
        id: jobId,
        orgId,
        matterId,
        status: 'PENDING',
        step: 'IDLE',
        progress: 0,
        documentIds: documentIds || [],
        options,
      }
    });

    // Create audit log (non-blocking)
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: membership.organizationId,
        action: 'PIPELINE_INGEST_START',
        resourceType: 'pipeline_job',
        resourceId: jobId,
        details: { matterId, documentCount: documentIds?.length || 0 }
      }
    }).catch(e => console.error('Audit log failed:', e));

    return NextResponse.json({ 
      jobId,
      status: pipelineJob.status,
      message: 'Pipeline ingest started'
    });

  } catch (error) {
    console.error('Error starting pipeline ingest:', error);
    return NextResponse.json(
      { error: 'Failed to start pipeline ingest' },
      { status: 500 }
    );
  }
}
