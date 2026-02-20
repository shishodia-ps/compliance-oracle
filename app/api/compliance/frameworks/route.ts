import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/compliance/frameworks
 * List compliance frameworks for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    const frameworks = await prisma.complianceFramework.findMany({
      where: {
        organizationId: membership.organizationId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ frameworks });
  } catch (error) {
    console.error('Compliance frameworks list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch frameworks' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/compliance/frameworks
 * Create a new compliance framework
 */
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

    if (!membership) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    const body = await request.json();
    const { name, description, requirements } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const framework = await prisma.complianceFramework.create({
      data: {
        organizationId: membership.organizationId,
        name,
        description: description || '',
        requirements: requirements || [],
      },
    });

    return NextResponse.json({ framework }, { status: 201 });
  } catch (error) {
    console.error('Compliance framework creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create framework' },
      { status: 500 }
    );
  }
}
