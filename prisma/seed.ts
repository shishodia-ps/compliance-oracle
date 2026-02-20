import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create organization
  const organization = await prisma.organization.upsert({
    where: { slug: 'demo-org' },
    update: {},
    create: {
      name: 'Demo Organization',
      slug: 'demo-org',
      description: 'A demo organization for testing',
    },
  });

  console.log('Created organization:', organization.name);

  // Create demo users
  const users = [
    {
      email: 'admin@legalai.demo',
      name: 'Admin User',
      role: UserRole.ADMIN,
      password: 'Admin',
    },
    {
      email: 'manager@legalai.demo',
      name: 'Manager User',
      role: UserRole.MANAGER,
      password: 'demo123',
    },
    {
      email: 'reviewer@legalai.demo',
      name: 'Reviewer User',
      role: UserRole.REVIEWER,
      password: 'demo123',
    },
    {
      email: 'viewer@legalai.demo',
      name: 'Viewer User',
      role: UserRole.VIEWER,
      password: 'demo123',
    },
  ];

  for (const userData of users) {
    const hashedPassword = await hash(userData.password, 12);
    
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        password: hashedPassword,
        name: userData.name,
        role: userData.role,
      },
      create: {
        email: userData.email,
        name: userData.name,
        role: userData.role,
        password: hashedPassword,
      },
    });

    // Add user to organization
    await prisma.organizationMember.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: organization.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        organizationId: organization.id,
        role: userData.role,
      },
    });

    // Create notification settings
    await prisma.notificationSettings.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
      },
    });

    console.log(`Created user: ${user.name} (${user.role})`);
  }

  // Create a sample matter
  const matter = await prisma.matter.upsert({
    where: { id: 'sample-matter-001' },
    update: {},
    create: {
      id: 'sample-matter-001',
      name: 'Sample Matter',
      description: 'A sample matter for demonstration',
      status: 'ACTIVE',
      priority: 'medium',
      tags: ['demo', 'sample'],
      organizationId: organization.id,
      createdById: (await prisma.user.findUnique({ where: { email: 'admin@legalai.demo' } }))!.id,
    },
  });

  console.log('Created sample matter:', matter.name);

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
