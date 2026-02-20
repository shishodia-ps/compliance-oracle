const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function fixAll() {
  console.log('🔧 FIXING EVERYTHING...\n');

  // ============================================
  // STEP 1: Create Organization
  // ============================================
  console.log('📋 Step 1: Creating organization...');
  let org = await prisma.organization.findFirst({ where: { slug: 'demo-org' } });
  
  if (!org) {
    try {
      org = await prisma.organization.create({
        data: {
          id: 'org_001',
          name: 'Demo Organization',
          slug: 'demo-org',
        }
      });
      console.log('  ✅ Created organization: org_001');
    } catch (e) {
      // If creation fails, try to find it again
      org = await prisma.organization.findFirst();
      if (org) {
        console.log(`  ✅ Using existing organization: ${org.name} (${org.id})`);
      }
    }
  } else {
    console.log(`  ✅ Organization already exists: ${org.name} (${org.id})`);
  }

  // ============================================
  // STEP 2: Find and Fix User
  // ============================================
  console.log('\n📋 Step 2: Finding user...');
  
  // Get most recent user (likely the Google login user)
  const recentUser = await prisma.user.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  if (!recentUser) {
    console.log('  ❌ No users found. Please login first.');
    return;
  }

  console.log(`  Found user: ${recentUser.name || recentUser.email} (${recentUser.id})`);

  // Check if user has organization membership
  const existingMembership = await prisma.organizationMember.findFirst({
    where: { userId: recentUser.id }
  });

  if (!existingMembership) {
    await prisma.organizationMember.create({
      data: {
        userId: recentUser.id,
        organizationId: org.id,
        role: 'ADMIN'
      }
    });
    console.log('  ✅ Linked user to organization as ADMIN');
  } else {
    console.log('  ✅ User already linked to organization');
  }

  // ============================================
  // STEP 3: Restore Documents from Data Folder
  // ============================================
  console.log('\n📋 Step 3: Restoring documents...');
  
  const dataDir = path.join(__dirname, 'data');
  const uploadsDir = path.join(__dirname, 'uploads', 'org_001');

  if (!fs.existsSync(dataDir)) {
    console.log('  ⚠️  Data directory not found');
  } else if (!fs.existsSync(uploadsDir)) {
    console.log('  ⚠️  Uploads directory not found');
  } else {
    const dataFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('_parse.json'));
    const uploadFiles = fs.readdirSync(uploadsDir);
    
    let restoredCount = 0;
    
    for (const parseFile of dataFiles) {
      const baseName = parseFile.replace('_parse.json', '');
      const treeFile = `${baseName}_tree.json`;
      
      if (!fs.existsSync(path.join(dataDir, treeFile))) continue;
      
      const parseData = JSON.parse(fs.readFileSync(path.join(dataDir, parseFile), 'utf8'));
      const treeData = JSON.parse(fs.readFileSync(path.join(dataDir, treeFile), 'utf8'));
      const originalFileName = parseData.file_name || `${baseName}.pdf`;
      
      // Find matching upload file
      const matchingFile = uploadFiles.find(f => 
        f.toLowerCase().endsWith(originalFileName.toLowerCase()) ||
        f.toLowerCase().includes(baseName.toLowerCase())
      );
      
      if (!matchingFile) continue;
      
      // Check if already exists
      const existing = await prisma.document.findFirst({
        where: { fileName: originalFileName }
      });
      
      if (existing) continue;
      
      try {
        // Create document
        const doc = await prisma.document.create({
          data: {
            name: originalFileName,
            fileName: originalFileName,
            fileType: originalFileName.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            fileSize: parseData.metadata?.file_size || 0,
            storageKey: `uploads/org_001/${matchingFile}`,
            status: 'ANALYZED',
            documentType: 'CONTRACT',
            organizationId: org.id,
            processedAt: new Date(),
          }
        });
        
        // Create extraction
        await prisma.documentExtraction.create({
          data: {
            documentId: doc.id,
            content: parseData.text || '',
            markdown: parseData.markdown || '',
            extractedAt: new Date(),
          }
        });
        
        // Create tree
        await prisma.pageIndexTree.create({
          data: {
            documentId: doc.id,
            treeData: treeData.tree || treeData,
            metadata: treeData.metadata || {},
          }
        });
        
        // Create summary
        const docDesc = treeData.tree?.doc_description || `${originalFileName} has been analyzed.`;
        const keyPoints = treeData.tree?.nodes?.slice(0, 5).map(n => n.title || 'Section').filter(Boolean) || ['Document analyzed'];
        
        await prisma.documentSummary.create({
          data: {
            documentId: doc.id,
            summary: docDesc,
            keyPoints: keyPoints,
            risks: treeData.risks || [],
            metadata: { source: 'restored' },
          }
        });
        
        restoredCount++;
        console.log(`  ✅ Restored: ${originalFileName}`);
        
      } catch (e) {
        console.log(`  ❌ Error: ${originalFileName} - ${e.message}`);
      }
    }
    
    if (restoredCount === 0) {
      console.log('  ℹ️  No documents to restore (already exist or no matching files)');
    } else {
      console.log(`  ✅ Restored ${restoredCount} documents`);
    }
  }

  // ============================================
  // STEP 4: Create Demo Matter
  // ============================================
  console.log('\n📋 Step 4: Creating demo matter...');
  
  const existingMatter = await prisma.matter.findFirst({
    where: { name: 'General Matter' }
  });

  if (!existingMatter) {
    await prisma.matter.create({
      data: {
        name: 'General Matter',
        description: 'Default matter for documents',
        status: 'ACTIVE',
        organizationId: org.id,
        createdById: recentUser.id,
      }
    });
    console.log('  ✅ Created demo matter');
  } else {
    console.log('  ✅ Demo matter already exists');
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 ALL FIXES COMPLETE!');
  console.log('='.repeat(50));
  console.log('\n✅ You can now:');
  console.log('   1. Refresh http://localhost:3000/app/documents');
  console.log('   2. Upload new PDFs');
  console.log('   3. View restored documents\n');

  await prisma.$disconnect();
}

fixAll().catch(e => {
  console.error('❌ Fatal error:', e);
  process.exit(1);
});
