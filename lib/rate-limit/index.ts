/**
 * Rate limiting for API routes
 * Uses Redis for distributed rate limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import { redis, safeGet, safeSet } from '@/lib/redis';

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Max requests per window
  keyPrefix?: string;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
}

/**
 * Get client IP from request
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 
             request.headers.get('x-real-ip') || 
             'unknown';
  return ip;
}

/**
 * Rate limit check using Redis
 */
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { windowMs, maxRequests, keyPrefix = 'ratelimit' } = config;
  
  const identifier = getClientIP(request);
  const key = `${keyPrefix}:${identifier}`;
  
  try {
    // Get current count
    const current = await safeGet(key);
    const now = Date.now();
    
    if (!current) {
      // First request in window
      await safeSet(key, '1', Math.ceil(windowMs / 1000));
      return {
        allowed: true,
        limit: maxRequests,
        remaining: maxRequests - 1,
        resetTime: now + windowMs,
      };
    }
    
    const count = parseInt(current, 10);
    
    if (count >= maxRequests) {
      // Rate limit exceeded
      return {
        allowed: false,
        limit: maxRequests,
        remaining: 0,
        resetTime: now + windowMs,
      };
    }
    
    // Increment count
    await redis.incr(key);
    
    return {
      allowed: true,
      limit: maxRequests,
      remaining: maxRequests - count - 1,
      resetTime: now + windowMs,
    };
  } catch (error) {
    // If Redis fails, allow the request (fail open)
    console.error('Rate limit check failed:', error);
    return {
      allowed: true,
      limit: maxRequests,
      remaining: 1,
      resetTime: Date.now() + windowMs,
    };
  }
}

/**
 * Middleware wrapper for rate limiting
 */
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  config: RateLimitConfig
) {
  return async (request: NextRequest) => {
    const result = await rateLimit(request, config);
    
    if (!result.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(result.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
          },
        }
      );
    }
    
    // Add rate limit headers to response
    const response = await handler(request);
    response.headers.set('X-RateLimit-Limit', String(result.limit));
    response.headers.set('X-RateLimit-Remaining', String(result.remaining));
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetTime / 1000)));
    
    return response;
  };
}

// Preset configurations
export const rateLimitConfigs = {
  // Strict limit for admin routes
  admin: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    keyPrefix: 'ratelimit:admin',
  },
  // Standard API limit
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    keyPrefix: 'ratelimit:api',
  },
  // Generous limit for uploads
  upload: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    keyPrefix: 'ratelimit:upload',
  },
  // Strict limit for auth
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    keyPrefix: 'ratelimit:auth',
  },
};
