/**
 * Server-side initialization
 * Call this in API routes or server components
 */

let initialized = false;

export async function initializeServer() {
  if (initialized || typeof window !== 'undefined') {
    return;
  }

  console.log('[INIT] Starting server initialization...');

  try {
    // Dynamically import to avoid circular dependencies
    const { initQueue } = await import('./queue');
    await initQueue();
    console.log('[INIT] Queue initialized');

    initialized = true;
    console.log('[INIT] Server initialization complete');
  } catch (error) {
    console.error('[INIT] Initialization failed:', error);
  }
}

// Export a helper to ensure init is called
export function ensureInitialized() {
  if (typeof window === 'undefined' && !initialized) {
    initializeServer().catch(console.error);
  }
}
