import { FileValidationError } from './errors';

// File type signatures (magic numbers)
const FILE_SIGNATURES: Record<string, number[]> = {
  'pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
  'png': [0x89, 0x50, 0x4E, 0x47], // ‰PNG
  'jpg': [0xFF, 0xD8, 0xFF],       // JPEG
  'jpeg': [0xFF, 0xD8, 0xFF],
  'gif': [0x47, 0x49, 0x46, 0x38], // GIF8
  'docx': [0x50, 0x4B, 0x03, 0x04], // PK (ZIP format)
  'doc': [0xD0, 0xCF, 0x11, 0xE0], // OLE format
  'xlsx': [0x50, 0x4B, 0x03, 0x04],
  'xls': [0xD0, 0xCF, 0x11, 0xE0],
  'zip': [0x50, 0x4B, 0x03, 0x04],
};

// MIME type mapping
const MIME_TYPES: Record<string, string> = {
  'pdf': 'application/pdf',
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'gif': 'image/gif',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'doc': 'application/msword',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'xls': 'application/vnd.ms-excel',
};

// File extension to type mapping
const EXTENSION_MAP: Record<string, string> = {
  '.pdf': 'pdf',
  '.png': 'png',
  '.jpg': 'jpg',
  '.jpeg': 'jpeg',
  '.gif': 'gif',
  '.docx': 'docx',
  '.doc': 'doc',
  '.xlsx': 'xlsx',
  '.xls': 'xls',
};

export interface ValidationOptions {
  maxSize?: number;           // Max file size in bytes
  allowedTypes?: string[];    // Allowed MIME types
  allowedExtensions?: string[]; // Allowed file extensions
  checkMagicNumber?: boolean; // Verify file signature
  scanContent?: boolean;      // Basic content scanning (not full virus scan)
}

export interface ValidationResult {
  valid: boolean;
  fileType: string;
  extension: string;
  size: number;
  errors: string[];
}

/**
 * Validate file type using magic numbers
 */
export async function validateFileType(
  buffer: Buffer,
  claimedType?: string
): Promise<{ type: string; confidence: 'high' | 'medium' | 'low' }> {
  // Check first 8 bytes
  const header = Array.from(buffer.slice(0, 8));
  
  for (const [type, signature] of Object.entries(FILE_SIGNATURES)) {
    const matches = signature.every((byte, index) => header[index] === byte);
    if (matches) {
      return { type, confidence: 'high' };
    }
  }
  
  // If no magic number match, check if it's a text file
  const isText = buffer.every(byte => byte >= 32 || byte === 9 || byte === 10 || byte === 13);
  if (isText) {
    return { type: 'txt', confidence: 'medium' };
  }
  
  // Fallback to claimed type with low confidence
  if (claimedType) {
    const ext = claimedType.split('/').pop()?.toLowerCase() || '';
    return { type: ext, confidence: 'low' };
  }
  
  return { type: 'unknown', confidence: 'low' };
}

/**
 * Check for suspicious content (basic check, not a full virus scan)
 */
export function scanContent(buffer: Buffer, fileName: string): string[] {
  const issues: string[] = [];
  
  // Get file signature (first few bytes)
  const fileSignature = buffer.slice(0, 8);
  
  // Known good document signatures
  const isPDF = fileSignature[0] === 0x25 && fileSignature[1] === 0x50; // %PDF
  const isDOCX = fileSignature[0] === 0x50 && fileSignature[1] === 0x4B; // PK (ZIP)
  const isDOC = fileSignature[0] === 0xD0 && fileSignature[1] === 0xCF; // OLE
  
  // Only check for executables if it's not a known document type
  if (!isPDF && !isDOCX && !isDOC) {
    // Check for executable signatures at the START of file only
    const isEXE = fileSignature[0] === 0x4D && fileSignature[1] === 0x5A; // MZ
    const isELF = fileSignature[0] === 0x7F && fileSignature[1] === 0x45 && 
                  fileSignature[2] === 0x4C && fileSignature[3] === 0x46;
    
    if (isEXE) {
      issues.push('Windows executable (EXE) files are not allowed');
    }
    if (isELF) {
      issues.push('ELF executable files are not allowed');
    }
  }
  
  // Check for script signatures anywhere in file
  const contentString = buffer.toString('utf-8', 0, Math.min(buffer.length, 8192));
  
  if (contentString.includes('#!/') && !isPDF && !isDOCX && !isDOC) {
    issues.push('Shell script signature detected');
  }
  if (contentString.includes('<?php') && !isPDF && !isDOCX && !isDOC) {
    issues.push('PHP code detected');
  }
  
  // Check file extension
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.exe') || lowerName.endsWith('.dll') || 
      lowerName.endsWith('.bat') || lowerName.endsWith('.sh') ||
      lowerName.endsWith('.cmd')) {
    issues.push('Executable file extension not allowed');
  }
  
  return issues;
}

/**
 * Comprehensive file validation
 */
export async function validateFile(
  file: File,
  buffer: Buffer,
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const {
    maxSize = 50 * 1024 * 1024, // 50MB default
    allowedTypes,
    allowedExtensions,
    checkMagicNumber = true,
    scanContent: doScan = true,
  } = options;
  
  const errors: string[] = [];
  const extension = '.' + file.name.split('.').pop()?.toLowerCase() || '';
  
  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = maxSize / (1024 * 1024);
    const fileSizeMB = file.size / (1024 * 1024);
    errors.push(`File size (${fileSizeMB.toFixed(2)} MB) exceeds maximum allowed (${maxSizeMB.toFixed(2)} MB)`);
  }
  
  // Check file extension
  if (allowedExtensions && !allowedExtensions.includes(extension)) {
    errors.push(`File extension '${extension}' not allowed. Allowed: ${allowedExtensions.join(', ')}`);
  }
  
  // Check MIME type
  if (allowedTypes && !allowedTypes.includes(file.type)) {
    errors.push(`File type '${file.type}' not allowed`);
  }
  
  // Validate using magic numbers
  let detectedType = 'unknown';
  if (checkMagicNumber) {
    const validation = await validateFileType(buffer, file.type);
    detectedType = validation.type;
    
    // Check if detected type matches claimed type
    if (validation.confidence === 'high' && file.type) {
      const expectedExt = MIME_TYPES[detectedType];
      if (expectedExt && file.type !== expectedExt && 
          !(detectedType === 'jpg' && file.type === 'image/jpeg')) {
        errors.push(`File content (${detectedType}) does not match claimed type (${file.type}). Possible file spoofing.`);
      }
    }
    
    // Check if detected type is in allowed types
    if (allowedTypes && detectedType !== 'unknown') {
      const detectedMime = MIME_TYPES[detectedType];
      if (detectedMime && !allowedTypes.includes(detectedMime)) {
        errors.push(`Detected file type (${detectedType}) is not in the allowed types list`);
      }
    }
  }
  
  // Content scanning
  if (doScan) {
    const contentIssues = scanContent(buffer, file.name);
    errors.push(...contentIssues);
  }
  
  return {
    valid: errors.length === 0,
    fileType: detectedType,
    extension,
    size: file.size,
    errors,
  };
}

/**
 * Validate document upload
 */
export async function validateDocumentUpload(
  file: File,
  buffer: Buffer
): Promise<void> {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  
  const allowedExtensions = ['.pdf', '.doc', '.docx'];
  
  const result = await validateFile(file, buffer, {
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedTypes,
    allowedExtensions,
    checkMagicNumber: true,
    scanContent: true,
  });
  
  if (!result.valid) {
    throw new FileValidationError(
      `Document validation failed: ${result.errors.join(', ')}`,
      file.type,
      allowedTypes
    );
  }
}

/**
 * Validate invoice upload
 */
export async function validateInvoiceUpload(
  file: File,
  buffer: Buffer
): Promise<void> {
  const allowedTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
  ];
  
  const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];
  
  const result = await validateFile(file, buffer, {
    maxSize: 20 * 1024 * 1024, // 20MB for invoices
    allowedTypes,
    allowedExtensions,
    checkMagicNumber: true,
    scanContent: true,
  });
  
  if (!result.valid) {
    // Provide specific guidance based on error type
    const errors = result.errors;
    let message = 'Invoice upload failed:\n';
    
    if (errors.some(e => e.includes('size'))) {
      message += '\n• File is too large. Maximum size is 20MB. Try compressing the image or using a lower resolution scan.';
    }
    
    if (errors.some(e => e.includes('extension') || e.includes('type'))) {
      message += '\n• Invalid file format. Please upload PDF, PNG, or JPG/JPEG files only.';
      message += '\n• For scanned documents, use PDF or high-quality JPG (300+ DPI recommended).';
    }
    
    if (errors.some(e => e.includes('spoofing') || e.includes('content'))) {
      message += '\n• File content mismatch detected. The file may be corrupted or renamed incorrectly.';
    }
    
    if (errors.some(e => e.includes('Executable') || e.includes('script'))) {
      message += '\n• Security alert: Executable content detected. Please upload only document/image files.';
    }
    
    throw new FileValidationError(message, file.type, allowedTypes);
  }
}
