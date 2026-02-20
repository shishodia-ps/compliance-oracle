'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Quote, BookOpen, AlertTriangle } from 'lucide-react';

interface DocumentReaderProps {
  documentId: string;
  documentName: string;
  chunks: Array<{ id: string; page: number; sectionPath: string; text: string; level: number }>;
  citations?: Array<{ id: string; chunkId: string; page: number; sectionPath: string; reviewStatus: string }>;
  risks?: Array<{ id: string; title: string; severity: string; page?: number }>;
}

export function DocumentReader({ documentName, chunks, citations = [], risks = [] }: DocumentReaderProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [activeCitation, setActiveCitation] = useState<string | null>(null);

  const pages = Array.from(new Set(chunks.map((c) => c.page).filter(Boolean))).sort((a, b) => a - b);
  const currentChunks = chunks.filter((c) => c.page === currentPage);

  return (
    <div className="flex gap-4">
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between p-3 border-b bg-card rounded-t-lg">
          <div className="flex items-center gap-4">
            <h2 className="font-semibold">{documentName}</h2>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm">Page {currentPage} of {pages.length || 1}</span>
              <Button variant="ghost" size="icon" onClick={() => setCurrentPage((p) => Math.min(pages.length || 1, p + 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.max(50, z - 10))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm w-12 text-center">{zoom}%</span>
            <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.min(200, z + 10))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <Card className="flex-1 overflow-hidden">
          <CardContent className="p-8 overflow-y-auto" style={{ fontSize: `${zoom}%` }}>
            <div className="space-y-6 max-w-3xl mx-auto">
              {currentChunks.map((chunk) => (
                <div
                  key={chunk.id}
                  className={`p-4 rounded-lg border ${activeCitation === chunk.id ? 'border-ice-500 bg-ice-500/10' : 'border-transparent'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-muted-foreground">{chunk.sectionPath}</span>
                    {citations.some((c) => c.chunkId === chunk.id) && (
                      <Badge variant="secondary"><Quote className="w-3 h-3 mr-1" />Cited</Badge>
                    )}
                  </div>
                  <div className="prose prose-sm">{chunk.text}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="w-80">
        <Tabs defaultValue="outline">
          <TabsList className="w-full">
            <TabsTrigger value="outline"><BookOpen className="w-4 h-4 mr-2" />Outline</TabsTrigger>
            <TabsTrigger value="citations"><Quote className="w-4 h-4 mr-2" />Citations</TabsTrigger>
            <TabsTrigger value="risks"><AlertTriangle className="w-4 h-4 mr-2" />Risks</TabsTrigger>
          </TabsList>

          <TabsContent value="outline" className="mt-4">
            <div className="space-y-2">
              {chunks.filter((c) => c.level <= 2).map((chunk) => (
                <Button
                  key={chunk.id}
                  variant="ghost"
                  className="w-full justify-start text-left"
                  onClick={() => setCurrentPage(chunk.page)}
                >
                  <span className="truncate">{chunk.sectionPath}</span>
                  <span className="ml-auto text-xs text-muted-foreground">p.{chunk.page}</span>
                </Button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="citations" className="mt-4">
            <div className="space-y-2">
              {citations.map((citation) => (
                <div
                  key={citation.id}
                  className={`p-3 rounded-lg border cursor-pointer ${activeCitation === citation.id ? 'border-ice-500 bg-ice-500/10' : 'border-border'}`}
                  onClick={() => { setActiveCitation(citation.id); setCurrentPage(citation.page); }}
                >
                  <div className="text-sm font-medium">{citation.sectionPath}</div>
                  <div className="text-xs text-muted-foreground">Page {citation.page}</div>
                  <Badge variant={citation.reviewStatus === 'approved' ? 'default' : citation.reviewStatus === 'rejected' ? 'destructive' : 'secondary'}>
                    {citation.reviewStatus}
                  </Badge>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="risks" className="mt-4">
            <div className="space-y-2">
              {risks.map((risk) => (
                <div key={risk.id} className="p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="font-medium">{risk.title}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Page {risk.page}</div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
