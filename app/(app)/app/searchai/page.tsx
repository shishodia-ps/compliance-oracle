'use client';

import { useState, useRef } from 'react';
import { Search, FileText, Loader2, Sparkles, ChevronRight, BookOpen, Quote, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

interface SearchResult {
  id: number;
  documentId: string;
  documentName: string;
  nodePath: string;
  nodeTitle?: string;
  content: string;
  summary: string;
  relevance: number;
  reasoning: string;
  citation: string;
}

interface SearchResponse {
  query: string;
  answer: string;
  results: SearchResult[];
  totalDocuments: number;
  totalNodesScanned: number;
  sourcesUsed: number;
}

export default function SearchAIPage() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedSource, setSelectedSource] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Cancel previous search
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setHasSearched(true);
    setSelectedSource(null);
    setResponse(null);

    try {
      const res = await fetch('/api/searchai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      });

      if (!res.ok) {
        toast.error('Search failed');
        setIsLoading(false);
        return;
      }

      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream') && res.body) {
        // Stream SSE tokens
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let streamedAnswer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const payload = JSON.parse(line.slice(6));

              if (payload.token) {
                streamedAnswer += payload.token;
                setResponse(prev => ({
                  query,
                  answer: streamedAnswer,
                  results: prev?.results || [],
                  totalDocuments: prev?.totalDocuments || 0,
                  totalNodesScanned: prev?.totalNodesScanned || 0,
                  sourcesUsed: prev?.sourcesUsed || 0,
                }));
              }

              if (payload.done && !payload.error) {
                setResponse({
                  query: payload.query || query,
                  answer: payload.answer || streamedAnswer,
                  results: payload.results || [],
                  totalDocuments: payload.totalDocuments || 0,
                  totalNodesScanned: payload.totalNodesScanned || 0,
                  sourcesUsed: payload.sourcesUsed || 0,
                });
              }

              if (payload.done && payload.error) {
                toast.error(payload.error);
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }
      } else {
        // Fallback: JSON response
        const data = await res.json();
        setResponse(data);
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      toast.error('Error performing search');
    } finally {
      setIsLoading(false);
    }
  };

  const exampleQueries = [
    'What does section 5.2.10 say about business income?',
    'Explain the termination clauses in my contracts',
    'What are the liability limitations?',
    'Summarize governance requirements',
    'What are the payment terms for invoices?',
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mb-4">
          <Sparkles className="w-8 h-8 text-amber-500" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">SearchAI</h1>
        <p className="text-slate-500 max-w-md mx-auto">
          AI-powered semantic search across all your legal documents with intelligent citations and references.
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            type="search"
            placeholder="Ask anything about your legal documents..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-12 pr-32 py-6 text-lg bg-white border-slate-200 shadow-sm rounded-xl"
          />
          <Button
            type="submit"
            disabled={isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-amber-500 hover:bg-amber-600"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
          </Button>
        </div>
      </form>

      {/* Example Queries */}
      {!hasSearched && (
        <div className="flex flex-wrap justify-center gap-2">
          {exampleQueries.map((example) => (
            <Button
              key={example}
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery(example);
                handleSearch({ preventDefault: () => {} } as any);
              }}
              className="text-slate-600"
            >
              {example}
            </Button>
          ))}
        </div>
      )}

      {/* Results */}
      {hasSearched && (
        <div className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <span className="ml-3 text-slate-500">Searching across documents...</span>
            </div>
          ) : response ? (
            <>
              {/* AI Answer */}
              {response.answer && (
                <Card className="border-amber-200 bg-gradient-to-br from-amber-50/50 to-white">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      <CardTitle className="text-lg">AI Answer</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none text-slate-700">
                      <ReactMarkdown>{response.answer}</ReactMarkdown>
                    </div>
                    <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                      <span>Scanned {response.totalNodesScanned?.toLocaleString() ?? 0} sections</span>
                      <span>•</span>
                      <span>{response.totalDocuments ?? 0} documents</span>
                      <span>•</span>
                      <span>Used {response.sourcesUsed ?? 0} sources</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Sources */}
              {response.results?.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                      <Quote className="w-5 h-5 text-amber-500" />
                      Sources & Citations
                    </h3>
                    <Badge variant="outline" className="text-slate-600">
                      {response.results?.length ?? 0} sources
                    </Badge>
                  </div>

                  {response.results?.map((result) => (
                    <Card 
                      key={result.id} 
                      className={`border-slate-200 transition-all cursor-pointer ${
                        selectedSource === result.id 
                          ? 'ring-2 ring-amber-500 shadow-md' 
                          : 'hover:shadow-md'
                      }`}
                      onClick={() => setSelectedSource(selectedSource === result.id ? null : result.id)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                              <span className="text-lg font-bold text-amber-600">{result.citation}</span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/app/documents/${result.documentId}`}
                                  className="font-semibold text-slate-900 hover:text-amber-600 truncate"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {result.documentName}
                                </Link>
                                <ExternalLink className="w-3 h-3 text-slate-400" />
                              </div>
                              <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                                <ChevronRight className="w-3 h-3 text-amber-500" />
                                <span className="text-amber-600 font-medium truncate">{result.nodePath}</span>
                              </div>
                              <div className="text-xs text-slate-400 mt-1">
                                Match: {result.reasoning}
                              </div>
                            </div>
                          </div>
                          <Badge className="bg-amber-100 text-amber-700 shrink-0">
                            {result.relevance > 1000 ? 'Exact Match' : 
                             result.relevance > 100 ? 'High' : 'Medium'}
                          </Badge>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="pt-0">
                        {result.summary && (
                          <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <p className="text-sm text-slate-700">
                              <span className="font-medium text-amber-600">AI Summary: </span>
                              {result.summary}
                            </p>
                          </div>
                        )}
                        
                        <div className={`text-slate-600 text-sm ${selectedSource === result.id ? '' : 'line-clamp-3'}`}>
                          {result.content}
                        </div>
                        
                        {result.content.length > 300 && (
                          <button 
                            className="text-xs text-amber-600 hover:text-amber-700 mt-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSource(selectedSource === result.id ? null : result.id);
                            }}
                          >
                            {selectedSource === result.id ? 'Show less' : 'Show more'}
                          </button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* No Results */}
              {response.results?.length === 0 && (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-slate-200" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No results found</h3>
                  <p className="text-slate-500 max-w-md mx-auto">
                    {response.answer || 'Try a different query or check if documents have been processed.'}
                  </p>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* Info Card */}
      <Card className="bg-amber-50/50 border-amber-200">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-500" />
            How SearchAI Works
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600 space-y-2">
          <p>
            <strong>1. Master Corpus:</strong> All documents merged into one searchable knowledge base with {response?.totalDocuments || 'your'} documents
          </p>
          <p>
            <strong>2. Hierarchical Trees:</strong> Documents parsed into structured trees (sections → subsections → paragraphs)
          </p>
          <p>
            <strong>3. Smart Retrieval:</strong> Section numbers get priority matching (e.g., "5.2.10" finds exact sections)
          </p>
          <p>
            <strong>4. AI Synthesis:</strong> Kimi generates answers with citations [1], [2], etc. referencing sources
          </p>
          <p>
            <strong>5. Citations:</strong> Every claim is traceable to specific document sections
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
