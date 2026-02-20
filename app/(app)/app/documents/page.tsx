'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  FileText,
  Upload,
  Search,
  Filter,
  MoreHorizontal,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Download,
  Share2,
  Trash2,
  Eye,
  Receipt,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { useDocumentProgress } from '@/hooks/useDocumentProgress';

interface Document {
  id: string;
  name: string;
  fileName: string;
  documentType: string;
  status: string;
  fileSize: number;
  createdAt: string;
  matter: { name: string } | null;
  _count: { risks: number };
}

const statusIcons: Record<string, React.ReactNode> = {
  ANALYZED: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
  PROCESSING: <Clock className="w-4 h-4 text-amber-500 animate-pulse" />,
  UPLOADED: <Upload className="w-4 h-4 text-slate-400" />,
  ERROR: <AlertTriangle className="w-4 h-4 text-rose-500" />,
};

const statusColors: Record<string, string> = {
  ANALYZED: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
  PROCESSING: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  UPLOADED: 'bg-slate-100 text-slate-700 hover:bg-slate-100',
  ERROR: 'bg-rose-100 text-rose-700 hover:bg-rose-100',
};

const statusLabels: Record<string, string> = {
  ANALYZED: 'Analyzed',
  PROCESSING: 'Processing',
  UPLOADED: 'Uploaded',
  ERROR: 'Error',
};

// Component for showing document processing progress
function DocumentStatusCell({ doc }: { doc: Document }) {
  const { progress } = useDocumentProgress(
    doc.status === 'PROCESSING' ? doc.id : null,
    doc.status
  );

  if (doc.status === 'PROCESSING' && progress) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
          <Badge className={statusColors[doc.status]}>
            {statusLabels[doc.status]}
          </Badge>
        </div>
        <div className="w-32">
          <Progress value={progress.progress} className="h-1.5" />
          <p className="text-xs text-slate-400 mt-1 truncate max-w-[128px]">
            {progress.message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {statusIcons[doc.status]}
      <Badge className={statusColors[doc.status]}>
        {statusLabels[doc.status]}
      </Badge>
    </div>
  );
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const fetchDocuments = async () => {
      try {
        const response = await fetch('/api/documents', { signal: controller.signal });
        if (response.ok) {
          const data = await response.json();
          console.log('API response:', data); // Debug log
          // Handle both old format (array) and new format (object with documents)
          const docs = Array.isArray(data) ? data : (data.documents || []);
          setDocuments(docs);
        } else {
          toast.error('Failed to fetch documents');
        }
      } catch (error: any) {
        if (error?.name === 'AbortError') return;
        toast.error('Error loading documents');
      } finally {
        setIsLoading(false);
      }
    };
    fetchDocuments();
    return () => controller.abort();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/documents');
      if (response.ok) {
        const data = await response.json();
        // Handle both old format (array) and new format (object with documents)
        const docs = Array.isArray(data) ? data : (data.documents || []);
        setDocuments(docs);
      } else {
        toast.error('Failed to fetch documents');
      }
    } catch (error) {
      toast.error('Error loading documents');
    }
  };

  const handleDownload = (docId: string) => {
    window.open(`/api/documents/${docId}/download`, '_blank');
  };

  const handleShare = async (docId: string) => {
    try {
      const response = await fetch(`/api/documents/${docId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresInDays: 7 }),
      });
      
      if (response.ok) {
        const data = await response.json();
        await navigator.clipboard.writeText(data.shareUrl);
        toast.success('Share link copied to clipboard!');
      } else {
        toast.error('Failed to create share link');
      }
    } catch (error) {
      toast.error('Failed to create share link');
    }
  };

  const handleDelete = async (docId: string, docName: string) => {
    if (!confirm(`Are you sure you want to delete "${docName}"?`)) return;
    
    try {
      const response = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        toast.success('Document deleted');
        fetchDocuments(); // Refresh the list
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete document');
      }
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const handleConvertToInvoice = async (docId: string) => {
    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId }),
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success('Document converted to invoice');
        window.open(`/app/invoices/${data.id}`, '_blank');
      } else if (response.status === 409) {
        const data = await response.json();
        toast.info('Invoice already exists for this document');
        window.open(`/app/invoices/${data.invoice.id}`, '_blank');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to convert to invoice');
      }
    } catch (error) {
      toast.error('Failed to convert to invoice');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const filteredDocuments = useMemo(() => documents.filter(
    (doc) =>
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.matter?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.documentType.toLowerCase().includes(searchQuery.toLowerCase())
  ), [documents, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
          <p className="text-slate-500 mt-1">
            Manage and analyze your legal documents
          </p>
        </div>
        <Link href="/app/documents/upload">
          <Button className="bg-amber-500 hover:bg-amber-600 text-white">
            <Upload className="w-4 h-4 mr-2" />
            Upload Document
          </Button>
        </Link>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white border-slate-200"
          />
        </div>
        <Button variant="outline" className="gap-2 border-slate-200">
          <Filter className="w-4 h-4" />
          Filter
        </Button>
      </div>

      {/* Documents Table */}
      <Card className="border-0 shadow-lg bg-white">
        <CardContent className="p-0">
          {filteredDocuments.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No documents yet</h3>
              <p className="text-slate-500 mb-4">Upload your first legal document to get started</p>
              <Link href="/app/documents/upload">
                <Button className="bg-amber-500 hover:bg-amber-600 text-white">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-slate-600">Document</TableHead>
                  <TableHead className="text-slate-600">Type</TableHead>
                  <TableHead className="text-slate-600">Matter</TableHead>
                  <TableHead className="text-slate-600">Status</TableHead>
                  <TableHead className="text-slate-600">Risks</TableHead>
                  <TableHead className="text-slate-600">Created</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc) => (
                  <TableRow key={doc.id} className="group hover:bg-slate-50">
                    <TableCell>
                      <Link
                        href={`/app/documents/${doc.id}`}
                        className="flex items-center gap-3"
                      >
                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                          <FileText className="w-4 h-4 text-slate-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 group-hover:text-amber-600 transition-colors">
                            {doc.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatFileSize(doc.fileSize)}
                          </p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                        {doc.documentType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {doc.matter?.name || '-'}
                    </TableCell>
                    <TableCell>
                      <DocumentStatusCell doc={doc} />
                    </TableCell>
                    <TableCell>
                      {doc._count.risks > 0 ? (
                        <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">
                          {doc._count.risks}
                        </Badge>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {formatDate(doc.createdAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white border-slate-200">
                          <DropdownMenuItem asChild className="cursor-pointer">
                            <Link href={`/app/documents/${doc.id}`} className="flex items-center">
                              <Eye className="w-4 h-4 mr-2" />
                              View
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="cursor-pointer"
                            onClick={() => handleDownload(doc.id)}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="cursor-pointer"
                            onClick={() => handleShare(doc.id)}
                          >
                            <Share2 className="w-4 h-4 mr-2" />
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="cursor-pointer text-amber-600"
                            onClick={() => handleConvertToInvoice(doc.id)}
                          >
                            <Receipt className="w-4 h-4 mr-2" />
                            Convert to Invoice
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-rose-600 cursor-pointer"
                            onClick={() => handleDelete(doc.id, doc.name)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
