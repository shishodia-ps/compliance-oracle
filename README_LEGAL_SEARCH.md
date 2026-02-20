# Legal AI - Legal Search Engine Architecture

## Overview

This document describes the Legal Search Engine, Document Reader, and Citation System integrated into the Legal AI platform.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              LEGAL AI PLATFORM                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐ │
│  │   PIPELAYER         │    │   SEARCH ENGINE     │    │   CITATION SYSTEM   │ │
│  │   (Source of Truth) │◄──►│   (Hybrid Search)   │◄──►│   (Trust Layer)     │ │
│  └─────────────────────┘    └─────────────────────┘    └─────────────────────┘ │
│           │                           │                           │             │
│           │                           │                           │             │
│           ▼                           ▼                           ▼             │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                    DATABASE (PostgreSQL + pgvector)                      │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │  │
│  │  │SearchChunk  │  │Citation     │  │SearchQuery  │  │PipelineJobs │    │  │
│  │  │- text       │  │- quote      │  │- queryText  │  │- status     │    │  │
│  │  │- embedding  │  │- review     │  │- filters    │  │- progress   │    │  │
│  │  │- sectionPath│  │- confidence │  │- results    │  │- artifacts  │    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                         UI COMPONENTS                                   │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │  │
│  │  │ /app/search     │  │ DocumentReader  │  │ CitationReview          │  │  │
│  │  │ - Hybrid search │  │ - Page nav      │  │ - Approve/Reject        │  │  │
│  │  │ - Filters       │  │ - Highlighting  │  │ - Comment               │  │  │
│  │  │ - Q&A mode      │  │ - Side panels   │  │ - Audit trail           │  │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Search Types

### 1. Keyword Search (PostgreSQL Full-Text)
- Uses `tsvector` and `tsquery` for fast text search
- Supports phrase matching
- Dutch term normalization (aansprakelijkheid → liability)
- Clause number extraction ("section 2.1")

### 2. Semantic Search (pgvector)
- Cosine similarity on chunk embeddings
- 1536-dimension vectors (OpenAI text-embedding-3-small)
- IVFFlat index for approximate nearest neighbor
- Fallback to keyword search when embeddings not available

### 3. Structural Search
- Navigate by section path: "2.1 Liability → Limitation"
- Clause type filtering: termination, indemnity, payment, etc.
- Page-based navigation
- Tree hierarchy traversal

## Hybrid Search Algorithm

```typescript
1. Parse query for structural hints (section numbers, clause types)
2. Run keyword search (PostgreSQL tsvector)
3. Run semantic search (pgvector cosine similarity)  
4. Merge results with weighted scoring:
   - Keyword: 40%
   - Semantic: 40%
   - Structural: 20%
5. Return top-K results with citations
```

## Citation Model

Every search result includes:

```typescript
interface Citation {
  chunkId: string;        // Unique chunk identifier
  documentId: string;     // Source document
  page: number;           // Page number
  sectionPath: string;    // Hierarchical path
  quote: string;          // Exact text
  startOffset: number;    // Character start
  endOffset: number;      // Character end
  confidence: number;     // Relevance score (0-1)
}
```

## Citation Review Workflow

1. **Pending**: Initial state after AI generates citation
2. **Approved**: Reviewer validates citation accuracy
3. **Rejected**: Reviewer marks citation as incorrect
4. **Commented**: Reviewer adds notes without changing status

All review actions are audited.

## Dutch Legal Intelligence

### Term Normalization
```typescript
const DUTCH_TERM_MAP = {
  'aansprakelijkheid': 'liability',
  'ontbinding': 'termination',
  'schadevergoeding': 'damages',
  'vrijwaring': 'indemnity',
  'vertrouwelijkheid': 'confidentiality',
  'betaling': 'payment',
  'overmacht': 'force majeure',
  'toepasselijk recht': 'governing law',
};
```

### Language Detection
- Automatic per-chunk language detection
- Supports Dutch (NL) and English (EN)
- Search works across both languages

## Database Schema Additions

### SearchChunk
```prisma
model SearchChunk {
  id            String    @id @default(cuid())
  documentId    String
  matterId      String
  chunkId       String    // Original PageIndex ID
  page          Int?
  sectionPath   String    // e.g., "2.1 Liability → Limitation"
  sectionNumber String?   // e.g., "2.1"
  text          String    @db.Text
  textVector    Unsupported("tsvector")?  // PostgreSQL full-text
  embedding     Float[]?  // pgvector
  chunkType     String    // clause, section, paragraph
  clauseType    String?   // termination, indemnity, etc.
  language      String    // nl, en, unknown
  level         Int       // Hierarchy level
  path          String[]  // Full path array
  hash          String    // Content hash
}
```

### CitationRecord
```prisma
model CitationRecord {
  id              String   @id @default(cuid())
  queryId         String?
  chunkId         String
  documentId      String
  page            Int?
  sectionPath     String
  quote           String   @db.Text
  startOffset     Int
  endOffset       Int
  relevanceScore  Float
  matchType       String   // semantic, keyword, structural
  reviewStatus    String   // pending, approved, rejected, commented
  reviewedById    String?
  reviewedAt      DateTime?
  reviewComment   String?
}
```

## Pipeline Extensions

The existing pipeline now emits normalized chunks to the database:

```python
# chunking.py - New module
class ChunkExtractor:
    def traverse_tree(self, node, parent_path=[], level=0):
        # Extracts chunks from PageIndex tree
        # Detects language, clause type
        # Computes content hash
        # Returns normalized chunks
```

## API Routes

### Search
- `POST /api/search` - Hybrid search with citations
- Query params: `query`, `matterId`, `clauseType`, `language`, `mode`
- Returns: Results with citations, queryId for tracking

### Citations
- `GET /api/citations` - List citations with filters
- `PATCH /api/citations` - Update review status
- Query params: `queryId`, `status`, `matterId`

## UI Components

### DocumentReader
```typescript
interface DocumentReaderProps {
  documentId: string;
  documentName: string;
  chunks: DocumentChunk[];
  citations?: Citation[];
  risks?: Risk[];
}
```

Features:
- Page navigation with prev/next
- Zoom controls (50%-200%)
- Citation highlighting
- Side panels: Outline, Citations, Risks
- Click-to-citation navigation

### Search Page
- Dual mode: Document Search / Q&A
- Filters: Clause type, Language
- Result cards with snippets
- Citation badges
- Confidence scores

### CitationReview
- Tabbed interface: Pending, Approved, Rejected, All
- Review actions: Approve, Reject, Comment
- Audit trail display
- Query context

## Files Added/Modified

### New Files
```
prisma/migrations/000_add_pgvector/migration.sql  # pgvector setup
prisma/schema.prisma                              # Extended models
services/pipeline_worker/chunking.py              # Chunk extraction
lib/search/search-service.ts                      # Hybrid search
app/api/search/route.ts                           # Search API
app/api/citations/route.ts                        # Citation API
app/(app)/app/search/page.tsx                     # Search UI
app/(app)/app/citations/page.tsx                  # Citation review UI
components/legal/document-reader.tsx              # Document viewer
components/legal/citation-review.tsx              # Citation review component
components/ui/tooltip.tsx                         # Tooltip component
```

### Modified Files
```
components/app/sidebar.tsx                        # Added Search, Citations nav
package.json                                      # Added @radix-ui/react-tooltip
```

## Smoke Test Checklist

### Database
- [ ] pgvector extension enabled
- [ ] SearchChunk table created
- [ ] CitationRecord table created
- [ ] SearchQuery table created
- [ ] Indexes on textVector and embedding

### Pipeline
- [ ] Chunk extraction working
- [ ] Chunks persisted to database
- [ ] Language detection working
- [ ] Clause type detection working

### Search
- [ ] Keyword search returns results
- [ ] Results include citations
- [ ] Dutch term normalization works
- [ ] Clause type filtering works
- [ ] Q&A mode uses search first

### Document Reader
- [ ] Page navigation works
- [ ] Zoom controls work
- [ ] Citation highlighting works
- [ ] Click-to-citation navigates
- [ ] Outline panel works

### Citations
- [ ] Citation review page loads
- [ ] Pending citations displayed
- [ ] Approve/Reject buttons work
- [ ] Comments saved
- [ ] Audit trail tracked

## Security Considerations

1. **Matter-scoped access**: All searches filtered by user's organization/matter
2. **Citation integrity**: Quote field is immutable after creation
3. **Review audit**: All review actions logged to AuditLog
4. **No raw SQL injection**: Prisma ORM handles query parameterization

## Performance

1. **Full-text index**: GIN index on textVector
2. **Vector index**: IVFFlat index on embedding (100 lists)
3. **Pagination**: Search results limited to top-K
4. **Caching**: PageIndex query cache reused

## Reproducibility

Every citation includes:
- Content hash of source chunk
- Pipeline version
- Document hash
- Query timestamp

This ensures answers can be verified against the exact document state.
