import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const queries = await prisma.searchQuery.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        queryText: true,
        queryType: true,
        resultCount: true,
        executionMs: true,
        createdAt: true,
        matterId: true,
      },
    });

    const total = await prisma.searchQuery.count({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ queries, total, limit, offset });
  } catch (error) {
    console.error('Search history error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch search history' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    const body = await request.json();
    const { queryText, queryType = 'hybrid', matterId, filters, resultCount, executionMs } = body;

    if (!queryText) {
      return NextResponse.json({ error: 'Query text required' }, { status: 400 });
    }

    const query = await prisma.searchQuery.create({
      data: {
        userId: session.user.id,
        matterId: matterId || null,
        orgId: membership?.organizationId || null,
        queryText,
        queryType,
        filters: filters || {},
        resultCount: resultCount || 0,
        executionMs: executionMs || null,
      },
    });

    return NextResponse.json({ query }, { status: 201 });
  } catch (error) {
    console.error('Search history save error:', error);
    return NextResponse.json({ error: 'Failed to save search' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryId = searchParams.get('id');

    if (queryId) {
      await prisma.searchQuery.deleteMany({
        where: { id: queryId, userId: session.user.id },
      });
    } else {
      await prisma.searchQuery.deleteMany({
        where: { userId: session.user.id },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Search history delete error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
