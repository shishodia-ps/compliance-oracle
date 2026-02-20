import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

// Rate limit configuration
const ADMIN_RATE_LIMIT = {
  max: 100,        // 100 requests
  window: 60 * 1000, // per minute
};

/**
 * Rate limiting middleware for admin routes
 * Returns null if allowed, NextResponse if rate limited
 */
export async function checkAdminRateLimit(
  req: NextRequest
): Promise<NextResponse | null> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const key = `ratelimit:admin:${ip}`;

  try {
    // Get current count
    const current = await redis.get(key);
    const count = parseInt(current || '0', 10);

    if (count >= ADMIN_RATE_LIMIT.max) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil(ADMIN_RATE_LIMIT.window / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': ADMIN_RATE_LIMIT.max.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(Date.now() + ADMIN_RATE_LIMIT.window).toISOString(),
          },
        }
      );
    }

    // Increment count
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    if (count === 0) {
      pipeline.pexpire(key, ADMIN_RATE_LIMIT.window);
    }
    await pipeline.exec();

    return null;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Allow request on error (fail open)
    return null;
  }
}

/**
 * Apply rate limit to admin route handlers
 * Usage: Wrap your GET/POST/PUT/DELETE handlers with this
 */
export function withRateLimit(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: any[]) => {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    return handler(req, ...args);
  };
}
