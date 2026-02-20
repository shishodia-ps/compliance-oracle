import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { kimi } from '@/lib/ai';
import { retrieve, cleanText, RetrievedNode, RetrievalContext } from '@/lib/retrieval_service';
import { Redis } from 'ioredis';
import { validateField, schemas } from '@/lib/validation';

// Cache configuration
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const CACHE_TTL_SECONDS = 3600; // 1 hour cache for identical queries

// Simple hash function for query cache keys
function hashQuery(query: string): string {
  let hash = 0;
  for (let i = 0; i < query.length; i++) {
    const char = query.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// Enable debug logging
const DEBUG = process.env.DEBUG_RETRIEVAL === 'true';

function log(level: 'info' | 'debug' | 'warn' | 'error', message: string, data?: any) {
  const prefix = `[SEARCHAI:${level.toUpperCase()}]`;
  if (level === 'debug' && !DEBUG) return;

  if (data) {
    console.log(prefix, message, JSON.stringify(data, null, 2));
  } else {
    console.log(prefix, message);
  }
}

interface SearchAIRequest {
  query: string;
  documentId?: string;  // Optional: specific document to search
  searchMode?: 'current' | 'all';  // 'current' = specific doc, 'all' = cross-document
}

/**
 * POST /api/searchai
 * Advanced semantic search with AI-generated answers and citations
 * Uses shared retrieval service for consistent results with Document Q&A
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: SearchAIRequest = await request.json();
    const { query, documentId, searchMode = 'all' } = body;

    // Validate query
    const queryError = validateField(query, schemas.searchQuery.query, 'Query');
    if (queryError) {
      return NextResponse.json({ error: queryError, code: 'INVALID_QUERY' }, { status: 400 });
    }

    log('info', '=== SEARCHAI REQUEST ===', {
      query: query.slice(0, 100),
      documentId: documentId || 'none',
      searchMode
    });

    // Build retrieval context
    const retrievalContext: RetrievalContext = {
      searchMode: documentId ? 'current' : searchMode,
      docId: documentId
    };

    // Use shared retrieval service
    log('info', 'Calling shared retrieval service');
    const retrievalResult = await retrieve(query, retrievalContext);

    log('info', 'Retrieval result received', {
      source: retrievalResult.source,
      indexName: retrievalResult.indexName,
      namespace: retrievalResult.namespace,
      totalNodes: retrievalResult.nodes.length,
      totalAvailable: retrievalResult.totalAvailable,
      filters: retrievalResult.filters
    });

    // Log detailed node info for debugging
    if (retrievalResult.nodes.length > 0) {
      log('info', 'Top retrieved nodes', {
        nodes: retrievalResult.nodes.slice(0, 3).map(n => ({
          title: n.node.title?.slice(0, 50),
          path: n.path?.slice(0, 50),
          relevance: n.relevance,
          documentId: n.documentId?.slice(0, 8)
        }))
      });
    }

    if (retrievalResult.nodes.length === 0) {
      log('warn', 'No relevant nodes found', {
        source: retrievalResult.source,
        totalAvailable: retrievalResult.totalAvailable
      });

      return NextResponse.json({
        query,
        results: [],
        answer: `I couldn't find any relevant sections for "${query}" in the ${documentId ? 'selected document' : 'available documents'}. Try rephrasing or asking about specific sections (e.g., "section 5.2.10").`,
        totalNodes: 0,
        retrievalInfo: {
          source: retrievalResult.source,
          indexName: retrievalResult.indexName,
          namespace: retrievalResult.namespace,
          filters: retrievalResult.filters
        }
      });
    }

    // Check cache for identical queries
    const topNodes = retrievalResult.nodes.slice(0, 8);
    const cacheKey = `searchai:${hashQuery(query.toLowerCase().trim())}:${documentId || 'all'}`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        log('info', 'CACHE HIT - Returning cached answer', { cacheKey });
        const cachedData = JSON.parse(cached);
        
        // Return cached result immediately (no AI call needed)
        return NextResponse.json({
          query,
          ...cachedData,
          cached: true,
          retrievalInfo: {
            source: retrievalResult.source,
            indexName: retrievalResult.indexName,
            namespace: retrievalResult.namespace,
            filters: retrievalResult.filters
          }
        });
      }
    } catch (cacheError) {
      log('warn', 'Cache read failed', { error: String(cacheError) });
    }
    
    log('info', 'CACHE MISS - Calling AI for answer', { cacheKey });

    // topNodes already defined above for caching

    // Build context from top results
    const context = topNodes.map((n: RetrievedNode, i: number) => {
      const content = cleanText(n.node.content || n.node.text || n.node.summary || '');
      return `[${i + 1}] ${n.documentName} > ${n.path}\n${content.slice(0, 1500)}`;
    }).join('\n\n---\n\n');

    log('info', 'Generating AI answer', { contextLength: context.length });

    // Format results with full details (built before streaming so we can include in metadata)
    const formattedResults = topNodes.map((r, index) => ({
      id: index + 1,
      documentId: r.documentId,
      documentName: r.documentName,
      nodePath: r.path,
      nodeTitle: r.node.title,
      content: cleanText(r.node.content || r.node.text || '').slice(0, 1000),
      summary: r.node.summary || '',
      relevance: r.relevance,
      reasoning: r.reasoning,
      citation: `[${index + 1}]`,
    }));

    // Generate AI answer with streaming
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          const stream = await kimi.chat.completions.create({
            model: 'kimi-k2.5',
            messages: [
              {
                role: 'system',
                content: `You are a legal research assistant. Answer the user's query based on the provided document sections.

Guidelines:
1. Synthesize information from multiple sources if relevant
2. Cite sources using [1], [2], etc. format matching the provided context
3. Be specific and quote relevant text when possible
4. If information is incomplete, acknowledge limitations
5. Format your answer with clear headings and bullet points`,
              },
              {
                role: 'user',
                content: `Query: ${query}

Document sections found:
${context}

Provide a comprehensive answer with citations [1], [2], etc. referencing the sources above.`,
              },
            ],
            temperature: 1,
            max_tokens: 2000,
            stream: true,
          });

          let fullAnswer = '';
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || '';
            if (text) {
              fullAnswer += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: text })}\n\n`));
            }
          }

          // Cache the complete response for future queries
          try {
            const cacheData = {
              answer: fullAnswer,
              results: formattedResults,
              totalDocuments: documentId ? 1 : retrievalResult.totalAvailable,
              totalNodesScanned: retrievalResult.totalAvailable,
              sourcesUsed: formattedResults.length,
            };
            await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(cacheData));
            log('info', 'Response cached', { cacheKey, ttl: CACHE_TTL_SECONDS });
          } catch (cacheErr) {
            log('warn', 'Failed to cache response', { error: String(cacheErr) });
          }

          // Send final payload with all metadata
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            done: true,
            query,
            answer: fullAnswer,
            results: formattedResults,
            totalDocuments: documentId ? 1 : retrievalResult.totalAvailable,
            totalNodesScanned: retrievalResult.totalAvailable,
            sourcesUsed: formattedResults.length,
            cached: false,
            retrievalInfo: {
              source: retrievalResult.source,
              indexName: retrievalResult.indexName,
              namespace: retrievalResult.namespace,
              filters: retrievalResult.filters
            }
          })}\n\n`));
        } catch (err: any) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            done: true,
            error: err?.message || 'Stream failed',
          })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    log('info', '=== SEARCHAI STREAMING STARTED ===', {
      query: query.slice(0, 50),
      resultsCount: formattedResults.length,
      source: retrievalResult.source
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('[SEARCHAI:ERROR]', 'Search failed:', error);
    return NextResponse.json(
      { error: 'Search failed: ' + String(error) },
      { status: 500 }
    );
  }
}
