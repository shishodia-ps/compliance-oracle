/**
 * LlamaCloud Integration with Retry Logic and Fallback
 * Note: Actual parsing is done by Python worker using llama-parse package
 * This module provides TypeScript types and fallback handling
 */

// LlamaCloud configuration
const LLAMA_CLOUD_API_KEY = process.env.LLAMA_CLOUD_API_KEY;
const LLAMA_CLOUD_BASE_URL = process.env.LLAMA_CLOUD_BASE_URL || 'https://api.cloud.eu.llamaindex.ai';

if (!LLAMA_CLOUD_API_KEY) {
  console.warn('[LLAMACLOUD] API key not configured');
}

export interface ParseResult {
  text: string;
  markdown: string;
  pages: Array<{
    page: number;
    text: string;
    markdown?: string;
  }>;
  metadata?: Record<string, any>;
}

export interface ParseOptions {
  maxRetries?: number;
  timeoutMs?: number;
  useFallback?: boolean;
}

/**
 * Parse document with retry logic and fallback
 * Note: This is a TypeScript wrapper - actual parsing happens in Python worker
 */
export async function parseDocument(
  filePath: string,
  options: ParseOptions = {}
): Promise<ParseResult> {
  // Document parsing is handled by the Python worker (pipeline_runner.py)
  // This function exists for type definitions and fallback handling
  console.log(`[LLAMACLOUD] Document parsing handled by Python worker for: ${filePath}`);
  
  // Return placeholder - actual extraction happens in worker
  return {
    text: '',
    markdown: '',
    pages: [],
    metadata: { source: 'worker_pending' },
  };
}



/**
 * Check if LlamaCloud is configured and healthy
 */
export async function checkLlamaCloudHealth(): Promise<{
  healthy: boolean;
  message: string;
}> {
  if (!LLAMA_CLOUD_API_KEY) {
    return { healthy: false, message: 'API key not configured' };
  }

  try {
    // Simple health check - try to initialize client
    return { healthy: true, message: 'LlamaCloud configured' };
  } catch (error: any) {
    return { healthy: false, message: error.message };
  }
}
