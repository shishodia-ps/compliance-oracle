const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixUserOrg() {
  // Get your Google email (the one you're logged in with)
  const yourEmail = process.argv[2] || 'reply.shishodia@gmail.com';
  
  console.log(`Fixing organization for: ${yourEmail}\n`);
  
  try {
    // Find your user
    const user = await prisma.user.findUnique({
      where: { email: yourEmail }
    });
    
    if (!user) {
      console.log('❌ User not found. Make sure you login with Google first.');
      return;
    }
    
    console.log(`Found user: ${user.name} (${user.id})`);
    
    // Find or create organization
    let org = await prisma.organization.findFirst({
      where: { id: 'org_001' }
    });
    
    if (!org) {
      console.log('Creating organization org_001...');
      org = await prisma.organization.create({
        data: {
          id: 'org_001',
          name: 'Demo Organization',
          slug: 'demo-org',
        }
      });
    }
    
    console.log(`Organization: ${org.name} (${org.id})`);
    
    // Check if already member
    const existingMembership = await prisma.organizationMember.findFirst({
      where: {
        userId: user.id,
        organizationId: org.id
      }
    });
    
    if (existingMembership) {
      console.log('✅ User is already a member of this organization');
      return;
    }
    
    // Add user to organization
    await prisma.organizationMember.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: 'ADMIN'
      }
    });
    
    console.log(`✅ Successfully linked ${yourEmail} to ${org.name} as ADMIN`);
    console.log('\n🎉 Now try uploading again!');
    
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixUserOrg();