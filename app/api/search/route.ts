import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/search
 * Hybrid search: pgvector semantic + PostgreSQL full-text
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { query, matterId, documentId, limit = 10 } = body;

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ error: 'Query too short' }, { status: 400 });
    }

    // Get user's organization
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    const startTime = Date.now();

    // Hybrid search: Combine full-text + semantic (placeholder for now)
    // For now, we'll use PostgreSQL full-text search
    const searchResults = await prisma.$queryRaw`
      SELECT 
        sc.id,
        sc.document_id as "documentId",
        sc.text,
        sc.section_path as "sectionPath",
        sc.page,
        sc.chunk_type as "chunkType",
        sc.clause_type as "clauseType",
        d.name as "documentName",
        d.document_type as "documentType",
        m.name as "matterName",
        ts_rank(sc.text_vector, plainto_tsquery('english', ${query})) as rank
      FROM search_chunks sc
      JOIN documents d ON sc.document_id = d.id
      LEFT JOIN matters m ON d.matter_id = m.id
      WHERE 
        sc.org_id = ${membership.organizationId}
        ${matterId ? prisma.$queryRaw`AND sc.matter_id = ${matterId}` : prisma.$queryRaw``}
        ${documentId ? prisma.$queryRaw`AND sc.document_id = ${documentId}` : prisma.$queryRaw``}
        AND sc.text_vector @@ plainto_tsquery('english', ${query})
      ORDER BY rank DESC
      LIMIT ${limit}
    `;

    const executionTime = Date.now() - startTime;

    // Save search query for analytics
    await prisma.searchQuery.create({
      data: {
        userId: session.user.id,
        orgId: membership.organizationId,
        matterId: matterId || null,
        queryText: query,
        queryType: 'hybrid',
        resultCount: (searchResults as any[]).length,
        executionMs: executionTime,
      },
    });

    return NextResponse.json({
      query,
      results: searchResults,
      executionTime,
      totalResults: (searchResults as any[]).length,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
