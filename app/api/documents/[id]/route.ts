import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { unlink } from 'fs/promises';

function cleanText(text: any): string {
  if (!text) return '';
  let str = String(text);
  str = str.replace(/Markdown\(pages=\[[\s\S]*?\]\)/g, '');
  str = str.replace(/Text\(pages=\[[\s\S]*?\]\)/g, '');
  str = str.replace(/MarkdownPageMarkdownResultPage\([^)]*\)/g, '');
  str = str.replace(/TextPage\([^)]*\)/g, '');
  const mdMatch = str.match(/markdown='([^']+)'/);
  if (mdMatch) return mdMatch[1].replace(/\\n/g, '\n');
  const textMatch = str.match(/text='([^']+)'/);
  if (textMatch) return textMatch[1].replace(/\\n/g, '\n');
  return str.replace(/\\n/g, '\n').trim();
}

/**
 * GET /api/documents/[id]
 * Get document details with summary, extractions, and risks
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
        matter: {
          select: { name: true },
        },
        extractionData: true,
        summary: true,
        risks: {
          orderBy: { createdAt: 'desc' },
        },
        extractions: {
          orderBy: { confidence: 'desc' },
          take: 10,
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Clean summary data if it contains Python object strings
    if (document.summary?.summary) {
      document.summary.summary = cleanText(document.summary.summary);
    }
    if (document.summary?.keyPoints) {
      document.summary.keyPoints = document.summary.keyPoints.map(cleanText);
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error('Document fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents/[id]
 * Delete a document and its file
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get user's organization
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    // Get document with storage key
    const document = await prisma.document.findFirst({
      where: {
        id,
        organizationId: membership.organizationId,
      },
      select: {
        id: true,
        storageKey: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Delete file from disk
    try {
      await unlink(document.storageKey);
    } catch (fileError) {
      console.log('File already deleted or not found');
    }

    // Delete from database (cascade will handle related records)
    await prisma.document.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Document delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
