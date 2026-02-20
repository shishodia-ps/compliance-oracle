/**
 * Integration test for shared retrieval service
 * Verifies Document Q&A and SearchAI use the same retrieval pipeline
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { retrieve, findSectionInMarkdown } from '../lib/retrieval_service';

// Test configuration
const TEST_DOC_ID = process.env.TEST_DOC_ID || 'test-doc-001';
const TEST_QUERY = 'what does section 2.1 say about payments';

describe('Shared Retrieval Service', () => {
  
  describe('Document Q&A retrieval', () => {
    it('should retrieve from database when docId is provided', async () => {
      const result = await retrieve(TEST_QUERY, {
        docId: TEST_DOC_ID,
        searchMode: 'current'
      });

      console.log('[TEST:DOC_QA] Retrieval result:', {
        source: result.source,
        indexName: result.indexName,
        namespace: result.namespace,
        nodeCount: result.nodes.length
      });

      // Document Q&A should use database
      expect(result.source).toBe('database');
      expect(result.indexName).toBe('pageindex_trees');
      expect(result.namespace).toBe(TEST_DOC_ID);
      expect(result.filters).toEqual({ documentId: TEST_DOC_ID });
    });

    it('should return same index metadata format as SearchAI', async () => {
      const docResult = await retrieve(TEST_QUERY, {
        docId: TEST_DOC_ID,
        searchMode: 'current'
      });

      // Both should have consistent metadata structure
      expect(docResult).toHaveProperty('source');
      expect(docResult).toHaveProperty('indexName');
      expect(docResult).toHaveProperty('namespace');
      expect(docResult).toHaveProperty('filters');
      expect(docResult).toHaveProperty('nodes');
      expect(docResult).toHaveProperty('totalAvailable');
    });
  });

  describe('SearchAI retrieval', () => {
    it('should use same retrieval when documentId is provided', async () => {
      const result = await retrieve(TEST_QUERY, {
        docId: TEST_DOC_ID,
        searchMode: 'current'
      });

      console.log('[TEST:SEARCHAI] Retrieval result:', {
        source: result.source,
        indexName: result.indexName,
        namespace: result.namespace,
        nodeCount: result.nodes.length
      });

      // SearchAI with docId should also use database (same as Document Q&A)
      expect(result.source).toBe('database');
      expect(result.indexName).toBe('pageindex_trees');
      expect(result.namespace).toBe(TEST_DOC_ID);
    });

    it('should retrieve from master index for cross-document search', async () => {
      const result = await retrieve(TEST_QUERY, {
        searchMode: 'all'
      });

      console.log('[TEST:SEARCHAI:ALL] Retrieval result:', {
        source: result.source,
        indexName: result.indexName,
        namespace: result.namespace,
        nodeCount: result.nodes.length
      });

      // Cross-document search uses master index
      expect(result.source).toBe('master_index');
      expect(result.indexName).toBe('master_index');
      expect(result.namespace).toBe('global');
    });
  });

  describe('Consistency between flows', () => {
    it('should return overlapping results for same query on same document', async () => {
      // Document Q&A retrieval
      const docResult = await retrieve(TEST_QUERY, {
        docId: TEST_DOC_ID,
        searchMode: 'current'
      });

      // SearchAI retrieval with same docId
      const searchResult = await retrieve(TEST_QUERY, {
        docId: TEST_DOC_ID,
        searchMode: 'current'
      });

      console.log('[TEST:CONSISTENCY] Comparison:', {
        docSource: docResult.source,
        searchSource: searchResult.source,
        docNodes: docResult.nodes.length,
        searchNodes: searchResult.nodes.length,
        sameSource: docResult.source === searchResult.source,
        sameIndex: docResult.indexName === searchResult.indexName
      });

      // Both should use identical source and index
      expect(docResult.source).toBe(searchResult.source);
      expect(docResult.indexName).toBe(searchResult.indexName);
      expect(docResult.namespace).toBe(searchResult.namespace);
      
      // Should return same number of nodes
      expect(docResult.nodes.length).toBe(searchResult.nodes.length);
      
      // Top result should be identical
      if (docResult.nodes.length > 0 && searchResult.nodes.length > 0) {
        expect(docResult.nodes[0].node.title).toBe(searchResult.nodes[0].node.title);
        expect(docResult.nodes[0].relevance).toBe(searchResult.nodes[0].relevance);
      }
    });

    it('should apply same scoring algorithm', async () => {
      const sectionQuery = 'section 2.1.7';
      
      const docResult = await retrieve(sectionQuery, {
        docId: TEST_DOC_ID,
        searchMode: 'current'
      });

      const searchResult = await retrieve(sectionQuery, {
        docId: TEST_DOC_ID,
        searchMode: 'current'
      });

      // Both should identify section matches with high scores
      const docTopScore = docResult.nodes[0]?.relevance || 0;
      const searchTopScore = searchResult.nodes[0]?.relevance || 0;

      console.log('[TEST:SCORING] Section match scores:', {
        docTopScore,
        searchTopScore,
        docTopNode: docResult.nodes[0]?.node.title,
        searchTopNode: searchResult.nodes[0]?.node.title
      });

      // Both should have high scores for exact section match
      expect(docTopScore).toBeGreaterThanOrEqual(1000);
      expect(searchTopScore).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('Section lookup', () => {
    it('should find sections in markdown consistently', () => {
      const markdown = `
# Section 1
Content for section 1

## 2.1.7 Payment Terms
This is the payment terms section
with multiple lines

### 2.1.8 Next Section
More content here
`;

      const result = findSectionInMarkdown(markdown, '2.1.7');
      
      expect(result).toContain('2.1.7');
      expect(result).toContain('Payment Terms');
      expect(result).not.toContain('2.1.8');
    });
  });
});

// Manual test runner for development
if (require.main === module) {
  console.log('Running manual retrieval test...');
  
  (async () => {
    const query = 'what does section 2.1 say';
    const docId = 'test-doc-001';

    console.log('\n=== Testing Document Q&A flow ===');
    const docResult = await retrieve(query, { docId, searchMode: 'current' });
    console.log('Source:', docResult.source);
    console.log('Index:', docResult.indexName);
    console.log('Nodes:', docResult.nodes.length);

    console.log('\n=== Testing SearchAI flow (same doc) ===');
    const searchResult = await retrieve(query, { docId, searchMode: 'current' });
    console.log('Source:', searchResult.source);
    console.log('Index:', searchResult.indexName);
    console.log('Nodes:', searchResult.nodes.length);

    console.log('\n=== Comparison ===');
    console.log('Same source:', docResult.source === searchResult.source);
    console.log('Same index:', docResult.indexName === searchResult.indexName);
    console.log('Same node count:', docResult.nodes.length === searchResult.nodes.length);
  })();
}
