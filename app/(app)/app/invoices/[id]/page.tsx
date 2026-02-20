'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Receipt,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  FileText,
  Download,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface InvoiceDetail {
  id: string;
  vendorName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  amount: number | null;
  total: number | null;
  currency: string;
  category: string;
  status: string;
  processingError: string | null;
  fileName: string;
  fileType: string;
  fileSize: number;
  storageKey: string;
  createdAt: string;
  document: {
    id: string;
    name: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    storageKey: string;
    status: string;
  } | null;
}

const statusLabels: Record<string, string> = {
  UPLOADED: 'Uploaded',
  PARSING: 'Processing',
  EXTRACTED: 'Processing',
  CLASSIFIED: 'Processing',
  ANALYZED: 'Ready',
  ERROR: 'Failed',
  Ready: 'Ready',
  Processing: 'Processing',
  Queued: 'Queued',
  Failed: 'Failed',
};

function formatCurrency(amount: number | null, currency: string) {
  if (amount == null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount);
}

function formatDate(dateString: string | null) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;
  
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInvoice = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/invoices/${invoiceId}`);
      if (response.ok) {
        const data = await response.json();
        setInvoice(data);
      } else {
        toast.error('Failed to fetch invoice');
        router.push('/app/invoices');
      }
    } catch (error) {
      toast.error('Error loading invoice');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [invoiceId]);

  // Poll for updates if processing
  useEffect(() => {
    if (!invoice) return;
    const isProcessing = ['UPLOADED', 'PARSING', 'EXTRACTED', 'CLASSIFIED', 'Processing', 'Queued'].includes(invoice.status);
    if (!isProcessing) return;

    const interval = setInterval(fetchInvoice, 3000);
    return () => clearInterval(interval);
  }, [invoice?.status]);

  const handleDownload = () => {
    if (invoice?.document) {
      window.open(`/api/documents/${invoice.document.id}/download`, '_blank');
    }
  };

  const handlePreview = () => {
    if (invoice?.document) {
      window.open(`/api/documents/${invoice.document.id}/preview`, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Receipt className="w-12 h-12 text-slate-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-2">Invoice not found</h3>
        <Link href="/app/invoices">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Invoices
          </Button>
        </Link>
      </div>
    );
  }

  const isProcessing = ['UPLOADED', 'PARSING', 'EXTRACTED', 'CLASSIFIED', 'Processing', 'Queued'].includes(invoice.status);
  const isError = invoice.status === 'ERROR' || invoice.status === 'Failed';
  const isReady = invoice.status === 'ANALYZED' || invoice.status === 'Ready';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/app/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-slate-900">
                {invoice.invoiceNumber || invoice.fileName}
              </h1>
              <Badge 
                variant="outline" 
                className={`
                  ${isReady ? 'border-green-200 text-green-700 bg-green-50' : ''}
                  ${isProcessing ? 'border-amber-200 text-amber-700 bg-amber-50' : ''}
                  ${isError ? 'border-red-200 text-red-700 bg-red-50' : ''}
                `}
              >
                <span className="flex items-center gap-1">
                  {isProcessing && <Loader2 className="w-3 h-3 animate-spin" />}
                  {isReady && <CheckCircle className="w-3 h-3" />}
                  {isError && <AlertCircle className="w-3 h-3" />}
                  {statusLabels[invoice.status] || invoice.status}
                </span>
              </Badge>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {invoice.vendorName || 'Unknown Vendor'} • Uploaded {formatDate(invoice.createdAt)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePreview}>
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      {/* Processing State */}
      {isProcessing && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
              <div>
                <p className="font-medium text-amber-900">Processing Invoice</p>
                <p className="text-sm text-amber-700">
                  The invoice is being analyzed. This may take a minute...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {isError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div>
                <p className="font-medium text-red-900">Processing Failed</p>
                <p className="text-sm text-red-700">
                  {invoice.processingError || 'An error occurred during processing.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* File Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              File Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-500">Filename</span>
              <span className="font-medium text-slate-900">{invoice.fileName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Type</span>
              <Badge variant="outline" className="font-normal">
                {invoice.fileType.split('/')[1]?.toUpperCase() || invoice.fileType}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Size</span>
              <span className="font-medium text-slate-900">{formatFileSize(invoice.fileSize)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Uploaded</span>
              <span className="font-medium text-slate-900">{formatDate(invoice.createdAt)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Data (if available) */}
        {isReady && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Receipt className="w-4 h-4 text-slate-400" />
                Extracted Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Vendor</span>
                <span className="font-medium text-slate-900">{invoice.vendorName || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice Number</span>
                <span className="font-medium text-slate-900">{invoice.invoiceNumber || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice Date</span>
                <span className="font-medium text-slate-900">{formatDate(invoice.invoiceDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount</span>
                <span className="font-medium text-slate-900">
                  {formatCurrency(invoice.total || invoice.amount, invoice.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Category</span>
                <Badge variant="outline" className="font-normal">
                  {invoice.category || 'OTHER'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pending Processing Message */}
      {!isReady && !isError && (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">Invoice Pending Analysis</h3>
          <p className="text-slate-500 max-w-md mx-auto">
            The invoice has been uploaded but not yet processed. 
            Detailed information will be available after processing is complete.
          </p>
        </div>
      )}
    </div>
  );
}
