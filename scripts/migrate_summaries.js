/**
 * Migration Script: Update document_summaries from pageindex_trees
 *
 * This script reads the AI-generated summaries from pageindex_trees
 * and properly populates the document_summaries table.
 *
 * Run with: node scripts/migrate_summaries.js
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

function extractKeyPoints(treeData) {
  const keyPoints = [];
  const nodes = treeData.nodes || [];

  for (const node of nodes.slice(0, 8)) {
    const title = node.title || '';
    const summary = node.summary || node.prefix_summary || '';

    if (title && title.length > 5) {
      if (summary && summary.length > 20) {
        keyPoints.push(`${title}: ${summary.slice(0, 150)}`);
      } else {
        keyPoints.push(title);
      }
    }
  }

  return keyPoints.slice(0, 6);
}

function collectSearchChunks(treeData, docId, orgId, matterId) {
  const chunks = [];

  function traverse(node, path, level = 0) {
    if (level > 6) return;

    const title = node.title || '';
    const text = node.text || node.content || node.summary || '';
    const nodeId = node.node_id || node.id || '';

    if (text && text.length > 30) {
      const sectionPath = path.concat(title).filter(Boolean).join(' > ').slice(0, 500);
      const sectionMatch = title.match(/^(\d+(?:\.\d+)*)/);
      const sectionNumber = sectionMatch ? sectionMatch[1] : null;
      const contentHash = crypto.createHash('md5').update(text).digest('hex').slice(0, 16);

      chunks.push({
        docId,
        orgId,
        matterId: matterId || docId,
        chunkId: nodeId || contentHash,
        sectionPath,
        sectionNumber,
        text: text.slice(0, 10000),
        chunkType: node.nodes ? 'section' : 'paragraph',
        level,
        path: path.concat(title).filter(Boolean),
        treeNodeId: nodeId,
        hash: contentHash,
      });
    }

    for (const child of (node.nodes || [])) {
      traverse(child, title ? path.concat(title) : path, level + 1);
    }
  }

  for (const node of (treeData.nodes || [])) {
    traverse(node, [], 0);
  }

  return chunks;
}

async function main() {
  console.log('='.repeat(70));
  console.log('Migration: Update document_summaries from pageindex_trees');
  console.log('='.repeat(70));
  console.log('');

  // Get all documents with pageindex_trees
  const trees = await prisma.$queryRaw`
    SELECT
      pt.document_id,
      pt.tree_data,
      d.name as doc_name,
      d.organization_id as org_id,
      d.matter_id
    FROM pageindex_trees pt
    JOIN documents d ON pt.document_id = d.id
  `;

  console.log(`Found ${trees.length} documents with PageIndex trees\n`);

  for (const tree of trees) {
    const docId = tree.document_id;
    const docName = tree.doc_name;
    const treeData = tree.tree_data;
    const orgId = tree.org_id;
    const matterId = tree.matter_id;

    console.log(`Processing: ${docName}`);
    console.log(`  Document ID: ${docId.slice(0, 12)}...`);

    // Extract doc_description from tree
    let summary = treeData.doc_description || '';

    if (!summary || summary.length < 20) {
      const docNameFromTree = treeData.doc_name || docName;
      const nodes = treeData.nodes || [];
      if (nodes.length > 0) {
        const titles = nodes.slice(0, 5).map(n => n.title).filter(Boolean);
        summary = `This document '${docNameFromTree}' covers the following topics: ${titles.join(', ')}.`;
      } else {
        summary = `Document '${docNameFromTree}' has been analyzed and indexed.`;
      }
    }

    // Extract key points
    const keyPoints = extractKeyPoints(treeData);
    if (keyPoints.length === 0) {
      keyPoints.push('Document structure analyzed', 'Content indexed for search');
    }

    // Get risks from tree
    const risks = treeData.risks || [];

    console.log(`  Summary: ${summary.slice(0, 60)}...`);
    console.log(`  Key Points: ${keyPoints.length}`);
    console.log(`  Risks: ${risks.length}`);

    // Update document_summaries
    await prisma.$executeRaw`
      INSERT INTO document_summaries (id, document_id, summary, key_points, risks, metadata, created_at, updated_at)
      VALUES (gen_random_uuid()::text, ${docId}, ${summary}, ${keyPoints}, ${JSON.stringify(risks)}::jsonb, '{"source": "migration"}'::jsonb, NOW(), NOW())
      ON CONFLICT (document_id) DO UPDATE SET
        summary = EXCLUDED.summary,
        key_points = EXCLUDED.key_points,
        risks = EXCLUDED.risks,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `;

    console.log(`  ✓ Summary updated`);

    // Create document_indexes entry
    await prisma.$executeRaw`
      INSERT INTO document_indexes (id, document_id, matter_id, indexed_at, model_used, created_at, updated_at)
      VALUES (gen_random_uuid()::text, ${docId}, ${matterId || docId}, NOW(), 'kimi-k2.5', NOW(), NOW())
      ON CONFLICT (document_id) DO UPDATE SET
        indexed_at = NOW(),
        updated_at = NOW()
    `;

    // Delete existing search chunks for this document
    await prisma.$executeRaw`DELETE FROM search_chunks WHERE document_id = ${docId}`;

    // Collect and insert search chunks
    const chunks = collectSearchChunks(treeData, docId, orgId, matterId);

    for (const chunk of chunks) {
      try {
        // Convert path array to PostgreSQL array literal
        const pathArray = `{${chunk.path.map(p => `"${p.replace(/"/g, '\\"')}"`).join(',')}}`;

        await prisma.$executeRawUnsafe(`
          INSERT INTO search_chunks (
            id, document_id, matter_id, org_id, chunk_id,
            section_path, section_number, text, text_vector, embedding,
            chunk_type, level, path, tree_node_id, hash, pipeline_version,
            created_at, updated_at
          ) VALUES (
            gen_random_uuid()::text, $1, $2, $3, $4,
            $5, $6, $7, to_tsvector('english', $7), ARRAY[]::float8[],
            $8, $9, $10::text[], $11, $12, '1.0.0',
            NOW(), NOW()
          )
        `,
          chunk.docId,
          chunk.matterId,
          chunk.orgId,
          chunk.chunkId,
          chunk.sectionPath,
          chunk.sectionNumber,
          chunk.text,
          chunk.chunkType,
          chunk.level,
          pathArray,
          chunk.treeNodeId,
          chunk.hash
        );
      } catch (e) {
        console.log(`    Warning: Chunk insert failed: ${e.message.slice(0, 80)}`);
      }
    }

    console.log(`  ✓ Indexed ${chunks.length} search chunks`);
    console.log('');
  }

  console.log('='.repeat(70));
  console.log('Migration complete!');
  console.log('='.repeat(70));

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
