import { GET as getSummary } from './app/api/documents/[id]/summary/route';
import { NextRequest } from 'next/server';
import { db } from './lib/db';
import { sql } from 'drizzle-orm';
import { getServerSession } from 'next-auth';

// Mock getServerSession
jest.mock('next-auth', () => ({
  getServerSession: () => Promise.resolve({ user: { id: 'cmlz9whfz0001aw1p68vslvho' } })
}));

async function testSummaryAPI() {
  try {
    const docs = await db.execute(sql`SELECT id FROM documents ORDER BY created_at DESC LIMIT 1`);
    if (docs.length === 0) return console.log('No docs');
    
    const docId = docs[0].id;
    console.log('Testing summary API for doc:', docId);

    const req = new NextRequest(`http://localhost:3000/api/documents/${docId}/summary`);
    
    // Call the GET endpoint
    const response = await getSummary(req, { params: Promise.resolve({ id: docId }) });
    
    const json = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(json, null, 2));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}
testSummaryAPI();
