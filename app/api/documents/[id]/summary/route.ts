import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Clean HTML and markdown from text
 */
function cleanText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, ' ')  // Remove HTML tags
    .replace(/\*\*/g, '')       // Remove markdown bold
    .replace(/#{1,6}\s/g, '')   // Remove markdown headers
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove markdown links
    .replace(/\n+/g, ' ')       // Replace newlines with spaces
    .replace(/\s+/g, ' ')       // Normalize spaces
    .trim();
}

/**
 * GET /api/documents/[id]/summary
 * Get AI summary for a document
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

    const document = await prisma.document.findFirst({
      where: { id, organizationId: membership.organizationId },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Get tree data
    const treeRecord = await prisma.$queryRaw<{ tree_data: any }[]>`
      SELECT tree_data FROM pageindex_trees WHERE document_id = ${id}
    `;

    if (!treeRecord || treeRecord.length === 0 || !treeRecord[0].tree_data) {
      return NextResponse.json({
        summary: '',
        keyPoints: [],
        message: 'Document not processed yet'
      });
    }

    const treeData = treeRecord[0].tree_data;

    // Get document description from PageIndex or generate it
    let summary = treeData.doc_description || '';

    // If no description, try to build one from tree structure
    if (!summary && treeData.nodes) {
      const titles = treeData.nodes
        .slice(0, 5)
        .map((n: any) => n.title)
        .filter(Boolean)
        .join(', ');
      if (titles) {
        summary = `This document covers: ${titles}.`;
      }
    }

    // If still no summary, extract from extraction data
    if (!summary) {
      const extraction = await prisma.documentExtraction.findFirst({
        where: { documentId: id },
      });
      if (extraction?.content) {
        summary = cleanText(extraction.content.slice(0, 500));
      }
    }

    // Extract key points from top-level nodes
    const keyPoints: string[] = [];
    const nodes = treeData.nodes || treeData.structure?.nodes || [];

    for (const node of nodes.slice(0, 6)) {
      if (node.title) {
        const cleanTitle = cleanText(node.title);
        if (cleanTitle && cleanTitle.length > 3) {
          keyPoints.push(cleanTitle);
        }
      }
    }

    return NextResponse.json({
      summary: summary || 'Document summary not available.',
      keyPoints: keyPoints.length > 0 ? keyPoints : ['Document processed'],
      documentId: id,
      documentName: document.name,
    }, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    console.error('Summary API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch summary' },
      { status: 500 }
    );
  }
}
