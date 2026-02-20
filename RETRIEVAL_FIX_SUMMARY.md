# SearchAI & Document Q&A Retrieval Fix

## Problem Identified

**SearchAI was using a different retrieval source than Document Q&A:**

| Flow | Data Source | Retrieval Method |
|------|-------------|------------------|
| Document Q&A | `prisma.documentExtraction` (Database) | Direct SQL query on markdown |
| SearchAI | `master_index.json` (File on disk) | File read + tree traversal |

This caused SearchAI to:
1. Return "section not found" even when Document Q&A could find it
2. Use potentially stale data (file vs live database)
3. Have different scoring/filtering logic

## Solution Implemented

### 1. Created Shared Retrieval Service (`lib/retrieval_service.ts`)

Exports:
- `retrieve(query, context)` - Main retrieval function
- `findSectionInMarkdown()` - Section lookup helper  
- `cleanText()` - Text normalization

**Data Sources:**
- **Database** (`pageindex_trees`, `document_extractions` tables) - for single-document queries
- **Master Index File** (`master_index.json`) - for cross-document search fallback

**Retrieval Context:**
```typescript
{
  docId?: string;        // Document ID to search
  searchMode: 'current' | 'all';  // 'current' = single doc, 'all' = cross-doc
}
```

### 2. Updated Document Q&A (`app/api/documents/[id]/chat/route.ts`)

- Now uses `retrieve()` from shared service
- Calls with `searchMode: 'current'` and `docId`
- Logs retrieval metadata for debugging
- Falls back to tree nodes if markdown section lookup fails

### 3. Updated SearchAI (`app/api/searchai/route.ts`)

- Now uses same `retrieve()` function
- Supports optional `documentId` parameter:
  - If provided: searches only that document (same as Document Q&A)
  - If not provided: searches all documents via master index
- Logs identical metadata format as Document Q&A

### 4. Added Logging

Both flows now log:
```
[RETRIEVAL:INFO] === RETRIEVAL START ===
[RETRIEVAL:INFO] Using DATABASE source (current document)
[RETRIEVAL:INFO] Retrieval complete from DATABASE
  - docId: xxx
  - source: database
  - indexName: pageindex_trees
  - namespace: xxx
  - totalNodes: N
  - scoredNodes: M
```

Enable debug logging:
```bash
DEBUG_RETRIEVAL=true npm run dev
```

## Key Changes Made

### Files Modified:
1. `lib/retrieval_service.ts` - **NEW** - Shared retrieval module
2. `app/api/documents/[id]/chat/route.ts` - Updated to use shared service
3. `app/api/searchai/route.ts` - Updated to use shared service

### Files Created:
4. `tests/retrieval.test.ts` - Integration tests
5. `RETRIEVAL_FIX_SUMMARY.md` - This documentation

## Usage Examples

### Document Q&A (unchanged API):
```typescript
POST /api/documents/{id}/chat
{ "message": "What does section 2.1.7 say?" }
```

### SearchAI - Search current document (NEW):
```typescript
POST /api/searchai
{
  "query": "What does section 2.1.7 say?",
  "documentId": "doc_123",  // Optional: limits to specific doc
  "searchMode": "current"    // Optional: "current" (default) or "all"
}
```

### SearchAI - Search all documents (existing behavior):
```typescript
POST /api/searchai
{
  "query": "payment terms",
  "searchMode": "all"  // Cross-document search
}
```

## Verification

### Manual Test:
1. Upload a PDF document
2. Ask "What does section X say?" in Document Q&A → should find answer
3. Ask same question in SearchAI with same document selected → should find same answer
4. Check logs - both should show:
   - `source: "database"`
   - `indexName: "pageindex_trees"`
   - Same `namespace` (docId)

### Automated Test:
```bash
npm test tests/retrieval.test.ts
```

Tests verify:
- Both flows use same data source when `docId` provided
- Same scoring algorithm applied
- Consistent metadata structure
- Overlapping results for same query

## Root Cause Analysis

**Why SearchAI was failing:**

1. **Different data sources**: 
   - Document Q&A queried `document_extractions` table (live data)
   - SearchAI read `master_index.json` (potentially stale file)

2. **Different content access**:
   - Document Q&A had direct access to full markdown
   - SearchAI only had tree nodes (structured, possibly truncated)

3. **Timing issue**:
   - Master index file is written after document processing
   - If file missing/outdated, SearchAI had no data

**Why the fix works:**

Both flows now call the same `retrieve()` function which:
- Prioritizes database (single-document mode)
- Falls back to master index only for cross-document search
- Uses identical scoring algorithm
- Returns consistent metadata

## Backward Compatibility

- Document Q&A API: **Unchanged** - same request/response format
- SearchAI API: **Enhanced** - new optional `documentId` parameter
- Existing SearchAI calls without `documentId` still work (cross-doc mode)
