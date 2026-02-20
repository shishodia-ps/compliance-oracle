'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle, MessageSquare, Quote } from 'lucide-react';
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

interface CitationReviewProps {
  citations: Citation[];
  onReview: (citationId: string, status: string, comment?: string) => Promise<void>;
}

export function CitationReview({ citations, onReview }: CitationReviewProps) {
  const [comment, setComment] = useState('');
  const [activeCitation, setActiveCitation] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReview = async (citationId: string, status: string) => {
    setIsSubmitting(true);
    try {
      await onReview(citationId, status, comment);
      toast.success(`Citation ${status}`);
      setComment('');
      setActiveCitation(null);
    } catch (error) {
      toast.error('Failed to update citation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case 'commented':
        return <Badge variant="secondary"><MessageSquare className="w-3 h-3 mr-1" />Commented</Badge>;
      default:
        return <Badge variant="outline">Pending Review</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {citations.map((citation) => (
        <Card key={citation.id} className={`bg-white border-0 shadow-md ${citation.reviewStatus === 'pending' ? 'ring-1 ring-amber-200' : ''}`}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Quote className="w-4 h-4 text-amber-500" />
                  {citation.documentName}
                </CardTitle>
                <div className="text-sm text-slate-500 mt-1">
                  {citation.sectionPath} • Page {citation.page}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {getStatusBadge(citation.reviewStatus)}
                <span className="text-xs text-slate-400">
                  {(citation.relevanceScore * 100).toFixed(0)}% match
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">Query: {citation.queryText}</div>
              <blockquote className="text-sm text-slate-700 italic border-l-2 border-amber-400 pl-3">
                "{citation.quote.substring(0, 300)}{citation.quote.length > 300 ? '...' : ''}"
              </blockquote>
            </div>

            {citation.reviewStatus === 'pending' ? (
              <div className="space-y-3">
                {activeCitation === citation.id ? (
                  <>
                    <Textarea
                      placeholder="Add a comment (optional)..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="min-h-[80px]"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-emerald-500 hover:bg-emerald-600 text-white"
                        onClick={() => handleReview(citation.id, 'approved')}
                        disabled={isSubmitting}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReview(citation.id, 'rejected')}
                        disabled={isSubmitting}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReview(citation.id, 'commented')}
                        disabled={isSubmitting}
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Comment
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setActiveCitation(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => setActiveCitation(citation.id)}>
                    Review Citation
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-sm">
                <div className="flex items-center gap-2 text-slate-500">
                  <span>Reviewed by {citation.reviewedBy?.name || 'Unknown'}</span>
                  <span>•</span>
                  <span>{citation.reviewedAt ? new Date(citation.reviewedAt).toLocaleDateString() : ''}</span>
                </div>
                {citation.reviewComment && (
                  <div className="mt-2 p-2 bg-slate-50 rounded text-sm text-slate-700">
                    <strong>Comment:</strong> {citation.reviewComment}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
