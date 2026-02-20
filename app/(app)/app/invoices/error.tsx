'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InvoicesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Invoices error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
      <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-rose-600" />
      </div>
      <h2 className="text-xl font-semibold text-slate-900 mb-2">Failed to load invoices</h2>
      <p className="text-slate-500 text-center max-w-md mb-6">
        {error.message || 'An unexpected error occurred while loading invoices.'}
      </p>
      <Button onClick={reset} className="bg-amber-500 hover:bg-amber-600 text-white">
        <RefreshCw className="w-4 h-4 mr-2" />
        Try again
      </Button>
    </div>
  );
}
