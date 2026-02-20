'use client';

import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
  className?: string;
}

/**
 * Empty State Component
 * Replaces blank lists/tables with helpful guidance
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12', className)}>
      <div className="p-4 bg-muted rounded-lg mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
        {description}
      </p>
      
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
      
      {children}
    </div>
  );
}

interface EmptySearchProps {
  query: string;
  onClear?: () => void;
}

/**
 * Empty Search Results
 * Shown when search returns no results
 */
export function EmptySearchResults({ query, onClear }: EmptySearchProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="p-4 bg-muted rounded-lg mb-4">
        <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      
      <h3 className="font-semibold text-lg mb-2">No results found</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
        No documents match "<strong>{query}</strong>"
      </p>
      
      <div className="flex gap-3">
        <Button variant="outline" onClick={onClear}>
          Clear search
        </Button>
        <Button variant="outline">
          Try different keywords
        </Button>
      </div>
    </div>
  );
}

interface EmptyErrorProps {
  title: string;
  description: string;
  onRetry?: () => void;
  onGoBack?: () => void;
}

/**
 * Empty Error State
 * Shown when an error occurs
 */
export function EmptyErrorState({
  title,
  description,
  onRetry,
  onGoBack,
}: EmptyErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="p-4 bg-red-100 dark:bg-red-950 rounded-lg mb-4">
        <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      </div>
      
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
        {description}
      </p>
      
      <div className="flex gap-3">
        {onRetry && (
          <Button onClick={onRetry}>
            Try again
          </Button>
        )}
        {onGoBack && (
          <Button variant="outline" onClick={onGoBack}>
            Go back
          </Button>
        )}
      </div>
    </div>
  );
}
