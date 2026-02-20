import OpenAI from 'openai';

const globalForKimi = globalThis as unknown as {
  kimi: OpenAI | undefined;
};

export const kimi = globalForKimi.kimi ?? new OpenAI({
  apiKey: process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY,
  baseURL: 'https://api.moonshot.ai/v1',
  timeout: 60_000,
  maxRetries: 2,
});

if (process.env.NODE_ENV !== 'production') globalForKimi.kimi = kimi;
