import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createMatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'PENDING', 'CLOSED', 'ARCHIVED']).default('ACTIVE'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  tags: z.array(z.string()).default([]),
  dueDate: z.string().datetime().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)));

    const where: any = {
      organization: {
        members: {
          some: {
            userId: session.user.id,
          },
        },
      },
    };

    if (status) {
      where.status = status;
    }

    const [total, matters] = await Promise.all([
      prisma.matter.count({ where }),
      prisma.matter.findMany({
        where,
        include: {
          _count: {
            select: {
              documents: true,
              tasks: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      matters,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching matters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matters' },
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

    const body = await request.json();
    const validatedData = createMatterSchema.parse(body);

    // Get user's organization
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'User not associated with any organization' },
        { status: 400 }
      );
    }

    const matter = await prisma.matter.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        status: validatedData.status,
        priority: validatedData.priority,
        tags: validatedData.tags,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        organizationId: membership.organizationId,
        createdById: session.user.id,
      },
    });

    // Create audit log
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: membership.organizationId,
        action: 'CREATE',
        resourceType: 'matter',
        resourceId: matter.id,
        details: { name: validatedData.name },
      },
    }).catch(e => console.error('Audit log failed:', e));

    return NextResponse.json(matter, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating matter:', error);
    return NextResponse.json(
      { error: 'Failed to create matter' },
      { status: 500 }
    );
  }
}
