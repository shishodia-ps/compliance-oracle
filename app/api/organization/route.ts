import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/organization
 * Get current user's organization details
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      include: {
        organization: {
          include: {
            _count: {
              select: {
                members: true,
                documents: true,
                matters: true,
              },
            },
          },
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    return NextResponse.json({
      organization: membership.organization,
      membership: {
        role: membership.role,
        joinedAt: membership.joinedAt,
      },
    });
  } catch (error) {
    console.error('Organization fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/organization
 * Update organization details (Admin only)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    // Only ADMIN and MANAGER can update organization
    if (!['ADMIN', 'MANAGER'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only admins can update organization details.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, website, logo } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (website !== undefined) updateData.website = website;
    if (logo !== undefined) updateData.logo = logo;

    const organization = await prisma.organization.update({
      where: { id: membership.organizationId },
      data: updateData,
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: membership.organizationId,
        action: 'ORGANIZATION_UPDATED',
        resourceType: 'organization',
        resourceId: organization.id,
        details: { updatedFields: Object.keys(updateData) },
      },
    });

    return NextResponse.json({ organization });
  } catch (error) {
    console.error('Organization update error:', error);
    return NextResponse.json(
      { error: 'Failed to update organization' },
      { status: 500 }
    );
  }
}
