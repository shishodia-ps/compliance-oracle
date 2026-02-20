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
 * GET /api/pipeline/artifacts/download
 * Proxy download from pipeline worker
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
    const path = searchParams.get('path');

    if (!orgId || !matterId || !path) {
      return NextResponse.json(
        { error: 'orgId, matterId, and path are required' },
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

    // Proxy download request to worker
    const workerUrl = `${PIPELINE_WORKER_URL}/artifacts/download?orgId=${encodeURIComponent(orgId)}&matterId=${encodeURIComponent(matterId)}&path=${encodeURIComponent(path)}`;
    
    const workerResponse = await fetch(workerUrl);

    if (!workerResponse.ok) {
      if (workerResponse.status === 403) {
        return NextResponse.json(
          { error: 'Access denied to artifact' },
          { status: 403 }
        );
      }
      if (workerResponse.status === 404) {
        return NextResponse.json(
          { error: 'Artifact not found' },
          { status: 404 }
        );
      }
      throw new Error(`Worker error: ${await workerResponse.text()}`);
    }

    // Stream the file back to client
    const contentType = workerResponse.headers.get('content-type') || 'application/json';
    const contentDisposition = workerResponse.headers.get('content-disposition');
    
    return new NextResponse(workerResponse.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        ...(contentDisposition && { 'Content-Disposition': contentDisposition }),
      }
    });

  } catch (error) {
    console.error('Error downloading artifact:', error);
    return NextResponse.json(
      { error: 'Failed to download artifact' },
      { status: 500 }
    );
  }
}
