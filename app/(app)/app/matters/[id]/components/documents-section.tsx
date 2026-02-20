'use client';

import { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  Import,
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  Loader2,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import Link from 'next/link';

interface Document {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: string;
  createdAt: string;
  isGlobal?: boolean;
}

interface DocumentsSectionProps {
  matterId: string;
  documents: Document[];
  onDocumentImported: () => void;
  onDocumentUploaded: () => void;
  onDocumentsChanged: () => void;
}

const statusColors: Record<string, string> = {
  UPLOADED: 'bg-blue-500/10 text-blue-500',
  PROCESSING: 'bg-amber-500/10 text-amber-500',
  ANALYZED: 'bg-emerald-500/10 text-emerald-500',
  ERROR: 'bg-red-500/10 text-red-500',
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function DocumentsSection({
  matterId,
  documents,
  onDocumentImported,
  onDocumentUploaded,
  onDocumentsChanged,
}: DocumentsSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [globalDocuments, setGlobalDocuments] = useState<Document[]>([]);
  const [isLoadingGlobals, setIsLoadingGlobals] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredDocuments = documents.filter(
    (doc) =>
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fetchGlobalDocuments = async () => {
    try {
      setIsLoadingGlobals(true);
      const response = await fetch('/api/documents?scope=global');
      if (!response.ok) throw new Error('Failed to fetch global documents');
      const data = await response.json();
      // Filter out documents already in this matter
      const matterDocIds = new Set(documents.map((d) => d.id));
      setGlobalDocuments(
        (data.documents || []).filter((d: Document) => !matterDocIds.has(d.id))
      );
    } catch (error) {
      toast.error('Failed to load global documents');
      console.error(error);
    } finally {
      setIsLoadingGlobals(false);
    }
  };

  const handleImportDocument = async (documentId: string) => {
    try {
      const response = await fetch(
        `/api/matters/${matterId}/documents/import`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId }),
        }
      );

      if (!response.ok) throw new Error('Failed to import document');

      onDocumentImported();
      setIsImportDialogOpen(false);
    } catch (error) {
      toast.error('Failed to import document');
      console.error(error);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      setIsUploading(true);
      console.log('Uploading file:', file.name, 'Type:', file.type, 'Size:', file.size);

      // First create document record
      const createResponse = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name.replace(/\.[^/.]+$/, ''),
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          fileSize: file.size,
          matterId: matterId,
        }),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('Create document error:', errorText);
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText };
        }
        throw new Error(error.error || 'Failed to create document');
      }

      const data = await createResponse.json();
      console.log('Create document response:', data);
      
      const document = data.id ? data : data.document;

      if (!document || !document.id) {
        console.error('Invalid document response:', data);
        throw new Error('Invalid response from server - no document ID');
      }

      // Then upload the file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentId', document.id);

      console.log('Uploading to document ID:', document.id);
      
      const uploadResponse = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Upload error:', errorText);
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText };
        }
        throw new Error(error.error || 'Failed to upload file');
      }

      const uploadData = await uploadResponse.json();
      console.log('Upload success:', uploadData);

      onDocumentUploaded();
      setIsUploadDialogOpen(false);
      toast.success('Document uploaded successfully!');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to remove this document from the matter?')) return;

    try {
      const response = await fetch(
        `/api/matters/${matterId}/documents/${documentId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) throw new Error('Failed to remove document');

      onDocumentsChanged();
      toast.success('Document removed from matter');
    } catch (error) {
      toast.error('Failed to remove document');
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Dialog
            open={isImportDialogOpen}
            onOpenChange={(open) => {
              setIsImportDialogOpen(open);
              if (open) fetchGlobalDocuments();
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                <Import className="w-4 h-4 mr-2" />
                Import
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Import from Global Documents</DialogTitle>
                <DialogDescription>
                  Select documents from your organization to add to this matter.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-2 max-h-[50vh] overflow-y-auto">
                {isLoadingGlobals ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                  </div>
                ) : globalDocuments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No available global documents to import.
                  </p>
                ) : (
                  globalDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer"
                      onClick={() => handleImportDocument(doc.id)}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatFileSize(doc.fileSize)} • {doc.fileType}
                          </p>
                        </div>
                      </div>
                      <Badge variant={doc.status === 'ANALYZED' ? 'success' : 'secondary'}>
                        {doc.status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog
            open={isUploadDialogOpen}
            onOpenChange={setIsUploadDialogOpen}
          >
            <DialogTrigger asChild>
              <Button className="bg-amber-500 hover:bg-amber-600">
                <Upload className="w-4 h-4 mr-2" />
                Upload New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Document to Matter</DialogTitle>
                <DialogDescription>
                  This document will only be visible within this matter.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4">
                <div
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-amber-500/50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) handleFileUpload(file);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="font-medium">Drop file here or click to upload</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    PDF, DOC, DOCX up to 50MB
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                  />
                </div>
                {isUploading && (
                  <div className="flex items-center justify-center mt-4">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    <span>Uploading...</span>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Documents List */}
      {filteredDocuments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">No documents in this matter yet</p>
            <p className="text-sm text-muted-foreground">
              Upload new documents or import from your global library
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredDocuments.map((doc) => (
            <Card key={doc.id} className="hover:border-amber-500/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <Link href={`/app/documents/${doc.id}`}>
                        <h3 className="font-medium hover:text-amber-500 transition-colors">
                          {doc.name}
                        </h3>
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {doc.fileName} • {formatFileSize(doc.fileSize)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[doc.status]}>
                      {doc.status}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/app/documents/${doc.id}`}>
                            <ExternalLink className="w-4 h-4 mr-2" />
                            View Document
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-400"
                          onClick={() => handleDeleteDocument(doc.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remove from Matter
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
