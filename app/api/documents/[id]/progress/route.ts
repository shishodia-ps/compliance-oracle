import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

/**
 * GET /api/documents/[id]/progress
 * Get processing progress for a document from Redis
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
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    // Verify document belongs to user
    const document = await prisma.document.findFirst({
      where: {
        id,
        organizationId: membership.organizationId,
      },
      select: {
        id: true,
        status: true,
        processingStage: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Get progress from Redis
    const progressKey = `doc:progress:${id}`;
    const progressData = await redis.get(progressKey);

    if (progressData) {
      const parsed = JSON.parse(progressData);
      return NextResponse.json({
        status: parsed.step === 'COMPLETED' ? 'complete' : 
                parsed.step === 'ERROR' ? 'error' : 'processing',
        progress: parsed.progress || 0,
        step: parsed.step || document.processingStage || 'PENDING',
        message: parsed.message || 'Processing...',
        timestamp: parsed.timestamp,
      });
    }

    // Return status based on document status
    if (document.status === 'ANALYZED') {
      return NextResponse.json({
        status: 'complete',
        progress: 100,
        step: 'COMPLETED',
        message: 'Processing complete',
      });
    }

    if (document.status === 'ERROR') {
      return NextResponse.json({
        status: 'error',
        progress: 0,
        step: 'ERROR',
        message: 'Processing failed',
      });
    }

    // Default: still processing but no Redis data yet
    return NextResponse.json({
      status: 'processing',
      progress: 0,
      step: document.processingStage || 'PENDING',
      message: 'Waiting to start...',
    });
  } catch (error) {
    console.error('Progress fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}
