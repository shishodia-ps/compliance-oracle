import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    // Check organization membership
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 400 }
      );
    }

    // Verify matter belongs to organization
    const matter = await prisma.matter.findFirst({
      where: {
        id,
        organizationId: membership.organizationId,
      },
    });

    if (!matter) {
      return NextResponse.json({ error: 'Matter not found' }, { status: 404 });
    }

    // Get documents with extractions for this matter
    const documents = await prisma.document.findMany({
      where: {
        matterId: id,
        organizationId: membership.organizationId,
      },
      include: {
        extractions: true,
        extractionData: true,
      },
    });

    // Build graph data from document extractions
    const nodes: any[] = [];
    const links: any[] = [];
    const nodeMap = new Map<string, boolean>();

    // Add document nodes
    documents.forEach((doc) => {
      nodes.push({
        id: doc.id,
        name: doc.name,
        type: 'document',
        val: 20,
        color: '#f59e0b',
        description: `Document: ${doc.fileName}`,
      });
      nodeMap.set(doc.id, true);

      // Add extraction nodes and links
      doc.extractions.forEach((extraction) => {
        const extractionId = `extraction-${extraction.id}`;
        
        // Create extraction node
        if (!nodeMap.has(extractionId)) {
          nodes.push({
            id: extractionId,
            name: extraction.clauseType,
            type: 'clause',
            val: 10,
            color: '#10b981',
            description: extraction.content.slice(0, 100) + '...',
          });
          nodeMap.set(extractionId, true);
        }

        // Link document to extraction
        links.push({
          source: doc.id,
          target: extractionId,
          type: 'contains',
          value: 2,
        });
      });

      // Parse extraction data for entities (if available)
      if (doc.extractionData?.items) {
        try {
          const items = Array.isArray(doc.extractionData.items)
            ? doc.extractionData.items
            : [];
          
          items.forEach((item: any, idx: number) => {
            if (item.type && item.text) {
              const entityId = `entity-${doc.id}-${idx}`;
              
              if (!nodeMap.has(entityId)) {
                nodes.push({
                  id: entityId,
                  name: item.text.slice(0, 50),
                  type: item.type || 'entity',
                  val: 8,
                  color: '#3b82f6',
                  description: `${item.type}: ${item.text.slice(0, 100)}`,
                });
                nodeMap.set(entityId, true);
              }

              links.push({
                source: doc.id,
                target: entityId,
                type: 'mentions',
                value: 1,
              });
            }
          });
        } catch (e) {
          console.log('Failed to parse extraction data for graph');
        }
      }
    });

    // If no graph data, return empty
    if (nodes.length === 0) {
      return NextResponse.json({ nodes: [], links: [] });
    }

    return NextResponse.json({ nodes, links });
  } catch (error) {
    console.error('Error generating graph:', error);
    return NextResponse.json(
      { error: 'Failed to generate graph' },
      { status: 500 }
    );
  }
}
