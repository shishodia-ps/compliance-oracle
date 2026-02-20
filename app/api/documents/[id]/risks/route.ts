import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { kimi } from '@/lib/ai';
import { redis } from '@/lib/redis';

interface Risk {
  type: string;
  description: string;
  severity: 'High' | 'Medium' | 'Low';
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
    const cacheKey = `doc:${id}:risks`;
    const lockKey = `doc:${id}:risks:generating`;

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

    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      return NextResponse.json({
        ...data,
        documentId: id,
        documentName: document.name,
        cached: true,
      });
    }

    // Get tree data with risks
    const treeRecord = await prisma.$queryRaw<{ tree_data: any }[]>`
      SELECT tree_data FROM pageindex_trees WHERE document_id = ${id}
    `;

    if (!treeRecord || treeRecord.length === 0 || !treeRecord[0].tree_data) {
      return NextResponse.json({ 
        risks: [], 
        message: 'Document not processed yet',
        documentId: id,
        documentName: document.name,
      });
    }

    const treeData = treeRecord[0].tree_data;
    let risks: Risk[] = treeData.risks || [];

    // If risks already cached in tree, return them
    if (risks.length > 0) {
      await redis.setex(cacheKey, 3600, JSON.stringify({ risks }));
      return NextResponse.json({
        risks,
        documentId: id,
        documentName: document.name,
        source: 'tree_cache',
      });
    }

    // Check if generation is in progress
    const isGenerating = await redis.get(lockKey);
    if (isGenerating) {
      return NextResponse.json({
        risks: [],
        message: 'Risk analysis in progress. Please check back in a moment.',
        documentId: id,
        documentName: document.name,
        pending: true,
      });
    }

    // If no risks cached, queue background generation instead of blocking
    if (risks.length === 0) {
      // Get document content for generation
      const extraction = await prisma.documentExtraction.findFirst({
        where: { documentId: id },
      });

      if (!extraction?.content || extraction.content.length < 500) {
        return NextResponse.json({
          risks: [{
            type: 'Analysis Pending',
            description: 'Document content not yet available for risk analysis.',
            severity: 'Low'
          }],
          documentId: id,
          documentName: document.name,
        });
      }

      // Set lock and queue background generation
      await redis.setex(lockKey, 120, '1');
      
      // Trigger background generation (don't await)
      generateRisksInBackground(id, extraction.content.slice(0, 8000), treeData);

      return NextResponse.json({
        risks: [{
          type: 'Analysis In Progress',
          description: 'Risk analysis is being generated. Please refresh in 30 seconds.',
          severity: 'Low'
        }],
        documentId: id,
        documentName: document.name,
        pending: true,
      });
    }

    return NextResponse.json({
      risks,
      documentId: id,
      documentName: document.name,
    });
  } catch (error) {
    console.error('Risks API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch risks' },
      { status: 500 }
    );
  }
}

async function generateRisksInBackground(docId: string, content: string, treeData: any) {
  try {
    const resp = await kimi.chat.completions.create({
      model: 'kimi-k2.5',
      messages: [
        {
          role: 'system',
          content: 'Identify 3-5 legal/compliance risks in this document. Return JSON array: [{"type": "Risk Type", "description": "Brief description", "severity": "High|Medium|Low"}]'
        },
        { role: 'user', content: `Analyze for risks:\n\n${content}` }
      ],
      temperature: 1,
      max_tokens: 1000,
    });

    const result = resp.choices[0].message.content;
    let risks: Risk[] = [];

    if (result) {
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        risks = JSON.parse(jsonMatch[0]);
      }
    }

    if (risks.length === 0) {
      risks = [{
        type: 'Compliance Review',
        description: 'This document should be reviewed for compliance with applicable regulations.',
        severity: 'Medium'
      }];
    }

    // Cache in Redis (1 hour)
    await redis.setex(`doc:${docId}:risks`, 3600, JSON.stringify({ risks }));

    // Also cache in tree_data for persistence
    const updatedTreeData = { ...treeData, risks };
    await prisma.$executeRaw`
      UPDATE pageindex_trees
      SET tree_data = ${JSON.stringify(updatedTreeData)}::jsonb
      WHERE document_id = ${docId}
    `;

  } catch (error) {
    console.error('Background risk generation failed:', error);
  } finally {
    await redis.del(`doc:${docId}:risks:generating`);
  }
}
