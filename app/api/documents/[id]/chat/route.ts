import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { kimi } from '@/lib/ai';
import { retrieve, findSectionInMarkdown, cleanText, RetrievedNode } from '@/lib/retrieval_service';

const DEBUG = process.env.DEBUG_RETRIEVAL === 'true';

function log(level: 'info' | 'debug' | 'error', message: string, data?: any) {
  const prefix = `[DOC_CHAT:${level.toUpperCase()}]`;
  if (level === 'debug' && !DEBUG) return;
  if (data) {
    console.log(prefix, message, JSON.stringify(data, null, 2));
  } else {
    console.log(prefix, message);
  }
}

/**
 * GET /api/documents/[id]/chat
 * Get chat history for a document
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    // Find existing chat session
    const chatSession = await prisma.chatSession.findFirst({
      where: {
        documentId: id,
        userId: session.user.id,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            citations: true,
            createdAt: true,
          },
        },
      },
    });

    if (!chatSession) {
      return NextResponse.json({ messages: [] });
    }

    return NextResponse.json({
      sessionId: chatSession.id,
      messages: chatSession.messages,
    });
  } catch (error) {
    console.error('Chat history error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat history' },
      { status: 500 }
    );
  }
}

/**
 * Stream a Kimi response as SSE, saving messages to database
 */
async function streamAndSaveResponse(
  messages: { role: string; content: string }[],
  maxTokens: number,
  metadata: Record<string, any>,
  chatSessionId: string,
  userMessage: string,
) {
  const encoder = new TextEncoder();
  
  // Save user message first
  await prisma.message.create({
    data: {
      chatSessionId,
      role: 'user',
      content: userMessage,
    },
  });

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        const stream = await kimi.chat.completions.create({
          model: 'kimi-k2.5',
          messages: messages as any,
          temperature: 1,
          max_tokens: maxTokens,
          stream: true,
        });

        let fullContent = '';
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || '';
          if (text) {
            fullContent += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: text })}

`));
          }
        }

        // Save assistant message to database
        await prisma.message.create({
          data: {
            chatSessionId,
            role: 'assistant',
            content: fullContent,
            citations: metadata.sources || [],
          },
        });

        // Update chat session title if first message
        const messageCount = await prisma.message.count({
          where: { chatSessionId },
        });
        if (messageCount <= 2) {
          await prisma.chatSession.update({
            where: { id: chatSessionId },
            data: { title: userMessage.slice(0, 100) },
          });
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          done: true,
          answer: fullContent,
          ...metadata,
        })}

`));
      } catch (err: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          done: true,
          error: err?.message || 'Stream failed',
          ...metadata,
        })}

`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * POST /api/documents/[id]/chat
 * Document Q&A with chat history saving
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'No message' }, { status: 400 });
    }

    log('info', '=== DOCUMENT CHAT REQUEST ===', {
      documentId: id,
      query: message.slice(0, 100)
    });

    const messageLower = message.toLowerCase().trim();

    // Handle greetings
    if (/^(hi|hello|hey)[\s!.]*$/i.test(messageLower)) {
      return NextResponse.json({
        answer: "Hello! Ask me about specific sections like 'what does section 2.1.7 say?'",
        sources: [],
        documentId: id,
      });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    const document = await prisma.document.findFirst({
      where: { id, organizationId: membership.organizationId },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Get or create chat session
    let chatSession = await prisma.chatSession.findFirst({
      where: {
        documentId: id,
        userId: session.user.id,
      },
    });

    if (!chatSession) {
      chatSession = await prisma.chatSession.create({
        data: {
          documentId: id,
          userId: session.user.id,
          title: message.slice(0, 100),
        },
      });
    }

    // Use shared retrieval service
    log('info', 'Calling shared retrieval service');
    const retrievalResult = await retrieve(message, {
      docId: id,
      searchMode: 'current'
    });

    log('info', 'Retrieval result received', {
      source: retrievalResult.source,
      totalNodes: retrievalResult.nodes.length,
      hasMarkdown: !!retrievalResult.markdown
    });

    // If no content available
    if (retrievalResult.source === 'none') {
      // Still save the message
      await prisma.message.create({
        data: {
          chatSessionId: chatSession.id,
          role: 'user',
          content: message,
        },
      });
      await prisma.message.create({
        data: {
          chatSessionId: chatSession.id,
          role: 'assistant',
          content: 'Document is still being processed. Please try again in a moment.',
        },
      });

      return NextResponse.json({
        answer: 'Document is still being processed. Please try again in a moment.',
        sources: [],
        documentId: id,
      });
    }

    // Check for section number in query
    const sectionMatch = message.match(/(\d+(?:\.\d+)+)/);

    if (sectionMatch) {
      const sectionRef = sectionMatch[1];
      log('info', 'Section number detected', { sectionRef });

      if (retrievalResult.markdown) {
        const sectionContent = findSectionInMarkdown(retrievalResult.markdown, sectionRef);

        if (sectionContent && sectionContent.length > 100) {
          log('info', 'Section found in markdown', { sectionRef });

          return streamAndSaveResponse(
            [
              { role: 'system', content: 'You are a legal document assistant.' },
              { role: 'user', content: `Section ${sectionRef}:\n\n${cleanText(sectionContent).slice(0, 4000)}\n\nQuestion: ${message}\n\nAnswer:` },
            ],
            1500,
            {
              sources: [{ path: `Section ${sectionRef}`, title: `Section ${sectionRef}` }],
              documentId: id,
              retrievalSource: retrievalResult.source,
            },
            chatSession.id,
            message,
          );
        }
      }

      const relevantNodes = retrievalResult.nodes.slice(0, 3);

      if (relevantNodes.length > 0) {
        const context = relevantNodes.map((n: RetrievedNode, i: number) => {
          const content = cleanText(n.node.content || n.node.text || n.node.summary || '');
          return `[${i + 1}] ${n.path}\n${content.slice(0, 1500)}`;
        }).join('\n\n---\n\n');

        return streamAndSaveResponse(
          [
            { role: 'system', content: 'You are a legal document assistant.' },
            { role: 'user', content: `Relevant sections:\n\n${context}\n\nQuestion: ${message}\n\nAnswer:` },
          ],
          1500,
          {
            sources: relevantNodes.map(n => ({
              path: n.path,
              title: n.node.title || 'Section',
              relevance: n.relevance
            })),
            documentId: id,
            retrievalSource: retrievalResult.source,
          },
          chatSession.id,
          message,
        );
      }

      return NextResponse.json({
        answer: `Section ${sectionRef} was not found in this document.`,
        sources: [],
        documentId: id,
      });
    }

    // Overview question
    if (messageLower.includes('what is this') ||
        messageLower.includes('about this') ||
        messageLower.includes('overview')) {

      const overview = retrievalResult.markdown
        ? cleanText(retrievalResult.markdown.slice(0, 4000))
        : cleanText(retrievalResult.nodes.slice(0, 3).map(n =>
            n.node.content || n.node.summary || ''
          ).join('\n\n'));

      return streamAndSaveResponse(
        [
          { role: 'system', content: 'Summarize this legal document briefly.' },
          { role: 'user', content: `Document:\n\n${overview}\n\nWhat is this document about?` },
        ],
        800,
        {
          sources: [],
          documentId: id,
          retrievalSource: retrievalResult.source,
        },
        chatSession.id,
        message,
      );
    }

    // Default: use top nodes from retrieval
    if (retrievalResult.nodes.length > 0) {
      const topNodes = retrievalResult.nodes.slice(0, 3);

      const context = topNodes.map((n: RetrievedNode, i: number) => {
        const content = cleanText(n.node.content || n.node.text || n.node.summary || '');
        return `[${i + 1}] ${n.path}\n${content.slice(0, 1500)}`;
      }).join('\n\n---\n\n');

      return streamAndSaveResponse(
        [
          { role: 'system', content: 'You are a legal document assistant.' },
          { role: 'user', content: `Document sections:\n\n${context}\n\nQuestion: ${message}\n\nAnswer:` },
        ],
        1500,
        {
          sources: topNodes.map(n => ({
            path: n.path,
            title: n.node.title || 'Section',
            relevance: n.relevance
          })),
          documentId: id,
          retrievalSource: retrievalResult.source,
        },
        chatSession.id,
        message,
      );
    }

    return NextResponse.json({
      answer: `I couldn't find specific information about "${message}".`,
      sources: [],
      documentId: id,
    });
  } catch (error: any) {
    console.error('[DOC_CHAT:ERROR]', 'Chat error:', error);
    return NextResponse.json(
      { error: 'Chat failed', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
