import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getQueueStats } from '@/lib/queue';

/**
 * GET /api/queue
 * Get queue statistics (Admin only)
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const stats = await getQueueStats();

    return NextResponse.json({
      queue: 'document-processing',
      stats,
      health: {
        status: stats.failed > stats.completed ? 'warning' : 'healthy',
        message: stats.failed > stats.completed 
          ? 'High failure rate detected' 
          : 'Queue operating normally',
      },
    });
  } catch (error) {
    console.error('Queue stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch queue stats' },
      { status: 500 }
    );
  }
}
