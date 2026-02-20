/**
 * MIME Type Validation for Document Uploads
 * Verifies file content matches declared MIME type
 */

// Magic numbers for file type detection
const MAGIC_NUMBERS: Record<string, number[]> = {
  // PDF
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  // DOCX (PK ZIP)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [0x50, 0x4b, 0x03, 0x04],
  // DOC (older Word)
  'application/msword': [0xd0, 0xcf, 0x11, 0xe0],
  // TXT (no magic number, just check content)
  'text/plain': [],
  // RTF
  'application/rtf': [0x7b, 0x5c, 0x72, 0x74],
};

interface MimeValidationResult {
  valid: boolean;
  actualMime?: string;
  error?: string;
}

/**
 * Read file header bytes to detect actual file type
 */
async function readFileHeader(file: File, bytes: number): Promise<Uint8Array> {
  const slice = file.slice(0, bytes);
  return new Uint8Array(await slice.arrayBuffer());
}

/**
 * Detect actual MIME type from file content
 */
function detectMimeFromContent(header: Uint8Array): string | null {
  for (const [mime, magic] of Object.entries(MAGIC_NUMBERS)) {
    if (magic.length === 0) continue; // Skip types without magic numbers
    
    const matches = magic.every((byte, i) => header[i] === byte);
    if (matches) return mime;
  }
  
  // Check if it's text content
  const isText = header.every((byte) => 
    byte >= 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d || byte === 0x00
  );
  
  if (isText) {
    // Check for JSON
    try {
      const text = new TextDecoder().decode(header);
      JSON.parse(text);
      return 'application/json';
    } catch {
      // Not JSON, assume plain text
      return 'text/plain';
    }
  }
  
  return null;
}

/**
 * Validate that file content matches declared MIME type
 */
export async function validateMimeType(file: File): Promise<MimeValidationResult> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const isWordDoc = extension === 'docx' || extension === 'doc';
  
  // Read first 8 bytes
  const header = await readFileHeader(file, 8);
  
  // Detect actual type
  const actualMime = detectMimeFromContent(header);
  
  // For Word docs, check magic numbers match known good signatures
  if (isWordDoc) {
    const isDOCX = header[0] === 0x50 && header[1] === 0x4B; // PK (ZIP)
    const isDOC = header[0] === 0xD0 && header[1] === 0xCF;  // OLE
    
    if (isDOCX || isDOC) {
      return { valid: true };
    }
    
    return {
      valid: false,
      error: 'File does not appear to be a valid Word document',
    };
  }
  
  if (!actualMime) {
    return {
      valid: false,
      error: 'Unable to determine file type from content',
    };
  }
  
  // Allow text/plain as fallback for text files
  if (file.type.startsWith('text/') && actualMime === 'text/plain') {
    return { valid: true };
  }
  
  // Check if declared type matches actual type
  if (file.type !== actualMime) {
    return {
      valid: false,
      actualMime,
      error: `File content (${actualMime}) does not match declared type (${file.type})`,
    };
  }
  
  return { valid: true };
}

/**
 * Check if file extension matches MIME type
 */
export function validateFileExtension(file: File): MimeValidationResult {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const declaredMime = file.type;
  
  // Browsers often report empty or generic MIME types for Word docs
  // Allow empty/unknown MIME types for Word documents
  const isWordDoc = extension === 'docx' || extension === 'doc';
  if (isWordDoc && (!declaredMime || declaredMime === 'application/octet-stream' || declaredMime === '')) {
    return { valid: true };
  }
  
  const extensionToMime: Record<string, string[]> = {
    'pdf': ['application/pdf'],
    'docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream', ''],
    'doc': ['application/msword', 'application/octet-stream', ''],
    'txt': ['text/plain'],
    'rtf': ['application/rtf'],
  };
  
  if (extension && extensionToMime[extension]) {
    const validMimes = extensionToMime[extension];
    if (!validMimes.includes(declaredMime)) {
      return {
        valid: false,
        error: `File extension (.${extension}) does not match content type (${declaredMime})`,
      };
    }
  }
  
  return { valid: true };
}

/**
 * Full MIME validation combining content and extension checks
 */
export async function validateFileMime(file: File): Promise<MimeValidationResult> {
  // First check extension matches MIME
  const extResult = validateFileExtension(file);
  if (!extResult.valid) return extResult;
  
  // Then verify content matches MIME
  const contentResult = await validateMimeType(file);
  if (!contentResult.valid) return contentResult;
  
  return { valid: true };
}
