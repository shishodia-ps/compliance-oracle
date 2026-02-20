import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

interface Clause {
  id: string;
  title: string;
  content: string;
  type: string;
  path: string;
}

function cleanHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\*\*/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function generateId(path: string): string {
  return Buffer.from(path).toString('base64').slice(0, 16);
}

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
    const cacheKey = `doc:${id}:clauses`;
    
    const cached = await redis.get(cacheKey);
    if (cached) {
      return NextResponse.json(JSON.parse(cached), {
        headers: { 'X-Cache': 'HIT' }
      });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    const [document, treeRecord, extraction] = await Promise.all([
      prisma.document.findFirst({
        where: { id, organizationId: membership.organizationId },
        select: { id: true, name: true, status: true }
      }),
      prisma.$queryRaw<{ tree_data: any }[]>`
        SELECT tree_data FROM pageindex_trees WHERE document_id = ${id}
      `,
      prisma.documentExtraction.findFirst({
        where: { documentId: id },
        select: { items: true }
      })
    ]);

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const clauses: Clause[] = [];
    const seen = new Set<string>();

    if (treeRecord && treeRecord.length > 0 && treeRecord[0].tree_data) {
      const treeData = treeRecord[0].tree_data;
      const nodes = treeData.nodes || treeData.structure?.nodes || [];

      const extractFromNode = (node: any, parentPath: string = '', depth: number = 0) => {
        if (depth > 5) return;
        if (!node) return;

        const title = cleanHtml(node.title || node.heading || '');
        let content = '';
        
        if (node.text && typeof node.text === 'string') {
          content = cleanHtml(node.text);
        } else if (node.content && typeof node.content === 'string') {
          content = cleanHtml(node.content);
        } else if (node.summary && typeof node.summary === 'string') {
          content = cleanHtml(node.summary);
        }

        const path = parentPath ? `${parentPath} > ${title}` : title;
        const key = generateId(path);

        const skipTitles = ['table of contents', 'index', 'page', 'copyright', 'all rights reserved'];
        const isGeneric = skipTitles.some(st => title.toLowerCase().includes(st));

        if (title && title.length > 2 && !isGeneric && !seen.has(key) && content.length > 50) {
          seen.add(key);
          
          let type = 'general';
          const titleLower = title.toLowerCase();
          if (titleLower.includes('risk') || titleLower.includes('liability')) type = 'risk';
          else if (titleLower.includes('term') || titleLower.includes('condition')) type = 'terms';
          else if (titleLower.includes('payment') || titleLower.includes('fee')) type = 'financial';
          else if (titleLower.includes('confidential')) type = 'confidentiality';
          else if (titleLower.includes('termination')) type = 'termination';
          else if (titleLower.includes('warranty')) type = 'warranty';

          clauses.push({
            id: key,
            title: title.slice(0, 150),
            content: content.slice(0, 2000),
            type,
            path
          });
        }

        const children = node.nodes || node.children || [];
        for (const child of children) {
          extractFromNode(child, path || title, depth + 1);
        }
      };

      for (const node of nodes) {
        extractFromNode(node);
      }
    }

    if (clauses.length === 0 && extraction?.items && Array.isArray(extraction.items)) {
      for (const item of extraction.items) {
        if (typeof item === 'object' && item !== null) {
          const itemObj = item as Record<string, any>;
          if (itemObj.type === 'text' && itemObj.text && typeof itemObj.text === 'string') {
            const text = cleanHtml(itemObj.text);
            if (text.length > 100) {
              const key = generateId(text.slice(0, 50));
              if (!seen.has(key)) {
                seen.add(key);
                clauses.push({
                  id: key,
                  title: text.slice(0, 100).split('.')[0] || 'Clause',
                  content: text.slice(0, 2000),
                  type: 'extracted',
                  path: 'Extracted Content'
                });
              }
            }
          }
        }
      }
    }

    const typePriority: Record<string, number> = {
      risk: 1, financial: 2, termination: 3, terms: 4,
      confidentiality: 5, warranty: 6, general: 7, extracted: 8
    };
    clauses.sort((a, b) => typePriority[a.type] - typePriority[b.type]);

    const result = {
      clauses: clauses.slice(0, 20),
      total: clauses.length,
      documentId: id,
      documentName: document.name
    };

    await redis.setex(cacheKey, 300, JSON.stringify(result));

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=300', 'X-Cache': 'MISS' },
    });
  } catch (error) {
    console.error('Clauses fetch error:', error);
    return NextResponse.json({ clauses: [], total: 0, error: 'Failed to fetch clauses' });
  }
}
