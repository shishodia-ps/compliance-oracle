import Redis from 'ioredis';

export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

// Create Redis client with error handling
function createRedisClient(): Redis {
  const client = new Redis(REDIS_URL, {
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true, // Don't connect immediately
  });

  client.on('error', (err) => {
    if (err.message?.includes('ECONNREFUSED')) {
      console.warn('[REDIS] Connection refused. Caching will be disabled.');
    } else {
      console.error('[REDIS] Error:', err.message);
    }
  });

  client.on('connect', () => {
    console.log('[REDIS] Connected successfully');
  });

  client.on('ready', () => {
    console.log('[REDIS] Client ready');
  });

  client.on('close', () => {
    console.log('[REDIS] Connection closed');
  });

  return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

// Helper to check if Redis is connected
export async function isRedisConnected(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

// Safe Redis operations that don't throw
export async function safeGet(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

export async function safeSet(key: string, value: string, ttl?: number): Promise<void> {
  try {
    if (ttl) {
      await redis.setex(key, ttl, value);
    } else {
      await redis.set(key, value);
    }
  } catch {
    // Silently fail - caching is best-effort
  }
}

export async function safeDel(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch {
    // Silently fail
  }
}
