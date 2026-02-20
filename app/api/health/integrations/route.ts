import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkLlamaCloudHealth } from '@/lib/llama-cloud';
import { checkMoonshotHealth } from '@/lib/moonshot-ai';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [llamaCloud, moonshot] = await Promise.all([
      checkLlamaCloudHealth(),
      checkMoonshotHealth(),
    ]);

    const allHealthy = llamaCloud.healthy && moonshot.healthy;

    return NextResponse.json({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        llamaCloud: {
          name: 'LlamaCloud',
          status: llamaCloud.healthy ? 'healthy' : 'unhealthy',
          message: llamaCloud.message,
        },
        moonshot: {
          name: 'Moonshot AI (Kimi)',
          status: moonshot.healthy ? 'healthy' : 'unhealthy',
          message: moonshot.message,
          model: moonshot.model,
        },
        googleOAuth: {
          name: 'Google OAuth',
          status: process.env.GOOGLE_CLIENT_ID ? 'configured' : 'not_configured',
          message: process.env.GOOGLE_CLIENT_ID ? 'Client ID configured' : 'GOOGLE_CLIENT_ID not set',
        },
      },
    });
  } catch (error) {
    console.error('Integration health check error:', error);
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 });
  }
}
