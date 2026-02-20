'use client';

import { useState, useEffect, useCallback } from 'react';

interface DocumentProgress {
  status: 'waiting' | 'processing' | 'complete' | 'error';
  progress: number;
  step: string;
  message: string;
  timestamp?: string;
}

export function useDocumentProgress(documentId: string | null, status: string) {
  const [progress, setProgress] = useState<DocumentProgress | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const fetchProgress = useCallback(async (signal?: AbortSignal) => {
    if (!documentId) return;

    try {
      const response = await fetch(`/api/documents/${documentId}/progress`, { signal });
      if (response.ok) {
        const data = await response.json();
        setProgress(data);

        // Stop polling if complete or error
        if (data.status === 'complete' || data.status === 'error') {
          setIsPolling(false);
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      console.error('Progress fetch error:', error);
    }
  }, [documentId]);

  useEffect(() => {
    // Only poll if document is processing
    if (!documentId || status !== 'PROCESSING') {
      setProgress(null);
      setIsPolling(false);
      return;
    }

    const controller = new AbortController();
    setIsPolling(true);

    // Initial fetch
    fetchProgress(controller.signal);

    // Poll every 2 seconds
    const interval = setInterval(() => fetchProgress(controller.signal), 2000);

    return () => {
      controller.abort();
      clearInterval(interval);
      setIsPolling(false);
    };
  }, [documentId, status, fetchProgress]);

  return { progress, isPolling, refresh: fetchProgress };
}
