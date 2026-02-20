/**
 * Moonshot AI (Kimi) Client with Context Window Management
 * Handles token limits, chunking, and intelligent context management
 */

import OpenAI from 'openai';

const MOONSHOT_API_KEY = process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY;

// Kimi model context windows
export const MODEL_LIMITS = {
  'kimi-k2.5': {
    maxTokens: 128000,
    outputTokens: 8192,
    description: 'Latest Kimi K2.5 with 128K context',
  },
  'kimi-k2': {
    maxTokens: 128000,
    outputTokens: 8192,
    description: 'Kimi K2 with 128K context',
  },
  'kimi-latest': {
    maxTokens: 128000,
    outputTokens: 8192,
    description: 'Latest Kimi model',
  },
};

export type MoonshotModel = keyof typeof MODEL_LIMITS;

// Initialize client
export const moonshot = new OpenAI({
  apiKey: MOONSHOT_API_KEY,
  baseURL: 'https://api.moonshot.ai/v1',
});

export interface CompletionOptions {
  model?: MoonshotModel;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
}

export interface CompletionResult {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  truncated?: boolean;
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 chars for English)
 */
export function estimateTokens(text: string): number {
  // More accurate for mixed content
  const charCount = text.length;
  // Chinese characters ≈ 1 token each, English ≈ 4 chars per token
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = charCount - chineseChars;

  return Math.ceil(chineseChars + otherChars / 4);
}

/**
 * Truncate text to fit within token limit
 */
export function truncateToTokenLimit(
  text: string,
  maxTokens: number,
  reserveTokens: number = 500
): string {
  const availableTokens = maxTokens - reserveTokens;
  const estimatedChars = availableTokens * 4;

  if (text.length <= estimatedChars) {
    return text;
  }

  // Try to truncate at a sentence boundary
  const truncated = text.slice(0, estimatedChars);
  const lastSentence = truncated.lastIndexOf('.');
  const lastParagraph = truncated.lastIndexOf('\n\n');
  const lastSpace = truncated.lastIndexOf(' ');

  const cutPoint = Math.max(lastSentence, lastParagraph, lastSpace);

  if (cutPoint > estimatedChars * 0.8) {
    return truncated.slice(0, cutPoint) + '\n\n[Content truncated due to length...]';
  }

  return truncated + '\n\n[Content truncated due to length...]';
}

/**
 * Split content into chunks that fit within token limit
 */
export function chunkContent(
  content: string,
  maxChunkTokens: number = 4000,
  overlapTokens: number = 200
): string[] {
  const chunks: string[] = [];
  const estimatedCharsPerChunk = maxChunkTokens * 4;
  const overlapChars = overlapTokens * 4;

  // Split by paragraphs first
  const paragraphs = content.split('\n\n');
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const estimatedTokens = estimateTokens(currentChunk + '\n\n' + paragraph);

    if (estimatedTokens > maxChunkTokens && currentChunk) {
      // Save current chunk and start new one
      chunks.push(currentChunk.trim());
      // Keep some overlap for context
      const words = currentChunk.split(' ');
      const overlapWords = Math.ceil(overlapTokens / 2); // Rough estimate
      currentChunk = words.slice(-overlapWords).join(' ') + '\n\n' + paragraph;
    } else {
      currentChunk = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Create completion with automatic context management
 */
export async function createCompletion(
  options: CompletionOptions
): Promise<CompletionResult> {
  const {
    model = 'kimi-k2.5',
    maxTokens,
    temperature = 0.7,
    systemPrompt,
    messages,
  } = options;

  const modelLimit = MODEL_LIMITS[model];
  const outputLimit = maxTokens || modelLimit.outputTokens;
  const inputLimit = modelLimit.maxTokens - outputLimit - 500; // Reserve buffer

  // Calculate current token usage
  let totalInput = 0;
  const processedMessages = [];

  // Add system prompt if provided
  if (systemPrompt) {
    const systemTokens = estimateTokens(systemPrompt);
    if (systemTokens > inputLimit * 0.1) {
      // System prompt too long, truncate
      processedMessages.push({
        role: 'system',
        content: truncateToTokenLimit(systemPrompt, inputLimit * 0.1),
      });
    } else {
      processedMessages.push({ role: 'system', content: systemPrompt });
      totalInput += systemTokens;
    }
  }

  // Process user messages (truncate if needed)
  let truncated = false;
  for (const msg of messages) {
    const msgTokens = estimateTokens(msg.content);

    if (totalInput + msgTokens > inputLimit) {
      // Truncate this message
      const remainingTokens = inputLimit - totalInput;
      if (remainingTokens > 500) {
        processedMessages.push({
          role: msg.role,
          content: truncateToTokenLimit(msg.content, remainingTokens, 100),
        });
        truncated = true;
      }
      break;
    }

    processedMessages.push(msg);
    totalInput += msgTokens;
  }

  try {
    const response = await moonshot.chat.completions.create({
      model,
      messages: processedMessages as any,
      temperature,
      max_tokens: outputLimit,
    });

    const content = response.choices[0]?.message?.content || '';
    const usage = response.usage;

    return {
      content,
      usage: usage
        ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          }
        : undefined,
      model,
      truncated,
    };
  } catch (error: any) {
    // Handle context length errors
    if (error.message?.includes('context length') || error.code === 'context_length_exceeded') {
      throw new Error(
        `Context length exceeded. Input used ~${totalInput} tokens, limit is ${inputLimit}. ` +
        `Try reducing input size or use chunking.`
      );
    }
    throw error;
  }
}

/**
 * Process large content by chunking and summarizing
 */
export async function processLargeContent(
  content: string,
  task: string,
  options: Omit<CompletionOptions, 'messages'> = {}
): Promise<string> {
  const chunks = chunkContent(content, 4000, 200);

  if (chunks.length === 1) {
    // Small enough to process in one go
    const result = await createCompletion({
      ...options,
      messages: [
        {
          role: 'user',
          content: `${task}\n\nContent:\n${chunks[0]}`,
        },
      ],
    });
    return result.content;
  }

  // Multi-chunk processing with map-reduce approach
  console.log(`[MOONSHOT] Processing ${chunks.length} chunks...`);

  // Map: Process each chunk
  const chunkResults: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    console.log(`[MOONSHOT] Processing chunk ${i + 1}/${chunks.length}`);

    const result = await createCompletion({
      ...options,
      messages: [
        {
          role: 'user',
          content:
            `${task} (Part ${i + 1} of ${chunks.length})\n\n` +
            `Content:\n${chunks[i]}\n\n` +
            `Provide a detailed analysis of this section.`,
        },
      ],
    });

    chunkResults.push(result.content);
  }

  // Reduce: Combine results if needed
  if (chunkResults.length > 1) {
    const combined = chunkResults.join('\n\n---\n\n');

    // If combined is still too large, return summary
    if (estimateTokens(combined) > 6000) {
      const finalResult = await createCompletion({
        ...options,
        messages: [
          {
            role: 'user',
            content:
              `Synthesize the following analyses into a coherent ${task.toLowerCase()}:\n\n` +
              combined.slice(0, 8000),
          },
        ],
      });
      return finalResult.content;
    }

    return combined;
  }

  return chunkResults[0];
}

/**
 * Check if Moonshot API is configured and healthy
 */
export async function checkMoonshotHealth(): Promise<{
  healthy: boolean;
  message: string;
  model?: string;
}> {
  if (!MOONSHOT_API_KEY) {
    return { healthy: false, message: 'API key not configured' };
  }

  try {
    // Quick test request
    const response = await moonshot.chat.completions.create({
      model: 'kimi-k2.5',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 10,
    });

    return {
      healthy: true,
      message: 'Moonshot API responding',
      model: response.model,
    };
  } catch (error: any) {
    return {
      healthy: false,
      message: error.message || 'API health check failed',
    };
  }
}
