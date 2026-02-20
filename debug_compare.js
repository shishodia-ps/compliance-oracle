// Debug script to check document content
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debug() {
  const docs = await prisma.document.findMany({
    where: { status: 'ANALYZED' },
    take: 2,
    include: { extractionData: true }
  });
  
  if (docs.length < 2) {
    console.log('Need 2 analyzed documents');
    return;
  }
  
  const [doc1, doc2] = docs;
  
  console.log('=== DOCUMENT 1 ===');
  console.log('Name:', doc1.name);
  console.log('Markdown length:', doc1.extractionData?.markdown?.length || 0);
  console.log('First 500 chars:');
  console.log(doc1.extractionData?.markdown?.substring(0, 500));
  
  console.log('\n=== DOCUMENT 2 ===');
  console.log('Name:', doc2.name);
  console.log('Markdown length:', doc2.extractionData?.markdown?.length || 0);
  console.log('First 500 chars:');
  console.log(doc2.extractionData?.markdown?.substring(0, 500));
  
  // Extract headings
  const md1 = doc1.extractionData?.markdown || '';
  const headings1 = md1.match(/^#{1,6}\s+.+$/gm) || [];
  
  const md2 = doc2.extractionData?.markdown || '';
  const headings2 = md2.match(/^#{1,6}\s+.+$/gm) || [];
  
  console.log('\n=== HEADINGS IN DOC 1 ===');
  headings1.slice(0, 10).forEach(h => console.log(h));
  
  console.log('\n=== HEADINGS IN DOC 2 ===');
  headings2.slice(0, 10).forEach(h => console.log(h));
  
  await prisma.$disconnect();
}

debug();
