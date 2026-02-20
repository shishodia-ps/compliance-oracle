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

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    const { id } = await params;

    const framework = await prisma.complianceFramework.findFirst({
      where: {
        id,
        organizationId: membership.organizationId,
      },
    });

    if (!framework) {
      return NextResponse.json({ error: 'Framework not found' }, { status: 404 });
    }

    return NextResponse.json({ framework });
  } catch (error) {
    console.error('Compliance framework get error:', error);
    return NextResponse.json({ error: 'Failed to fetch framework' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
    const { name, description, requirements } = body;

    const framework = await prisma.complianceFramework.findFirst({
      where: {
        id,
        organizationId: membership.organizationId,
      },
    });

    if (!framework) {
      return NextResponse.json({ error: 'Framework not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (requirements !== undefined) updateData.requirements = requirements;

    const updated = await prisma.complianceFramework.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ framework: updated });
  } catch (error) {
    console.error('Compliance framework update error:', error);
    return NextResponse.json({ error: 'Failed to update framework' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const framework = await prisma.complianceFramework.findFirst({
      where: {
        id,
        organizationId: membership.organizationId,
      },
    });

    if (!framework) {
      return NextResponse.json({ error: 'Framework not found' }, { status: 404 });
    }

    await prisma.complianceFramework.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Compliance framework delete error:', error);
    return NextResponse.json({ error: 'Failed to delete framework' }, { status: 500 });
  }
}
