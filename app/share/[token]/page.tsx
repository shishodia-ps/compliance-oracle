'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { FileText, Download, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ShareData {
  document: {
    id: string;
    name: string;
    fileType: string;
  };
  canDownload: boolean;
  expiresAt: string;
}

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;
  
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    validateShareToken();
  }, [token]);

  const validateShareToken = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/share/${token}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Invalid or expired share link');
      }

      const data = await response.json();
      setShareData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!shareData?.canDownload) return;
    
    try {
      const response = await fetch(`/api/share/${token}/download`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = shareData.document.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert('Failed to download file');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              This share link may have expired or been revoked.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle>{shareData?.document.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Expires: {shareData ? new Date(shareData.expiresAt).toLocaleDateString() : ''}
                  </p>
                </div>
              </div>
              {shareData?.canDownload && (
                <Button onClick={handleDownload} className="bg-amber-500 hover:bg-amber-600">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Document shared securely</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
