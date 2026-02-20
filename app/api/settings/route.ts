import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { notificationSettings: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      name: user.name,
      email: user.email,
      avatar: user.image,
      notifications: {
        email: user.notificationSettings?.emailNotifications ?? true,
        push: true,
        tasks: user.notificationSettings?.riskAlerts ?? true,
        documents: user.notificationSettings?.documentProcessedAlerts ?? true,
        invoices: user.notificationSettings?.weeklyDigest ?? true,
      },
      preferences: {
        theme: 'system',
        language: 'en',
        timezone: 'UTC',
      },
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, notifications, preferences } = body;

    // Update user name if provided
    if (name !== undefined) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { name },
      });
    }

    // Update notification settings if provided
    if (notifications) {
      await prisma.notificationSettings.upsert({
        where: { userId: session.user.id },
        create: {
          userId: session.user.id,
          emailNotifications: notifications.email ?? true,
          riskAlerts: notifications.tasks ?? true,
          documentProcessedAlerts: notifications.documents ?? true,
          weeklyDigest: notifications.invoices ?? true,
        },
        update: {
          emailNotifications: notifications.email ?? true,
          riskAlerts: notifications.tasks ?? true,
          documentProcessedAlerts: notifications.documents ?? true,
          weeklyDigest: notifications.invoices ?? true,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
