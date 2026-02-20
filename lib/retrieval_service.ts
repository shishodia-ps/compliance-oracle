/**
 * Shared Retrieval Service
 * Unified retrieval layer for Document Q&A and SearchAI
 * Both flows use the same data sources through this service
 */

import { prisma } from './prisma';
import { promises as fs } from 'fs';
import path from 'path';
import { safeGet, safeSet } from './redis';

// Logger configuration
const DEBUG = process.env.DEBUG_RETRIEVAL === 'true';

function log(level: 'info' | 'debug' | 'warn' | 'error', message: string, data?: any) {
  const prefix = `[RETRIEVAL:${level.toUpperCase()}]`;
  if (level === 'debug' && !DEBUG) return;
  
  if (data) {
    console.log(prefix, message, JSON.stringify(data, null, 2));
  } else {
    console.log(prefix, message);
  }
}

// Types
export interface TreeNode {
  id?: string;
  title?: string;
  content?: string;
  summary?: string;
  nodes?: TreeNode[];
  text?: string;
  prefix_summary?: string;
}

export interface RetrievedNode {
  documentId: string;
  documentName: string;
  path: string;
  node: TreeNode;
  relevance: number;
  reasoning: string;
}

export interface RetrievalContext {
  docId?: string;
  sessionId?: string;
  organizationId?: string;
  searchMode?: 'current' | 'all';
}

export interface RetrievalResult {
  nodes: RetrievedNode[];
  markdown?: string;
  extractionId?: string;
  source: 'database' | 'master_index' | 'combined' | 'none';
  indexName: string;
  namespace: string;
  filters: Record<string, any>;
  totalAvailable: number;
  query: string;
  cached?: boolean;
}

interface MasterIndex {
  version: string;
  created_at: string;
  document_count: number;
  books: Array<{
    book_name: string;
    file_name: string;
    hash: string;
    tree: TreeNode;
  }>;
  root: TreeNode;
}

interface PageIndexTreeDB {
  document_id: string;
  tree_data: any;
  metadata?: any;
}

interface DocumentExtractionDB {
  document_id: string;
  markdown: string;
  content?: string;
}

/**
 * In-memory cache for master index
 */
let _masterIndexCache: MasterIndex | null = null;
let _masterIndexCacheTime = 0;
const MASTER_INDEX_TTL_MS = 60_000; // 60 seconds

/**
 * In-memory cache for database trees
 */
let _dbTreesCache: RetrievedNode[] | null = null;
let _dbTreesCacheTime = 0;
const DB_TREES_TTL_MS = 120_000; // 2 minutes

/**
 * Cache for scored results by query
 */
const _queryCache = new Map<string, { nodes: RetrievedNode[]; time: number }>();
const QUERY_CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Load master index from disk with caching
 */
async function loadMasterIndex(): Promise<MasterIndex | null> {
  const now = Date.now();
  
  // Check memory cache first
  if (_masterIndexCache && (now - _masterIndexCacheTime) < MASTER_INDEX_TTL_MS) {
    log('debug', 'Master index served from memory cache');
    return _masterIndexCache;
  }

  // Check Redis cache
  try {
    const cached = await safeGet('retrieval:master_index');
    if (cached) {
      const index = JSON.parse(cached);
      _masterIndexCache = index;
      _masterIndexCacheTime = now;
      log('debug', 'Master index served from Redis cache');
      return index;
    }
  } catch (e) {
    log('debug', 'Redis cache miss for master index');
  }

  // Load from disk
  try {
    const masterPath = path.join(process.cwd(), 'master_index.json');
    
    // Check file size before loading
    const stats = await fs.stat(masterPath).catch(() => null);
    if (stats && stats.size > 100 * 1024 * 1024) { // 100MB
      log('warn', 'Master index file too large, skipping', { size: stats.size });
      return null;
    }
    
    const content = await fs.readFile(masterPath, 'utf-8');
    const index = JSON.parse(content);

    // Update caches
    _masterIndexCache = index;
    _masterIndexCacheTime = now;
    await safeSet('retrieval:master_index', content, 300); // 5 min Redis cache

    log('debug', 'Master index loaded from disk and cached', {
      documentCount: index.document_count,
      path: masterPath
    });
    return index;
  } catch (e) {
    log('warn', 'Failed to load master index from disk', { error: String(e) });
    return null;
  }
}

/**
 * Load tree from database with caching
 */
async function loadTreeFromDB(documentId: string): Promise<TreeNode | null> {
  // Check Redis cache first
  const cacheKey = `retrieval:tree:${documentId}`;
  try {
    const cached = await safeGet(cacheKey);
    if (cached) {
      log('debug', 'Tree served from Redis cache', { documentId });
      return JSON.parse(cached);
    }
  } catch (e) {
    // Cache miss, continue to DB
  }

  try {
    log('debug', 'Loading tree from database', { documentId });
    
    const treeRecord = await prisma.$queryRaw<PageIndexTreeDB[]>`
      SELECT document_id, tree_data, metadata 
      FROM pageindex_trees 
      WHERE document_id = ${documentId}
      LIMIT 1
    `;

    if (!treeRecord || treeRecord.length === 0) {
      log('warn', 'No tree found in database', { documentId });
      return null;
    }

    const tree = treeRecord[0].tree_data as TreeNode;
    
    // Cache in Redis
    await safeSet(cacheKey, JSON.stringify(tree), 600); // 10 min cache

    log('info', 'Tree loaded from database and cached', { 
      documentId,
      hasNodes: !!tree?.nodes,
      nodeCount: tree?.nodes?.length || 0
    });

    return tree;
  } catch (e) {
    log('error', 'Failed to load tree from database', { documentId, error: String(e) });
    return null;
  }
}

/**
 * Load markdown extraction from database with caching
 */
async function loadExtractionFromDB(documentId: string): Promise<DocumentExtractionDB | null> {
  // Check Redis cache first
  const cacheKey = `retrieval:extraction:${documentId}`;
  try {
    const cached = await safeGet(cacheKey);
    if (cached) {
      log('debug', 'Extraction served from Redis cache', { documentId });
      return JSON.parse(cached);
    }
  } catch (e) {
    // Cache miss, continue to DB
  }

  try {
    log('debug', 'Loading extraction from database', { documentId });
    
    const extraction = await prisma.$queryRaw<DocumentExtractionDB[]>`
      SELECT document_id, markdown, content 
      FROM document_extractions 
      WHERE document_id = ${documentId}
      LIMIT 1
    `;

    if (!extraction || extraction.length === 0) {
      log('warn', 'No extraction found in database', { documentId });
      return null;
    }

    // Cache in Redis (limit size)
    const result = extraction[0];
    if (result.markdown && result.markdown.length < 10 * 1024 * 1024) { // < 10MB
      await safeSet(cacheKey, JSON.stringify(result), 600); // 10 min cache
    }

    const markdownLength = result.markdown?.length || 0;
    log('info', 'Extraction loaded from database', { 
      documentId,
      markdownLength,
      hasContent: !!result.content
    });

    return result;
  } catch (e) {
    log('error', 'Failed to load extraction from database', { documentId, error: String(e) });
    return null;
  }
}

/**
 * Collect all nodes from tree with paths
 */
function collectNodesFromTree(
  tree: TreeNode, 
  documentId: string, 
  documentName: string
): RetrievedNode[] {
  const allNodes: RetrievedNode[] = [];
  
  function traverse(node: TreeNode, currentPath: string = '', depth: number = 0) {
    if (depth > 10) return;
    
    const pathStr = currentPath 
      ? `${currentPath} > ${node.title || 'Section'}` 
      : (node.title || documentName);
    
    allNodes.push({
      documentId,
      documentName,
      path: pathStr,
      node,
      relevance: 0,
      reasoning: '',
    });
    
    const children = node.nodes || [];
    for (const child of children) {
      traverse(child, pathStr, depth + 1);
    }
  }
  
  if (tree.nodes) {
    for (const node of tree.nodes) {
      traverse(node);
    }
  }
  
  return allNodes;
}

/**
 * Collect all nodes from all documents in master index
 */
function collectAllNodesFromMaster(masterIndex: MasterIndex): RetrievedNode[] {
  const allNodes: RetrievedNode[] = [];
  
  for (const book of masterIndex.books) {
    const nodes = collectNodesFromTree(book.tree, book.hash, book.file_name);
    allNodes.push(...nodes);
  }
  
  return allNodes;
}

/**
 * Score nodes based on query relevance
 */
function scoreNodes(nodes: RetrievedNode[], query: string): RetrievedNode[] {
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 3 && !['what', 'does', 'this', 'the', 'and', 'about', 'section'].includes(t));
  
  // Extract section numbers
  const sectionMatches = queryLower.match(/(\d+(?:\.\d+)+)/g) || [];
  
  log('debug', 'Scoring nodes', { 
    queryTerms, 
    sectionMatches, 
    totalNodes: nodes.length 
  });

  return nodes.map(item => {
    let score = 0;
    const reasoning: string[] = [];
    
    const titleLower = (item.node.title || '').toLowerCase();
    const contentLower = (item.node.content || item.node.text || '').toLowerCase();
    const summaryLower = (item.node.summary || '').toLowerCase();
    const pathLower = item.path.toLowerCase();
    const prefixSummaryLower = (item.node.prefix_summary || '').toLowerCase();
    
    // Section number match (highest priority)
    for (const sectionRef of sectionMatches) {
      if (titleLower.includes(sectionRef) || pathLower.includes(sectionRef)) {
        score += 1000;
        reasoning.push(`Exact section: ${sectionRef}`);
      }
    }
    
    // Title matches
    for (const term of queryTerms) {
      if (titleLower.includes(term)) {
        score += 50;
        reasoning.push(`Title: ${term}`);
      }
    }
    
    // Content matches
    let contentMatchCount = 0;
    for (const term of queryTerms) {
      const matches = (contentLower.match(new RegExp(term, 'g')) || []).length;
      contentMatchCount += matches;
    }
    if (contentMatchCount > 0) {
      score += Math.min(contentMatchCount * 5, 50);
      reasoning.push(`Content: ${contentMatchCount} matches`);
    }
    
    // Summary matches
    for (const term of queryTerms) {
      if (summaryLower.includes(term)) {
        score += 25;
        reasoning.push(`Summary: ${term}`);
      }
      if (prefixSummaryLower.includes(term)) {
        score += 20;
        reasoning.push(`Prefix: ${term}`);
      }
    }
    
    return {
      ...item,
      relevance: score,
      reasoning: reasoning.join(', ') || 'General match',
    };
  }).filter(n => n.relevance > 0).sort((a, b) => b.relevance - a.relevance);
}

/**
 * MAIN RETRIEVAL FUNCTION
 * Unified retrieval for both Document Q&A and SearchAI
 */
export async function retrieve(
  query: string,
  context: RetrievalContext
): Promise<RetrievalResult> {
  const { docId, searchMode = 'current' } = context;
  
  log('info', '=== RETRIEVAL START ===', {
    query: query.slice(0, 100),
    docId,
    searchMode,
    timestamp: new Date().toISOString()
  });

  // If specific docId provided, use database (Document Q&A mode)
  if (docId && searchMode === 'current') {
    log('info', 'Using DATABASE source (current document)', { docId });
    
    const [tree, extraction] = await Promise.all([
      loadTreeFromDB(docId),
      loadExtractionFromDB(docId)
    ]);

    if (!tree) {
      log('warn', 'No tree found for document', { docId });
      return {
        nodes: [],
        markdown: extraction?.markdown,
        source: 'none',
        indexName: 'pageindex_trees',
        namespace: docId,
        filters: { documentId: docId },
        totalAvailable: 0,
        query
      };
    }

    const document = await prisma.document.findFirst({
      where: { id: docId },
      select: { name: true }
    });

    const nodes = collectNodesFromTree(tree, docId, document?.name || 'Document');
    const scoredNodes = scoreNodes(nodes, query);

    log('info', 'Retrieval complete from DATABASE', {
      docId,
      totalNodes: nodes.length,
      scoredNodes: scoredNodes.length,
      topScore: scoredNodes[0]?.relevance || 0,
      topNodeTitle: scoredNodes[0]?.node.title?.slice(0, 50)
    });

    return {
      nodes: scoredNodes,
      markdown: extraction?.markdown,
      extractionId: extraction?.document_id,
      source: 'database',
      indexName: 'pageindex_trees',
      namespace: docId,
      filters: { documentId: docId },
      totalAvailable: nodes.length,
      query
    };
  }

  // Cross-document search (SearchAI mode)
  // Check query cache first
  const queryCacheKey = query.toLowerCase().trim();
  const cachedQuery = _queryCache.get(queryCacheKey);
  if (cachedQuery && (Date.now() - cachedQuery.time) < QUERY_CACHE_TTL_MS) {
    log('info', 'Returning cached query results', { query: query.slice(0, 50) });
    return {
      nodes: cachedQuery.nodes,
      source: 'combined',
      indexName: 'combined',
      namespace: 'global',
      filters: {},
      totalAvailable: cachedQuery.nodes.length,
      query,
      cached: true
    };
  }
  
  // Search BOTH master index AND database trees
  log('info', 'Using COMBINED source (master index + database trees)');
  
  const allNodes: RetrievedNode[] = [];
  
  // 1. Load from master index (legacy documents)
  const masterIndex = await loadMasterIndex();
  if (masterIndex && masterIndex.document_count > 0) {
    const masterNodes = collectAllNodesFromMaster(masterIndex);
    allNodes.push(...masterNodes);
    log('info', 'Loaded nodes from master index', { count: masterNodes.length });
  }
  
  // 2. Load from database trees (all documents with trees) - USE CACHE
  const now = Date.now();
  if (_dbTreesCache && (now - _dbTreesCacheTime) < DB_TREES_TTL_MS) {
    log('debug', 'Using cached database trees');
    // Filter out duplicates with master index
    const masterIds = new Set(masterIndex?.books.map(b => b.hash) || []);
    const uniqueDbNodes = _dbTreesCache.filter(n => !masterIds.has(n.documentId));
    allNodes.push(...uniqueDbNodes);
  } else {
    // Load from database and cache
    try {
      const dbTrees = await prisma.$queryRaw<{ document_id: string; tree_data: any; file_name: string }[]>`
        SELECT DISTINCT ON (pt.document_id) 
          pt.document_id, 
          pt.tree_data,
          d.file_name
        FROM pageindex_trees pt
        JOIN documents d ON pt.document_id = d.id
        WHERE d.status = 'ANALYZED'
        ORDER BY pt.document_id, pt.created_at DESC
      `;
      
      const dbNodes: RetrievedNode[] = [];
      for (const treeRecord of dbTrees) {
        // Skip if already in master index (avoid duplicates)
        const alreadyIncluded = masterIndex?.books.some(b => 
          b.hash === treeRecord.document_id || b.file_name === treeRecord.file_name
        );
        
        if (!alreadyIncluded && treeRecord.tree_data) {
          const nodes = collectNodesFromTree(
            treeRecord.tree_data, 
            treeRecord.document_id, 
            treeRecord.file_name
          );
          dbNodes.push(...nodes);
          allNodes.push(...nodes);
        }
      }
      
      // Cache the database nodes
      _dbTreesCache = dbNodes;
      _dbTreesCacheTime = now;
      
      log('info', 'Loaded and cached nodes from database', { 
        dbTreeCount: dbTrees.length,
        totalNodes: allNodes.length 
      });
    } catch (e) {
      log('warn', 'Failed to load trees from database', { error: String(e) });
    }
  }
  
  if (allNodes.length === 0) {
    log('warn', 'No documents available for search');
    return {
      nodes: [],
      source: 'none',
      indexName: 'combined',
      namespace: 'global',
      filters: {},
      totalAvailable: 0,
      query
    };
  }

  const scoredNodes = scoreNodes(allNodes, query);
  
  // Cache the scored results
  _queryCache.set(queryCacheKey, { nodes: scoredNodes, time: Date.now() });
  
  // Clean old query cache entries periodically
  if (_queryCache.size > 100) {
    const cutoff = Date.now() - QUERY_CACHE_TTL_MS;
    Array.from(_queryCache.entries()).forEach(([key, value]) => {
      if (value.time < cutoff) {
        _queryCache.delete(key);
      }
    });
  }

  log('info', 'Retrieval complete from COMBINED sources', {
    totalNodes: allNodes.length,
    scoredNodes: scoredNodes.length,
    topScore: scoredNodes[0]?.relevance || 0,
    topNodeDoc: scoredNodes[0]?.documentName?.slice(0, 50)
  });

  return {
    nodes: scoredNodes,
    source: 'combined',
    indexName: 'combined',
    namespace: 'global',
    filters: {},
    totalAvailable: allNodes.length,
    query,
    cached: false
  };
}

/**
 * Find a specific section in markdown content
 */
export function findSectionInMarkdown(markdown: string, sectionRef: string): string {
  const lines = markdown.split('\n');
  let inSection = false;
  let sectionContent: string[] = [];
  let sectionLevel = 0;
  
  for (const line of lines) {
    // Check if this is a heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2];
      
      // Check if this is our target section
      if (title.toLowerCase().includes(sectionRef.toLowerCase()) || 
          title.includes(sectionRef)) {
        inSection = true;
        sectionLevel = level;
        sectionContent = [line];
        continue;
      }
      
      // If we're in a section and hit a heading of same or higher level, stop
      if (inSection && level <= sectionLevel) {
        break;
      }
    }
    
    if (inSection) {
      sectionContent.push(line);
    }
  }
  
  return sectionContent.join('\n');
}

/**
 * Clean text for display
 */
export function cleanText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clear all caches (useful for testing or when data changes)
 */
export function clearRetrievalCaches(): void {
  _masterIndexCache = null;
  _masterIndexCacheTime = 0;
  _dbTreesCache = null;
  _dbTreesCacheTime = 0;
  _queryCache.clear();
  log('info', 'All retrieval caches cleared');
}
