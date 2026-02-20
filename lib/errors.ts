/**
 * Custom error classes for proper error categorization
 */

export enum ErrorCode {
  // Auth errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',
  
  // Processing errors
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  QUEUE_ERROR = 'QUEUE_ERROR',
  AI_ERROR = 'AI_ERROR',
  
  // Database errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  
  // External service errors
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  
  // Generic
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    statusCode: number = 500,
    details?: Record<string, any>,
    isOperational: boolean = true
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Auth errors
export class AuthError extends AppError {
  constructor(
    message: string = 'Authentication required',
    code: ErrorCode = ErrorCode.UNAUTHORIZED,
    details?: Record<string, any>
  ) {
    super(message, code, 401, details);
  }
}

export class TokenExpiredError extends AuthError {
  constructor(message: string = 'Session expired. Please log in again.') {
    super(message, ErrorCode.TOKEN_EXPIRED);
  }
}

// Validation errors
export class ValidationError extends AppError {
  constructor(
    message: string = 'Validation failed',
    details?: Record<string, any>
  ) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, details);
  }
}

export class FileValidationError extends AppError {
  constructor(
    message: string,
    public readonly fileType?: string,
    public readonly allowedTypes?: string[]
  ) {
    super(message, ErrorCode.INVALID_FILE_TYPE, 400, { fileType, allowedTypes });
  }
}

// Resource errors
export class NotFoundError extends AppError {
  constructor(
    resource: string = 'Resource',
    id?: string
  ) {
    super(
      `${resource}${id ? ` with ID '${id}'` : ''} not found`,
      ErrorCode.NOT_FOUND,
      404,
      { resource, id }
    );
  }
}

// Processing errors
export class ProcessingError extends AppError {
  constructor(
    message: string = 'Processing failed',
    details?: Record<string, any>
  ) {
    super(message, ErrorCode.PROCESSING_ERROR, 500, details);
  }
}

// Helper to convert errors to API response
export function formatErrorResponse(error: Error): {
  error: string;
  code: ErrorCode;
  details?: Record<string, any>;
  statusCode: number;
} {
  if (error instanceof AppError) {
    return {
      error: error.message,
      code: error.code,
      details: error.details,
      statusCode: error.statusCode,
    };
  }
  
  // Handle Prisma errors
  if (error.name?.includes('Prisma')) {
    if (error.message?.includes('Unique constraint')) {
      return {
        error: 'Resource already exists',
        code: ErrorCode.ALREADY_EXISTS,
        statusCode: 409,
      };
    }
    if (error.message?.includes('Foreign key constraint')) {
      return {
        error: 'Referenced resource not found',
        code: ErrorCode.NOT_FOUND,
        statusCode: 404,
      };
    }
    return {
      error: 'Database error occurred',
      code: ErrorCode.DATABASE_ERROR,
      statusCode: 500,
    };
  }
  
  // Generic error
  return {
    error: error.message || 'An unexpected error occurred',
    code: ErrorCode.INTERNAL_ERROR,
    statusCode: 500,
  };
}
