import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return NextResponse.json({ notifications: [] });
    }

    // Get recent audit logs as notifications
    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId: membership.organizationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    // Get document names for relevant logs
    const documentIds = logs
      .filter(log => log.resourceType === 'DOCUMENT' && log.resourceId)
      .map(log => log.resourceId as string);

    const documents = documentIds.length > 0 
      ? await prisma.document.findMany({
          where: { id: { in: documentIds } },
          select: { id: true, name: true },
        })
      : [];

    const docMap = new Map(documents.map(d => [d.id, d.name]));

    const notifications = logs.map(log => {
      let message = '';
      let type: 'upload' | 'analysis' | 'user' | 'risk' = 'user';
      const docName = log.resourceId ? docMap.get(log.resourceId) : null;

      switch (log.action) {
        case 'DOCUMENT_UPLOADED':
          message = `New document uploaded: ${docName || 'Untitled'}`;
          type = 'upload';
          break;
        case 'DOCUMENT_ANALYZED':
          message = `Analysis complete for ${docName || 'document'}`;
          type = 'analysis';
          break;
        case 'RISK_DETECTED':
          message = `Risk detected in ${docName || 'document'}`;
          type = 'risk';
          break;
        case 'CLAUSE_EXTRACTED':
          message = `Clauses extracted from ${docName || 'document'}`;
          type = 'analysis';
          break;
        default:
          message = (log.details as any)?.message || `${log.action.replace(/_/g, ' ').toLowerCase()}`;
      }

      return {
        id: log.id,
        type,
        message,
        timestamp: log.createdAt.toISOString(),
        read: log.viewedAt !== null,
      };
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}
