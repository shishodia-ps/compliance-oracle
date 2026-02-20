'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  FolderOpen,
  FileText,
  Upload,
  Import,
  Network,
  ArrowLeft,
  Loader2,
  Calendar,
  Tag,
  MoreHorizontal,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { toast } from 'sonner';
import { DocumentsSection } from './components/documents-section';
import { GraphAnalysis } from './components/graph-analysis';

interface Matter {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  tags: string[];
  _count: {
    documents: number;
    tasks: number;
  };
}

interface Document {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: string;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-500',
  PENDING: 'bg-amber-500/10 text-amber-500',
  CLOSED: 'bg-slate-500/10 text-slate-500',
  ARCHIVED: 'bg-gray-500/10 text-gray-500',
};

const priorityColors: Record<string, string> = {
  high: 'bg-red-500/10 text-red-500',
  medium: 'bg-amber-500/10 text-amber-500',
  low: 'bg-blue-500/10 text-blue-500',
};

export default function MatterDetailPage() {
  const params = useParams();
  const matterId = params.id as string;
  
  const [matter, setMatter] = useState<Matter | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('documents');

  useEffect(() => {
    if (matterId) {
      fetchMatter();
      fetchDocuments();
    }
  }, [matterId]);

  const fetchMatter = async () => {
    try {
      const response = await fetch(`/api/matters/${matterId}`);
      if (!response.ok) throw new Error('Failed to fetch matter');
      const data = await response.json();
      setMatter(data);
    } catch (error) {
      toast.error('Failed to load matter');
      console.error(error);
    }
  };

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/matters/${matterId}/documents`);
      if (!response.ok) throw new Error('Failed to fetch documents');
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      toast.error('Failed to load documents');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDocumentImported = () => {
    fetchDocuments();
    toast.success('Document imported successfully');
  };

  const handleDocumentUploaded = () => {
    fetchDocuments();
    fetchMatter(); // Update document count
    toast.success('Document uploaded successfully');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!matter) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <FolderOpen className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Matter not found</p>
        <Link href="/app/matters">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Matters
          </Button>
        </Link>
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
        <Link href="/app/matters">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Matters
          </Button>
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <FolderOpen className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{matter.name}</h1>
                <p className="text-muted-foreground">
                  {matter.description || 'No description'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <Badge className={statusColors[matter.status]}>
                {matter.status}
              </Badge>
              <Badge className={priorityColors[matter.priority]}>
                {matter.priority} Priority
              </Badge>
              {matter.tags?.map((tag) => (
                <Badge key={tag} variant="secondary">
                  <Tag className="w-3 h-3 mr-1" />
                  {tag}
                </Badge>
              ))}
              {matter.dueDate && (
                <Badge variant="outline">
                  <Calendar className="w-3 h-3 mr-1" />
                  Due {new Date(matter.dueDate).toLocaleDateString()}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right mr-4">
              <p className="text-2xl font-bold">{matter._count.documents}</p>
              <p className="text-sm text-muted-foreground">Documents</p>
            </div>
            <Button variant="outline" size="icon">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:w-auto">
            <TabsTrigger value="documents" className="gap-2">
              <FileText className="w-4 h-4" />
              Documents ({documents.length})
            </TabsTrigger>
            <TabsTrigger value="graph" className="gap-2">
              <Network className="w-4 h-4" />
              Graph Analysis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="mt-6">
            <DocumentsSection
              matterId={matterId}
              documents={documents}
              onDocumentImported={handleDocumentImported}
              onDocumentUploaded={handleDocumentUploaded}
              onDocumentsChanged={fetchDocuments}
            />
          </TabsContent>

          <TabsContent value="graph" className="mt-6">
            <GraphAnalysis
              matterId={matterId}
              documents={documents}
            />
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
