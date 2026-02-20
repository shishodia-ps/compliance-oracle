import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/pipeline/jobs
 * List pipeline jobs for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '20', 10));

    const where: any = { orgId: membership.organizationId };
    if (status) {
      where.status = status;
    }

    const jobs = await prisma.pipelineJob.findMany({
      where,
      include: {
        matter: {
          select: { name: true },
        },
        artifacts: {
          select: {
            id: true,
            type: true,
            path: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Pipeline jobs list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pipeline/jobs
 * Create a new pipeline job
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    const body = await request.json();
    const { matterId, documentIds, options } = body;

    if (!matterId || !documentIds || documentIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing matterId or documentIds' },
        { status: 400 }
      );
    }

    const job = await prisma.pipelineJob.create({
      data: {
        orgId: membership.organizationId,
        matterId,
        documentIds,
        status: 'PENDING',
        step: 'IDLE',
        progress: 0,
        options: options || {},
      },
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    console.error('Pipeline job creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    );
  }
}
