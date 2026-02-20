'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  GitCompare,
  FileText,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  Filter,
  AlignLeft,
  List,
  Check,
  Loader2,
  ArrowRight,
  FileSearch,
  Printer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { computeDocumentDiff, generateChangeSummary, DiffType, SectionDiff } from '@/lib/diff';

interface Document {
  id: string;
  name: string;
  fileName: string;
  documentType: string;
  status: string;
  createdAt: string;
}

interface DocumentContent {
  document: Document;
  content: {
    markdown: string;
    text: string;
  };
  structure: {
    tree: any;
    headings: Array<{ title: string; level: number; path: string[] }>;
    chunks: any[];
  };
  summary: {
    summary: string;
    keyPoints: string[];
  } | null;
}

type FilterType = 'all' | 'added' | 'removed' | 'changed';

export default function ComparePage() {
  // Document selection state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [originalDoc, setOriginalDoc] = useState<Document | null>(null);
  const [revisedDoc, setRevisedDoc] = useState<Document | null>(null);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  
  // Content state
  const [originalContent, setOriginalContent] = useState<DocumentContent | null>(null);
  const [revisedContent, setRevisedContent] = useState<DocumentContent | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  
  // UI state
  const [alignByHeadings, setAlignByHeadings] = useState(true);
  const [autoAlignDetected, setAutoAlignDetected] = useState(false);
  const [showOnlyChanged, setShowOnlyChanged] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  // Detect if content has markdown headings
  const hasHeadings = (content: string): boolean => {
    return /^#{1,6}\s+/m.test(content);
  };
  
  // Refs for scrolling
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  // Fetch documents list
  useEffect(() => {
    const controller = new AbortController();
    const fetchDocs = async () => {
      try {
        const response = await fetch('/api/documents?status=ANALYZED', { signal: controller.signal });
        if (response.ok) {
          const data = await response.json();
          // Handle both old array format and new paginated format
          setDocuments(Array.isArray(data) ? data : data.documents || []);
        } else {
          toast.error('Failed to fetch documents');
        }
      } catch (error: any) {
        if (error?.name === 'AbortError') return;
        toast.error('Error loading documents');
      } finally {
        setIsLoadingDocs(false);
      }
    };
    fetchDocs();
    return () => controller.abort();
  }, []);

  // Fetch document content
  const fetchDocumentContent = async (id: string): Promise<DocumentContent | null> => {
    try {
      const response = await fetch(`/api/documents/${id}/content?format=json`);
      if (response.ok) {
        return await response.json();
      }
      toast.error('Failed to fetch document content');
      return null;
    } catch (error) {
      toast.error('Error loading document content');
      return null;
    }
  };

  // Handle compare with timeout for large documents
  const handleCompare = async () => {
    if (!originalDoc || !revisedDoc) {
      toast.error('Please select both documents');
      return;
    }

    setIsComparing(true);
    
    // Set a timeout for large document comparisons
    const COMPARE_TIMEOUT = 30000; // 30 seconds
    const timeoutId = setTimeout(() => {
      toast.warning('Document comparison is taking longer than expected. Large documents may require more time.');
    }, 10000); // Show warning after 10 seconds
    
    try {
      const [orig, rev] = await Promise.all([
        fetchDocumentContent(originalDoc.id),
        fetchDocumentContent(revisedDoc.id),
      ]);

      clearTimeout(timeoutId);

      if (orig && rev) {
        // Check document sizes
        const origSize = orig.content.markdown?.length || 0;
        const revSize = rev.content.markdown?.length || 0;
        const totalSize = origSize + revSize;
        
        if (totalSize > 500000) { // 500KB total
          toast.info('Large documents detected. Comparison may take a moment.');
        }
        
        setOriginalContent(orig);
        setRevisedContent(rev);
        
        // Auto-detect if documents have headings
        const origHasHeadings = hasHeadings(orig.content.markdown);
        const revHasHeadings = hasHeadings(rev.content.markdown);
        
        // If neither has headings, turn off alignByHeadings for better plain text comparison
        if (!origHasHeadings && !revHasHeadings) {
          setAlignByHeadings(false);
          setAutoAlignDetected(true);
          toast.info('Plain text detected - using line-by-line comparison');
        } else {
          setAutoAlignDetected(false);
        }
        
        setShowResults(true);
        
        // Auto-expand all sections with changes
        const useAlignByHeadings = origHasHeadings || revHasHeadings ? alignByHeadings : false;
        
        // Use setTimeout to not block UI for large diffs
        setTimeout(() => {
          const diff = computeDocumentDiff(
            orig.content.markdown,
            rev.content.markdown,
            useAlignByHeadings
          );
          const changedPaths = diff.sections
            .filter(s => s.stats.additions > 0 || s.stats.deletions > 0)
            .map(s => s.path);
          setExpandedSections(new Set(changedPaths));
        }, 0);
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        toast.error('Document comparison timed out. Try comparing smaller sections or documents.');
      } else {
        toast.error('Failed to compare documents');
      }
    } finally {
      clearTimeout(timeoutId);
      setIsComparing(false);
    }
  };

  // Compute diff
  const diffResult = useMemo(() => {
    if (!originalContent || !revisedContent) return null;
    return computeDocumentDiff(
      originalContent.content.markdown,
      revisedContent.content.markdown,
      alignByHeadings
    );
  }, [originalContent, revisedContent, alignByHeadings]);

  // Generate summary
  const changeSummary = useMemo(() => {
    if (!diffResult) return [];
    return generateChangeSummary(diffResult);
  }, [diffResult]);

  // Filter sections
  const filteredSections = useMemo(() => {
    if (!diffResult) return [];
    
    return diffResult.sections.filter(section => {
      const hasChanges = section.stats.additions > 0 || section.stats.deletions > 0;
      
      if (showOnlyChanged && !hasChanges) return false;
      
      switch (filter) {
        case 'added':
          return section.stats.additions > 0;
        case 'removed':
          return section.stats.deletions > 0;
        case 'changed':
          return hasChanges;
        default:
          return true;
      }
    });
  }, [diffResult, filter, showOnlyChanged]);

  // Toggle section expansion
  const toggleSection = (path: string) => {
    const newSet = new Set(expandedSections);
    if (newSet.has(path)) {
      newSet.delete(path);
    } else {
      newSet.add(path);
    }
    setExpandedSections(newSet);
  };

  // Scroll to section
  const scrollToSection = (path: string) => {
    setSelectedSection(path);
    const element = document.getElementById(`section-${path}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Sync scroll between panels
  const handleScroll = (source: 'left' | 'right') => {
    const left = leftPanelRef.current;
    const right = rightPanelRef.current;
    if (!left || !right) return;

    if (source === 'left') {
      right.scrollTop = left.scrollTop;
    } else {
      left.scrollTop = right.scrollTop;
    }
  };

  // Export report as JSON
  const handleExport = () => {
    if (!diffResult || !originalDoc || !revisedDoc) return;
    
    const report = {
      original: {
        id: originalDoc.id,
        name: originalDoc.name,
        fileName: originalDoc.fileName,
      },
      revised: {
        id: revisedDoc.id,
        name: revisedDoc.name,
        fileName: revisedDoc.fileName,
      },
      comparison: {
        timestamp: new Date().toISOString(),
        stats: diffResult.stats,
        summary: changeSummary,
        sections: diffResult.sections.map(s => ({
          path: s.path,
          title: s.title,
          stats: s.stats,
        })),
      },
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comparison-${originalDoc.name}-vs-${revisedDoc.name}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Comparison report exported');
  };

  // Print report
  const handlePrint = () => {
    window.print();
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoadingDocs) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl font-bold">Compare Documents</h1>
        <p className="text-muted-foreground">
          Compare two versions and see what changed
        </p>
      </motion.div>

      {/* Document Selection */}
      {!showResults && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Original Document */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Original Document
                </CardTitle>
              </CardHeader>
              <CardContent>
                <select
                  className="w-full p-2 border rounded-md bg-white"
                  value={originalDoc?.id || ''}
                  onChange={(e) => {
                    const doc = documents.find(d => d.id === e.target.value);
                    setOriginalDoc(doc || null);
                  }}
                >
                  <option value="">Select document...</option>
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name}
                    </option>
                  ))}
                </select>
                {originalDoc && (
                  <div className="mt-3 text-sm text-slate-500">
                    <p>{originalDoc.fileName}</p>
                    <p>{formatDate(originalDoc.createdAt)}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Revised Document */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Revised Document
                </CardTitle>
              </CardHeader>
              <CardContent>
                <select
                  className="w-full p-2 border rounded-md bg-white"
                  value={revisedDoc?.id || ''}
                  onChange={(e) => {
                    const doc = documents.find(d => d.id === e.target.value);
                    setRevisedDoc(doc || null);
                  }}
                >
                  <option value="">Select document...</option>
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name}
                    </option>
                  ))}
                </select>
                {revisedDoc && (
                  <div className="mt-3 text-sm text-slate-500">
                    <p>{revisedDoc.fileName}</p>
                    <p>{formatDate(revisedDoc.createdAt)}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Compare Button */}
          <div className="flex justify-center">
            <Button
              size="lg"
              className="bg-amber-500 hover:bg-amber-600"
              onClick={handleCompare}
              disabled={isComparing || !originalDoc || !revisedDoc}
            >
              {isComparing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Comparing...
                </>
              ) : (
                <>
                  <GitCompare className="w-5 h-5 mr-2" />
                  Compare Documents
                </>
              )}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Results */}
      {showResults && diffResult && originalDoc && revisedDoc && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {/* Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-4 rounded-lg border">
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => setShowResults(false)}>
                ← New Comparison
              </Button>
              <div className="text-sm">
                <span className="font-medium">{originalDoc.name}</span>
                <ArrowRight className="w-4 h-4 inline mx-2" />
                <span className="font-medium">{revisedDoc.name}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4 flex-wrap">
              {/* Controls */}
              <div className="flex items-center gap-2">
                <Switch
                  id="headings"
                  checked={alignByHeadings}
                  onCheckedChange={setAlignByHeadings}
                />
                <Label htmlFor="headings" className="flex items-center gap-1">
                  <AlignLeft className="w-4 h-4" />
                  Align by headings
                  {autoAlignDetected && !alignByHeadings && (
                    <Badge variant="secondary" className="text-xs ml-1">
                      Auto-off (plain text)
                    </Badge>
                  )}
                </Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Switch
                  id="changed"
                  checked={showOnlyChanged}
                  onCheckedChange={setShowOnlyChanged}
                />
                <Label htmlFor="changed" className="flex items-center gap-1">
                  <Filter className="w-4 h-4" />
                  Only changed
                </Label>
              </div>

              {/* Filter Dropdown */}
              <select
                className="p-2 border rounded-md text-sm"
                value={filter}
                onChange={(e) => setFilter(e.target.value as FilterType)}
              >
                <option value="all">All changes</option>
                <option value="added">Added only</option>
                <option value="removed">Removed only</option>
                <option value="changed">Modified only</option>
              </select>

              {/* Export */}
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-1" />
                Print
              </Button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="bg-emerald-50 border-emerald-200">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">
                  {diffResult.stats.sectionsChanged}
                </p>
                <p className="text-sm text-emerald-700">Sections Changed</p>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {diffResult.stats.totalAdditions}
                </p>
                <p className="text-sm text-blue-700">Lines Added</p>
              </CardContent>
            </Card>
            <Card className="bg-rose-50 border-rose-200">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-rose-600">
                  {diffResult.stats.totalDeletions}
                </p>
                <p className="text-sm text-rose-700">Lines Removed</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-slate-600">
                  {diffResult.stats.totalUnchanged}
                </p>
                <p className="text-sm text-slate-700">Unchanged</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Sidebar - Change Summary */}
            <Card className="lg:col-span-1 h-[calc(100vh-400px)]">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <List className="w-4 h-4" />
                  Change Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-480px)]">
                  <div className="px-4 pb-4 space-y-2">
                    {changeSummary.map((item, idx) => (
                      <div
                        key={idx}
                        className="text-sm p-2 rounded bg-slate-50 hover:bg-slate-100 cursor-pointer"
                        onClick={() => {
                          const section = diffResult.sections.find(s => item.includes(s.title));
                          if (section) scrollToSection(section.path);
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </div>
                      </div>
                    ))}
                    
                    {filteredSections.length > 0 && (
                      <>
                        <hr className="my-3" />
                        <p className="text-xs font-medium text-slate-500 uppercase">Sections</p>
                        {filteredSections.map((section) => (
                          <button
                            key={section.path}
                            className={`w-full text-left text-sm p-2 rounded transition-colors ${
                              selectedSection === section.path
                                ? 'bg-amber-100 text-amber-800'
                                : 'hover:bg-slate-100'
                            }`}
                            onClick={() => scrollToSection(section.path)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="truncate" style={{ paddingLeft: `${section.level * 8}px` }}>
                                {section.title}
                              </span>
                              {(section.stats.additions > 0 || section.stats.deletions > 0) && (
                                <div className="flex gap-1 text-xs">
                                  {section.stats.additions > 0 && (
                                    <Badge className="bg-blue-100 text-blue-700">+{section.stats.additions}</Badge>
                                  )}
                                  {section.stats.deletions > 0 && (
                                    <Badge className="bg-rose-100 text-rose-700">-{section.stats.deletions}</Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Comparison Panels */}
            <Card className="lg:col-span-3 h-[calc(100vh-400px)]">
              <CardHeader className="pb-0">
                <div className="grid grid-cols-2 gap-4 text-sm font-medium">
                  <div className="p-2 bg-slate-100 rounded">Original: {originalDoc.name}</div>
                  <div className="p-2 bg-slate-100 rounded">Revised: {revisedDoc.name}</div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-2 h-[calc(100vh-500px)]">
                  {/* Original Panel */}
                  <ScrollArea
                    ref={leftPanelRef}
                    className="border-r"
                    onScroll={() => handleScroll('left')}
                  >
                    <div className="p-4 space-y-4">
                      {filteredSections.length === 0 ? (
                        <div className="text-center text-slate-400 py-8">
                          <Filter className="w-8 h-8 mx-auto mb-2" />
                          <p>No sections match the current filter</p>
                        </div>
                      ) : (
                        filteredSections.map((section) => (
                          <SectionPanel
                            key={section.path}
                            section={section}
                            isExpanded={expandedSections.has(section.path)}
                            onToggle={() => toggleSection(section.path)}
                            variant="original"
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>

                  {/* Revised Panel */}
                  <ScrollArea
                    ref={rightPanelRef}
                    onScroll={() => handleScroll('right')}
                  >
                    <div className="p-4 space-y-4">
                      {filteredSections.length === 0 ? (
                        <div className="text-center text-slate-400 py-8">
                          <Filter className="w-8 h-8 mx-auto mb-2" />
                          <p>No sections match the current filter</p>
                        </div>
                      ) : (
                        filteredSections.map((section) => (
                          <SectionPanel
                            key={section.path}
                            section={section}
                            isExpanded={expandedSections.has(section.path)}
                            onToggle={() => toggleSection(section.path)}
                            variant="revised"
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Section Panel Component
interface SectionPanelProps {
  section: SectionDiff;
  isExpanded: boolean;
  onToggle: () => void;
  variant: 'original' | 'revised';
}

function SectionPanel({ section, isExpanded, onToggle, variant }: SectionPanelProps) {
  const text = variant === 'original' ? section.originalText : section.revisedText;
  const hasContent = text.length > 0;
  const hasChanges = section.stats.additions > 0 || section.stats.deletions > 0;
  
  return (
    <div
      id={`section-${section.path}`}
      className={`border rounded-lg overflow-hidden ${
        hasChanges ? 'border-amber-300' : 'border-slate-200'
      }`}
    >
      <button
        className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronUp className="w-4 h-4" />
          )}
          <span className="font-medium" style={{ paddingLeft: `${(section.level - 1) * 12}px` }}>
            {section.title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <>
              {section.stats.additions > 0 && (
                <Badge className="bg-blue-100 text-blue-700 text-xs">+{section.stats.additions}</Badge>
              )}
              {section.stats.deletions > 0 && (
                <Badge className="bg-rose-100 text-rose-700 text-xs">-{section.stats.deletions}</Badge>
              )}
            </>
          )}
          {!hasContent && (
            <Badge variant="outline" className="text-slate-400 text-xs">
              {variant === 'original' ? 'Removed' : 'New'}
            </Badge>
          )}
        </div>
      </button>
      
      {isExpanded && (
        <div className="p-3 bg-white">
          {hasContent ? (
            <div className="space-y-1">
              {variant === 'original' ? (
                // Show original text with deletions highlighted
                section.diff.map((line, idx) => (
                  line.type !== 'added' && (
                    <DiffLine key={idx} line={line} />
                  )
                ))
              ) : (
                // Show revised text with additions highlighted
                section.diff.map((line, idx) => (
                  line.type !== 'removed' && (
                    <DiffLine key={idx} line={line} />
                  )
                ))
              )}
            </div>
          ) : (
            <p className="text-slate-400 italic text-sm">
              {variant === 'original' ? 'This section was removed' : 'This section was added'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Diff Line Component
function DiffLine({ line }: { line: { type: DiffType; text: string; lineNum?: { old?: number; new?: number } } }) {
  const baseClasses = "text-sm font-mono whitespace-pre-wrap py-0.5 px-2 rounded";
  
  switch (line.type) {
    case 'added':
      return (
        <div className={`${baseClasses} bg-emerald-100 text-emerald-800 border-l-2 border-emerald-500`}>
          <span className="text-emerald-600 mr-2">+</span>
          {line.text || ' '}
        </div>
      );
    case 'removed':
      return (
        <div className={`${baseClasses} bg-rose-100 text-rose-800 border-l-2 border-rose-500`}>
          <span className="text-rose-600 mr-2">−</span>
          {line.text || ' '}
        </div>
      );
    default:
      return (
        <div className={`${baseClasses} text-slate-700`}>
          <span className="text-slate-400 mr-2"> </span>
          {line.text || ' '}
        </div>
      );
  }
}
