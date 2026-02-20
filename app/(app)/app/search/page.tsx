'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  FileText,
  Loader2,
  Filter,
  X,
  ChevronRight,
  Quote,
  Scale,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface SearchResult {
  id: string;
  documentId: string;
  text: string;
  sectionPath: string;
  page?: number;
  chunkType: string;
  clauseType?: string;
  documentName: string;
  documentType: string;
  matterName?: string;
  rank: number;
}

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [executionTime, setExecutionTime] = useState(0);

  const performSearch = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchTerm }),
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data.results);
        setExecutionTime(data.executionTime);
      } else {
        toast.error('Search failed');
      }
    } catch (error) {
      toast.error('Error performing search');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery, performSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(query);
    router.push(`/app/search?q=${encodeURIComponent(query)}`);
    performSearch(query);
  };

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-amber-200 text-amber-900 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Google-style Search Header */}
      <div className="flex items-center gap-4 py-4">
        <Link href="/app" className="flex items-center gap-2">
          <Scale className="w-8 h-8 text-amber-500" />
          <span className="text-xl font-bold text-slate-900">Legal AI</span>
        </Link>
        <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-amber-500" />
            <Input
              type="search"
              placeholder="Search your legal documents..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-12 pr-12 py-6 text-lg bg-white border-slate-200 shadow-sm rounded-full focus-visible:ring-amber-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Search Stats */}
      {searchQuery && !isLoading && (
        <div className="text-sm text-slate-500 px-2">
          About {results.length} results ({executionTime / 1000} seconds) for "{searchQuery}"
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      )}

      {/* Results */}
      {!isLoading && results.length > 0 && (
        <div className="space-y-4">
          {results.map((result) => (
            <Card
              key={result.id}
              className="border-0 shadow-sm hover:shadow-md transition-shadow bg-white"
            >
              <CardContent className="p-5">
                {/* Result Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <Link
                        href={`/app/documents/${result.documentId}`}
                        className="text-lg font-medium text-blue-600 hover:underline line-clamp-1"
                      >
                        {result.documentName}
                      </Link>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span>{result.documentType}</span>
                        {result.matterName && (
                          <>
                            <span>•</span>
                            <span>{result.matterName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-slate-100">
                    Page {result.page || 'N/A'}
                  </Badge>
                </div>

                {/* Section Path */}
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                  <ChevronRight className="w-4 h-4" />
                  <span className="text-amber-600">{result.sectionPath}</span>
                </div>

                {/* Result Text */}
                <div className="relative pl-4 border-l-2 border-slate-200">
                  <Quote className="absolute -left-2.5 -top-1 w-4 h-4 text-slate-300 bg-white" />
                  <p className="text-slate-700 leading-relaxed line-clamp-3">
                    {highlightText(result.text, searchQuery)}
                  </p>
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-2 mt-3">
                  {result.clauseType && (
                    <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50">
                      {result.clauseType}
                    </Badge>
                  )}
                  <Badge className="bg-slate-50 text-slate-600 hover:bg-slate-50">
                    Relevance: {Math.round(result.rank * 100)}%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && searchQuery && results.length === 0 && (
        <div className="text-center py-20">
          <Search className="w-16 h-16 mx-auto mb-4 text-slate-200" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No results found</h3>
          <p className="text-slate-500 max-w-md mx-auto">
            We couldn't find any matches for "{searchQuery}". Try different keywords or check your spelling.
          </p>
        </div>
      )}

      {/* Initial State */}
      {!searchQuery && !isLoading && (
        <div className="text-center py-20">
          <Scale className="w-16 h-16 mx-auto mb-4 text-amber-200" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">Search your legal documents</h3>
          <p className="text-slate-500 max-w-md mx-auto">
            Search across all your uploaded documents using keywords, clauses, or concepts.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery('termination clause');
                performSearch('termination clause');
              }}
            >
              termination clause
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery('liability limitation');
                performSearch('liability limitation');
              }}
            >
              liability limitation
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery('payment terms');
                performSearch('payment terms');
              }}
            >
              payment terms
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
