import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { documentQueue } from '@/lib/queue';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'waiting';
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20', 10));

    let jobs;
    switch (status) {
      case 'waiting':
        jobs = await documentQueue.getWaiting(0, limit);
        break;
      case 'active':
        jobs = await documentQueue.getActive(0, limit);
        break;
      case 'completed':
        jobs = await documentQueue.getCompleted(0, limit);
        break;
      case 'failed':
        jobs = await documentQueue.getFailed(0, limit);
        break;
      default:
        jobs = await documentQueue.getJobs(['waiting', 'active'], 0, limit, true);
    }

    const formattedJobs = jobs.map(job => ({
      id: job.id,
      name: job.name,
      data: job.data,
      status: status,
      progress: job.progress,
      attempts: job.attemptsMade,
      failedReason: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      timestamp: job.timestamp,
    }));

    return NextResponse.json({ jobs: formattedJobs, status, count: formattedJobs.length });
  } catch (error) {
    console.error('Queue jobs error:', error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const gracePeriod = parseInt(searchParams.get('grace') || '3600000', 10);

    const [completed, failed] = await Promise.all([
      documentQueue.clean(gracePeriod, 'completed'),
      documentQueue.clean(gracePeriod * 24, 'failed'),
    ]);

    return NextResponse.json({
      success: true,
      cleaned: { completed: completed.length, failed: failed.length },
    });
  } catch (error) {
    console.error('Queue clean error:', error);
    return NextResponse.json({ error: 'Failed to clean jobs' }, { status: 500 });
  }
}
