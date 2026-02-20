import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/pipeline/jobs/[jobId]
 * Get detailed status of a pipeline job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
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

    const { jobId } = await params;

    const job = await prisma.pipelineJob.findFirst({
      where: {
        id: jobId,
        orgId: membership.organizationId,
      },
      include: {
        matter: {
          select: { id: true, name: true },
        },
        artifacts: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Get document names
    const documents = await prisma.document.findMany({
      where: {
        id: { in: job.documentIds },
      },
      select: { id: true, name: true, status: true },
    });

    return NextResponse.json({
      job: {
        ...job,
        documents,
      },
    });
  } catch (error) {
    console.error('Pipeline job status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job status' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/pipeline/jobs/[jobId]
 * Update job status (for worker callbacks)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    });

    if (!membership || membership.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { jobId } = await params;
    const body = await request.json();
    const { status, step, progress, error } = body;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (step) updateData.step = step;
    if (progress !== undefined) updateData.progress = progress;
    if (error) updateData.error = error;

    if (status === 'COMPLETED' || status === 'FAILED') {
      updateData.finishedAt = new Date();
    }

    const job = await prisma.pipelineJob.update({
      where: { id: jobId },
      data: updateData,
    });

    return NextResponse.json({ job });
  } catch (error) {
    console.error('Pipeline job update error:', error);
    return NextResponse.json(
      { error: 'Failed to update job' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pipeline/jobs/[jobId]
 * Cancel/delete a job
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    const { jobId } = await params;

    // Only allow deleting own org's jobs
    const job = await prisma.pipelineJob.findFirst({
      where: {
        id: jobId,
        orgId: membership.organizationId,
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    await prisma.pipelineJob.delete({
      where: { id: jobId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Pipeline job delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete job' },
      { status: 500 }
    );
  }
}
