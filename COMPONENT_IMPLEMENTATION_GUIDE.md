# UI Component Implementation Guide

Quick reference for using the new UI components to improve pages.

## New Components Created

### 1. Skeleton Loaders
**File**: `components/ui/skeleton.tsx`

Use when data is loading to improve perceived performance.

```tsx
import { TableSkeleton, CardSkeleton, DocumentListSkeleton } from '@/components/ui/skeleton';

// In a component while loading
{loading ? (
  <TableSkeleton rows={5} />
) : (
  <DataTable data={data} />
)}

// For documents list
{loadingDocuments ? (
  <DocumentListSkeleton items={5} />
) : (
  <DocumentList documents={documents} />
)}
```

**Where to apply**:
- `/app/documents` - Show skeleton while fetching documents
- `/app/invoices` - Show skeleton while fetching invoices
- `/app/policy-compare` - Show skeleton while fetching policies
- Dashboard - Show skeleton for stats while loading

---

### 2. Empty States
**File**: `components/ui/empty-state.tsx`

Replace blank pages with helpful guidance.

```tsx
import { EmptyState, EmptySearchResults } from '@/components/ui/empty-state';
import { FileText, AlertTriangle } from 'lucide-react';

// No documents yet
{documents.length === 0 ? (
  <EmptyState
    icon={FileText}
    title="No documents yet"
    description="Upload your first legal document to get started"
    action={{
      label: "Upload Document",
      onClick: () => router.push('/app/documents?upload=true')
    }}
  />
) : (
  <DocumentTable documents={documents} />
)}

// Search with no results
{searchResults.length === 0 ? (
  <EmptySearchResults 
    query={searchQuery}
    onClear={() => setSearchQuery('')}
  />
) : (
  <SearchResults results={searchResults} />
)}

// Error state
{error ? (
  <EmptyErrorState
    title="Failed to load documents"
    description={error.message}
    onRetry={refetch}
  />
) : null}
```

**Where to apply**:
- `/app/documents` - Empty when no documents
- `/app/invoices` - Empty when no invoices
- `/app/matters` - Empty when no matters
- Search results - When query returns nothing

---

### 3. Drag & Drop Upload
**File**: `components/ui/drag-drop-upload.tsx`

Better file upload experience.

```tsx
import { DragDropUpload } from '@/components/ui/drag-drop-upload';

<DragDropUpload
  onFilesSelected={async (files) => {
    // Upload files
    for (const file of files) {
      await uploadDocument(file);
    }
  }}
  acceptedFileTypes={['.pdf', '.doc', '.docx']}
  maxSize={50 * 1024 * 1024} // 50MB
/>

// Or with custom content
<DragDropUpload onFilesSelected={handleUpload}>
  <div className="space-y-2">
    <FileIcon className="mx-auto w-12 h-12 text-brand-600" />
    <p className="font-semibold">Drop invoices here</p>
    <p className="text-xs text-muted-foreground">PDF, DOC, DOCX (max 50MB)</p>
  </div>
</DragDropUpload>
```

**Where to apply**:
- `/app/documents` - Main upload area
- `/app/invoices` - Invoice upload
- `/app/policy-compare` - Policy file upload
- Any file upload section

---

### 4. Risk Indicators & Badges
**File**: `components/ui/risk-indicator.tsx`

Visual risk level indicators throughout the app.

```tsx
import { 
  RiskBadge, 
  RiskIndicator,
  RiskHeatCell,
  RiskSummary 
} from '@/components/ui/risk-indicator';

// Risk badge - use in tables/lists
<RiskBadge level="high" label="High Risk" />
<RiskBadge level="critical" />
<RiskBadge level="medium" />
<RiskBadge level="low" />

// Risk indicator - compact dot
<RiskIndicator level="critical" size="md" />

// Risk heat cell - colored square for heatmap
<div className="grid grid-cols-3 gap-2">
  {documents.map(doc => (
    <RiskHeatCell level={doc.riskLevel} />
  ))}
</div>

// Risk summary card
<RiskSummary 
  critical={2}
  high={5}
  medium={12}
  low={8}
/>
```

**Where to apply**:
- Document table - Show risk status in each row
- Invoice list - Risk flags for anomalies
- Dashboard - Risk summary card
- Document detail page - Risk breakdown

---

### 5. Stat Cards
**File**: `components/ui/risk-indicator.tsx`

Enhanced dashboard cards with icons and trends.

```tsx
import { StatCard } from '@/components/ui/risk-indicator';
import { FileText, AlertTriangle, DollarSign } from 'lucide-react';

// Simple stat
<StatCard
  title="Total Documents"
  value={42}
  icon={<FileText />}
  description="All uploaded documents"
/>

// With trend
<StatCard
  title="Documents"
  value={42}
  icon={<FileText />}
  trend={{
    value: 12,
    direction: 'up'
  }}
  description="Uploaded this month"
/>

// Clickable stat
<StatCard
  title="Critical Risks"
  value={3}
  icon={<AlertTriangle />}
  onClick={() => router.push('/app/documents?filter=critical')}
/>

// In a grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  <StatCard title="Documents" value={42} icon={<FileText />} />
  <StatCard title="Invoices" value={128} icon={<Receipt />} />
  <StatCard title="Risks" value={8} icon={<AlertTriangle />} />
  <StatCard title="Spending" value="$45.2K" icon={<DollarSign />} />
</div>
```

**Where to apply**:
- Dashboard - Replace basic text stats
- Admin panel - Show metrics
- Compliance page - Show compliance scores
- Invoice insights - Show spending metrics

---

## Implementation Priority

### Phase 1: High Impact (Do First!)
1. **Dashboard** - Add StatCards with trends
   - Time: 30 min
   - Impact: Huge visual improvement
   
2. **Empty States** - Add to all list pages
   - Time: 1 hour
   - Impact: Better UX for new users

3. **Risk Badges** - Add to documents/invoices
   - Time: 1 hour  
   - Impact: Better risk visibility

### Phase 2: Medium Impact (Next)
4. **Skeleton Loaders** - Add to all data pages
   - Time: 1.5 hours
   - Impact: Feels faster

5. **Drag & Drop** - File uploads
   - Time: 1 hour
   - Impact: Better upload experience

### Phase 3: Polish (When time allows)
6. **Risk Summary** - Cards and overviews
7. **Additional animations** and refinements

---

## Example: Improve Documents Page

**Current Code**:
```tsx
export default function DocumentsPage() {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState(null);
  
  // fetch documents...
  
  return (
    <div>
      {loading && <Loader />}
      {error && <ErrorMessage error={error} />}
      {documents.length === 0 && <p>No documents</p>}
      {documents.length > 0 && <DataTable documents={documents} />}
    </div>
  );
}
```

**Improved Code**:
```tsx
import { DocumentListSkeleton } from '@/components/ui/skeleton';
import { EmptyState, EmptyErrorState } from '@/components/ui/empty-state';
import { DragDropUpload } from '@/components/ui/drag-drop-upload';

export default function DocumentsPage() {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState(null);
  
  // fetch documents...
  
  return (
    <div className="space-y-6">
      {/* Upload section */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Upload Documents</h2>
        <DragDropUpload
          onFilesSelected={handleUpload}
          acceptedFileTypes={['.pdf', '.doc', '.docx']}
        />
      </div>

      {/* Documents section */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Your Documents</h2>
        
        {error && (
          <EmptyErrorState
            title="Failed to load documents"
            description={error.message}
            onRetry={() => fetchDocuments()}
          />
        )}
        
        {!error && loading && <DocumentListSkeleton items={5} />}
        
        {!error && !loading && documents.length === 0 && (
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description="Upload a document above to get started"
          />
        )}
        
        {!error && !loading && documents.length > 0 && (
          <DocumentTable documents={documents} />
        )}
      </div>
    </div>
  );
}
```

---

## Tips for Best Results

1. **Skeleton over spinners** - Use skeletons for data loading, spinners for actions
2. **Consistent sizing** - Use same icon sizes throughout
3. **Color consistency** - Risk levels should always use same colors
4. **Responsive** - Test on mobile (cards stack, icons adjust)
5. **Dark mode** - Components support dark mode by default
6. **Accessibility** - All interactive elements have proper labels

---

## Component Customization

All components support `className` prop for additional styling:

```tsx
<StatCard 
  title="Documents"
  value={42}
  icon={<FileText />}
  className="border-2 border-brand-500"
/>

<RiskBadge 
  level="critical" 
  className="text-lg"
/>
```

---

## Testing These Components

Add to any page temporarily to see how they look:

```tsx
import { StatCard, RiskBadge, EmptyState } from '@/components/ui/*';

// In your render:
<div className="space-y-6">
  <StatCard title="Test" value={42} icon={<FileText />} />
  <RiskBadge level="critical" />
  <EmptyState 
    icon={FileText}
    title="Test Empty"
    description="Test description"
  />
</div>
```

Toggle loading states:
```tsx
{/* useState to test loading states */}
const [testLoading, setTestLoading] = useState(true);
<DocumentListSkeleton items={5} />
```

---

## Support for Quick Questions

Each component file has JSDoc comments explaining usage. Check the source files for:
- `components/ui/skeleton.tsx` - All skeleton loaders
- `components/ui/empty-state.tsx` - Empty states
- `components/ui/drag-drop-upload.tsx` - File upload
- `components/ui/risk-indicator.tsx` - Risk & stat cards
