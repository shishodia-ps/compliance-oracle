'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { toast } from 'sonner';

interface UploadingFile {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

export default function UploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<UploadingFile[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'uploading' as const,
    }));

    setFiles((prev) => [...prev, ...newFiles]);

    // Start uploading each file
    newFiles.forEach((file) => {
      uploadFile(file);
    });
  }, []);

  const uploadFile = async (uploadingFile: UploadingFile) => {
    try {
      // Step 1: Create document record
      const createResponse = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: uploadingFile.name,
          fileName: uploadingFile.name,
          fileType: uploadingFile.file.type,
          fileSize: uploadingFile.size,
          documentType: getDocumentType(uploadingFile.name),
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || 'Failed to create document record');
      }

      const document = await createResponse.json();

      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadingFile.id ? { ...f, progress: 50, status: 'processing' } : f
        )
      );

      // Step 2: Upload file to storage
      const formData = new FormData();
      formData.append('file', uploadingFile.file);
      formData.append('documentId', document.id);

      const uploadResponse = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || 'Failed to upload file');
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadingFile.id ? { ...f, progress: 100, status: 'completed' } : f
        )
      );

      toast.success(`${uploadingFile.name} uploaded successfully`);

      // Redirect to documents list after a short delay
      setTimeout(() => {
        router.push('/app/documents');
      }, 1500);

    } catch (error) {
      console.error('Upload error:', error);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadingFile.id
            ? { ...f, status: 'error', error: 'Upload failed' }
            : f
        )
      );
      toast.error(`Failed to upload ${uploadingFile.name}`);
    }
  };

  const getDocumentType = (filename: string): string => {
    const lower = filename.toLowerCase();
    if (lower.includes('contract')) return 'CONTRACT';
    if (lower.includes('agreement')) return 'AGREEMENT';
    if (lower.includes('policy')) return 'POLICY';
    if (lower.includes('memo')) return 'MEMO';
    if (lower.includes('brief')) return 'BRIEF';
    if (lower.includes('pleading')) return 'PLEADING';
    if (lower.includes('correspondence')) return 'CORRESPONDENCE';
    return 'OTHER';
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/app/documents">
          <Button variant="ghost" size="icon" className="hover:bg-slate-100">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Upload Documents</h1>
          <p className="text-slate-500 mt-1">
            Upload legal documents for AI analysis
          </p>
        </div>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-amber-400 bg-amber-50'
            : 'border-slate-200 hover:border-amber-300 bg-white'
        }`}
      >
        <input {...getInputProps()} />
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <Upload className="w-8 h-8 text-amber-500" />
        </div>
        <h3 className="text-lg font-medium text-slate-900 mb-2">
          {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
        </h3>
        <p className="text-slate-500 mb-4">
          or click to browse from your computer
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
          <Badge variant="secondary" className="bg-slate-100">PDF</Badge>
          <Badge variant="secondary" className="bg-slate-100">DOC</Badge>
          <Badge variant="secondary" className="bg-slate-100">DOCX</Badge>
        </div>
        <p className="text-xs text-slate-400 mt-4">
          Maximum file size: 50MB
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-slate-900">Uploading Files</h3>
          {files.map((file) => (
            <Card key={file.id} className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    {file.status === 'uploading' || file.status === 'processing' ? (
                      <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                    ) : file.status === 'completed' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-slate-900 truncate">{file.name}</p>
                      <button
                        onClick={() => removeFile(file.id)}
                        className="text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-4">
                      <Progress value={file.progress} className="flex-1 h-2" />
                      <span className="text-sm text-slate-500 w-16 text-right">
                        {Math.round(file.progress)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-slate-400">
                        {formatFileSize(file.size)}
                      </span>
                      {file.status === 'processing' && (
                        <Badge className="text-xs bg-amber-100 text-amber-700">
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Processing
                        </Badge>
                      )}
                      {file.status === 'completed' && (
                        <Badge className="text-xs bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Completed
                        </Badge>
                      )}
                      {file.status === 'error' && (
                        <Badge className="text-xs bg-rose-100 text-rose-700">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {file.error || 'Error'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tips */}
      <Card className="border-slate-200 bg-white">
        <CardContent className="p-5">
          <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            Tips for best results
          </h3>
          <ul className="space-y-2 text-sm text-slate-500">
            <li>• Ensure scanned documents are clear and legible</li>
            <li>• Remove passwords from PDFs before uploading</li>
            <li>• For large batches, consider using the API</li>
            <li>• Review AI extractions for critical documents</li>
          </ul>
        </CardContent>
      </Card>

      {/* Pipeline Info */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-5">
          <h3 className="font-medium text-slate-900 mb-2">What happens next?</h3>
          <p className="text-sm text-slate-600 mb-3">
            After upload, your document will be processed by the AI pipeline:
          </p>
          <ol className="space-y-2 text-sm text-slate-600 list-decimal list-inside">
            <li><strong>Extract</strong> - Text extraction using LlamaCloud OCR</li>
            <li><strong>Index</strong> - Semantic indexing with hierarchical structure</li>
            <li><strong>Enrich</strong> - AI-powered summaries and risk detection</li>
            <li><strong>Query</strong> - Ready for legal Q&A and analysis</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
