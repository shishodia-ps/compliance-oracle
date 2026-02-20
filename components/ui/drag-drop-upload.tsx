'use client';

import { useState, useCallback, ReactNode } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DragDropUploadProps {
  onFilesSelected: (files: File[]) => void;
  acceptedFileTypes?: string[];
  maxSize?: number; // in bytes
  multiple?: boolean;
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
}

/**
 * Drag & Drop File Upload Component
 * Beautiful visual feedback for file uploads
 */
export function DragDropUpload({
  onFilesSelected,
  acceptedFileTypes = ['.pdf', '.doc', '.docx'],
  maxSize = 50 * 1024 * 1024, // 50MB default
  multiple = true,
  disabled = false,
  children,
  className,
}: DragDropUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFiles = useCallback((files: File[]): boolean => {
    setError(null);

    for (const file of files) {
      // Check file size
      if (file.size > maxSize) {
        setError(`File "${file.name}" is too large. Max size is ${(maxSize / 1024 / 1024).toFixed(0)}MB`);
        return false;
      }

      // Check file type
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (acceptedFileTypes.length > 0 && !acceptedFileTypes.includes(ext)) {
        setError(`File type "${ext}" is not supported. Accepted: ${acceptedFileTypes.join(', ')}`);
        return false;
      }
    }

    return true;
  }, [maxSize, acceptedFileTypes]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      
      if (!multiple && files.length > 1) {
        setError('Only one file can be uploaded at a time');
        return;
      }

      if (validateFiles(files)) {
        onFilesSelected(files);
      }
    },
    [multiple, disabled, validateFiles, onFilesSelected]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.currentTarget.files || []);
      
      if (!multiple && files.length > 1) {
        setError('Only one file can be uploaded at a time');
        return;
      }

      if (validateFiles(files)) {
        onFilesSelected(files);
      }
    },
    [multiple, validateFiles, onFilesSelected]
  );

  return (
    <div className="w-full">
      <div
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer',
          isDragging && !disabled && 'border-brand-500 bg-brand-50 dark:bg-brand-950/20',
          !isDragging && 'border-muted-foreground/25 hover:border-muted-foreground/50',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple={multiple}
          disabled={disabled}
          onChange={handleChange}
          accept={acceptedFileTypes.join(',')}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <div className="flex flex-col items-center gap-2">
          <div className={cn(
            'p-3 rounded-lg transition-all',
            isDragging && !disabled ? 'bg-brand-100 dark:bg-brand-900/30' : 'bg-muted'
          )}>
            <Upload
              className={cn(
                'w-8 h-8 transition-colors',
                isDragging && !disabled ? 'text-brand-600 dark:text-brand-400' : 'text-muted-foreground'
              )}
            />
          </div>

          {children ? (
            children
          ) : (
            <>
              <div>
                <p className="font-medium text-foreground">
                  {isDragging ? 'Drop files here' : 'Drag files here or click to upload'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Supported: {acceptedFileTypes.join(', ')} (Max {(maxSize / 1024 / 1024).toFixed(0)}MB)
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="flex gap-2 items-start mt-3 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}
    </div>
  );
}
