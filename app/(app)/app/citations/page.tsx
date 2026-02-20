'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CitationReview } from '@/components/legal/citation-review';
import { toast } from 'sonner';

interface Citation {
  id: string;
  queryId: string;
  queryText: string;
  chunkId: string;
  documentId: string;
  documentName: string;
  page: number;
  sectionPath: string;
  quote: string;
  relevanceScore: number;
  matchType: string;
  reviewStatus: 'pending' | 'approved' | 'rejected' | 'commented';
  reviewComment?: string;
  reviewedBy?: { name: string };
  reviewedAt?: string;
}

export default function CitationsPage() {
  const [citations, setCitations] = useState<Citation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    fetchCitations();
  }, []);

  const fetchCitations = async () => {
    try {
      const response = await fetch('/api/citations');
      if (response.ok) {
        const data = await response.json();
        setCitations(data.citations);
      }
    } catch (error) {
      toast.error('Failed to load citations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReview = async (citationId: string, status: string, comment?: string) => {
    const response = await fetch('/api/citations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ citationId, reviewStatus: status, comment }),
    });

    if (response.ok) {
      await fetchCitations();
    } else {
      throw new Error('Failed to update');
    }
  };

  const filteredCitations = citations.filter((c) => 
    activeTab === 'all' ? true : c.reviewStatus === activeTab
  );

  const counts = {
    pending: citations.filter((c) => c.reviewStatus === 'pending').length,
    approved: citations.filter((c) => c.reviewStatus === 'approved').length,
    rejected: citations.filter((c) => c.reviewStatus === 'rejected').length,
    all: citations.length,
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
          <Quote className="w-6 h-6 text-amber-500" />
          Citation Review
        </h1>
        <p className="text-slate-600 mt-1">
          Review and validate AI-generated citations for legal defensibility
        </p>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100">
          <TabsTrigger value="pending" className="data-[state=active]:bg-white data-[state=active]:text-amber-600">
            Pending {counts.pending > 0 && <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-700">{counts.pending}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="approved" className="data-[state=active]:bg-white data-[state=active]:text-emerald-600">Approved ({counts.approved})</TabsTrigger>
          <TabsTrigger value="rejected" className="data-[state=active]:bg-white data-[state=active]:text-rose-600">Rejected ({counts.rejected})</TabsTrigger>
          <TabsTrigger value="all" className="data-[state=active]:bg-white data-[state=active]:text-slate-900">All ({counts.all})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <Card className="border-0 shadow-lg bg-white"><CardContent className="p-8 text-center text-slate-500">Loading...</CardContent></Card>
          ) : filteredCitations.length === 0 ? (
            <Card className="border-0 shadow-lg bg-white">
              <CardContent className="p-8 text-center text-slate-500">
                <Quote className="w-12 h-12 mx-auto mb-4 opacity-30 text-slate-400" />
                <p>No {activeTab} citations found</p>
              </CardContent>
            </Card>
          ) : (
            <CitationReview citations={filteredCitations} onReview={handleReview} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
