const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const docs = await prisma.document.findMany({
    where: { status: 'ANALYZED' },
    take: 2,
    include: { extractionData: true }
  });
  
  docs.forEach(d => {
    console.log('Document:', d.name);
    console.log('Markdown length:', d.extractionData?.markdown?.length || 0);
    console.log('First 200 chars:', d.extractionData?.markdown?.substring(0, 200));
    console.log('Has # headings?', d.extractionData?.markdown?.includes('#'));
    console.log('---');
  });
  
  await prisma.$disconnect();
}

check();
