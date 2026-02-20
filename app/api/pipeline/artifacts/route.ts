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
 * GET /api/pipeline/artifacts
 * List artifacts for a matter
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const matterId = searchParams.get('matterId');

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

    // Get artifacts from database
    const dbArtifacts = await prisma.pipelineArtifact.findMany({
      where: { matterId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Also get from worker (fresh data)
    const workerResponse = await fetch(
      `${PIPELINE_WORKER_URL}/artifacts?orgId=${orgId}&matterId=${matterId}`,
      { signal: AbortSignal.timeout(15_000) }
    );

    let workerArtifacts = [];
    if (workerResponse.ok) {
      const data = await workerResponse.json();
      workerArtifacts = data.artifacts;
    }

    // Merge DB and worker artifacts (prefer worker for fresh data)
    const artifactMap = new Map();
    
    for (const artifact of dbArtifacts) {
      artifactMap.set(artifact.path, {
        id: artifact.id,
        type: artifact.type,
        name: artifact.path.split('/').pop() || artifact.path,
        path: artifact.path,
        size: artifact.size,
        createdAt: artifact.createdAt,
      });
    }

    for (const artifact of workerArtifacts) {
      artifactMap.set(artifact.path, {
        ...artifact,
        id: artifactMap.get(artifact.path)?.id,
      });
    }

    return NextResponse.json({
      artifacts: Array.from(artifactMap.values())
    });

  } catch (error) {
    console.error('Error fetching artifacts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch artifacts' },
      { status: 500 }
    );
  }
}
