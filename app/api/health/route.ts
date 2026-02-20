import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks = {
    database: false,
    timestamp: new Date().toISOString(),
    version: process.env.GIT_COMMIT_HASH || 'dev',
  };

  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;

    return NextResponse.json({
      status: 'healthy',
      ...checks,
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      ...checks,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 503 });
  }
}
