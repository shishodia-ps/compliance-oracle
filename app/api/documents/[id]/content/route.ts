import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { readFile } from 'fs/promises';
import mammoth from 'mammoth';

/**
 * GET /api/documents/[id]/content
 * Returns document content as JSON (for compare/analysis) or HTML (for Word preview)
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
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format'); // 'json' | 'html'

    // Get user's organization
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    // Get document with all related data
    const document = await prisma.document.findFirst({
      where: {
        id,
        organizationId: membership.organizationId,
      },
      include: {
        extractionData: true,
        summary: true,
        pageIndexTree: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // If HTML format requested or it's a Word doc and no format specified → return HTML
    const isWordDoc = document.fileName.toLowerCase().endsWith('.docx') || 
                      document.fileName.toLowerCase().endsWith('.doc');
    
    if (format === 'html' || (isWordDoc && format !== 'json')) {
      // Return HTML for Word documents
      if (isWordDoc) {
        try {
          const fileBuffer = await readFile(document.storageKey);
          const result = await mammoth.convertToHtml({ buffer: fileBuffer }, {
            styleMap: [
              "p[style-name='Heading 1'] => h1",
              "p[style-name='Heading 2'] => h2", 
              "p[style-name='Heading 3'] => h3",
              "p[style-name='Heading 4'] => h4",
            ]
          });

          const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #333; max-width: 800px; margin: 40px auto; padding: 20px; background: white; }
    h1, h2, h3, h4 { color: #1a1a1a; margin-top: 24px; margin-bottom: 12px; }
    h1 { font-size: 24px; border-bottom: 2px solid #e5e5e5; padding-bottom: 8px; }
    h2 { font-size: 20px; }
    h3 { font-size: 16px; }
    p { margin: 12px 0; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    td, th { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
    ul, ol { margin: 12px 0; padding-left: 24px; }
    strong { color: #1a1a1a; }
  </style>
</head>
<body>${result.value}</body>
</html>`;

          return new NextResponse(html, {
            headers: {
              'Content-Type': 'text/html',
              'Cache-Control': 'public, max-age=3600',
            },
          });
        } catch (e) {
          console.error('Mammoth error:', e);
          // Fall through to JSON response
        }
      }
      
      // For non-Word or conversion failed, return markdown as plain text
      const markdown = document.extractionData?.markdown || 'No content available';
      return new NextResponse(markdown, {
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Return JSON for compare/analysis
    const treeData = document.pageIndexTree?.treeData as any || { nodes: [] };
    
    // Extract headings from tree
    const headings: Array<{ title: string; level: number; path: string[] }> = [];
    
    const extractHeadings = (node: any, path: string[] = [], level = 1): void => {
      if (!node) return;
      const title = node.title || node.doc_name || 'Untitled';
      const newPath = [...path, title];
      headings.push({ title, level, path: newPath });
      if (node.nodes && Array.isArray(node.nodes)) {
        node.nodes.forEach((child: any) => extractHeadings(child, newPath, level + 1));
      }
    };
    
    if (treeData.nodes) {
      treeData.nodes.forEach((node: any) => extractHeadings(node, [], 1));
    }

    // Build chunks from tree
    const chunks: any[] = [];
    const extractChunks = (node: any, path: string[] = [], level = 0): void => {
      if (!node) return;
      const title = node.title || '';
      const text = node.text || node.content || node.summary || '';
      const newPath = [...path, title].filter(Boolean);
      
      if (text && text.length > 30) {
        chunks.push({
          id: node.node_id || `chunk-${chunks.length}`,
          page: node.page || 1,
          sectionPath: newPath.join(' > ') || 'Document',
          text: text,
          level,
        });
      }
      
      if (node.nodes && Array.isArray(node.nodes)) {
        node.nodes.forEach((child: any) => extractChunks(child, newPath, level + 1));
      }
    }
    
    if (treeData.nodes) {
      treeData.nodes.forEach((node: any) => extractChunks(node, [], 0));
    }

    return NextResponse.json({
      document: {
        id: document.id,
        name: document.name,
        fileName: document.fileName,
        documentType: document.documentType,
        status: document.status,
        createdAt: document.createdAt.toISOString(),
      },
      content: {
        markdown: document.extractionData?.markdown || '',
        text: document.extractionData?.content || '',
      },
      structure: {
        tree: treeData,
        headings,
        chunks,
      },
      summary: document.summary ? {
        summary: document.summary.summary,
        keyPoints: document.summary.keyPoints as string[] || [],
      } : null,
    });

  } catch (error) {
    console.error('Content API error:', error);
    return NextResponse.json(
      { error: 'Failed to get document content' },
      { status: 500 }
    );
  }
}
