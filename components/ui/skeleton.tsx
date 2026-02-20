'use client';

import { cn } from '@/lib/utils';

/**
 * Skeleton Loader Component
 * Used to show loading state while data is being fetched
 * Reduces perceived loading time significantly
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

/**
 * Table Skeleton
 * Shows multiple skeleton rows to match table structure
 */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="grid grid-cols-5 gap-4">
        {Array(5).fill(0).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
      
      {/* Rows */}
      {Array(rows).fill(0).map((_, rowIdx) => (
        <div key={rowIdx} className="grid grid-cols-5 gap-4">
          {Array(5).fill(0).map((_, cellIdx) => (
            <Skeleton key={cellIdx} className="h-12 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Card Skeleton
 * Shows loading state for card components
 */
export function CardSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex gap-4 mt-4">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}

/**
 * Grid Skeleton
 * Shows multiple card skeletons in a grid
 */
export function GridSkeleton({ items = 6, columns = 3 }: { items?: number; columns?: number }) {
  return (
    <div className={`grid grid-cols-${columns} gap-6`}>
      {Array(items).fill(0).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Document Skeleton
 * Shows loading state for document list
 */
export function DocumentListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array(items).fill(0).map((_, i) => (
        <div key={i} className="flex gap-4 p-4 border rounded-lg">
          <Skeleton className="h-12 w-12 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

/**
 * Invoice Skeleton
 * Shows loading state for invoice list
 */
export function InvoiceListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-2">
      {Array(items).fill(0).map((_, i) => (
        <div key={i} className="grid grid-cols-6 gap-4 p-4 border rounded-lg">
          <Skeleton className="h-4" />
          <Skeleton className="h-4" />
          <Skeleton className="h-4" />
          <Skeleton className="h-4" />
          <Skeleton className="h-4" />
          <Skeleton className="h-4" />
        </div>
      ))}
    </div>
  );
}
