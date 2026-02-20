/**
 * Form validation utilities
 */

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  email?: boolean;
  url?: boolean;
  custom?: (value: any) => string | null;
}

export interface ValidationErrors {
  [field: string]: string;
}

/**
 * Validate a single field
 */
export function validateField(value: any, rules: ValidationRule, fieldName: string): string | null {
  // Required check
  if (rules.required && (value === undefined || value === null || value === '')) {
    return `${fieldName} is required`;
  }

  // Skip other checks if empty and not required
  if (!value && !rules.required) {
    return null;
  }

  const strValue = String(value);

  // Min length
  if (rules.minLength && strValue.length < rules.minLength) {
    return `${fieldName} must be at least ${rules.minLength} characters`;
  }

  // Max length
  if (rules.maxLength && strValue.length > rules.maxLength) {
    return `${fieldName} must be no more than ${rules.maxLength} characters`;
  }

  // Pattern
  if (rules.pattern && !rules.pattern.test(strValue)) {
    return `${fieldName} format is invalid`;
  }

  // Email
  if (rules.email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(strValue)) {
      return `Please enter a valid email address`;
    }
  }

  // URL
  if (rules.url) {
    try {
      new URL(strValue);
    } catch {
      return `Please enter a valid URL`;
    }
  }

  // Custom validator
  if (rules.custom) {
    return rules.custom(value);
  }

  return null;
}

/**
 * Validate an entire form object
 */
export function validateForm(
  values: { [key: string]: any },
  rules: { [key: string]: ValidationRule }
): { valid: boolean; errors: ValidationErrors } {
  const errors: ValidationErrors = {};

  for (const [field, rule] of Object.entries(rules)) {
    const error = validateField(values[field], rule, field);
    if (error) {
      errors[field] = error;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Predefined validation schemas
 */
export const schemas = {
  matter: {
    name: { required: true, minLength: 2, maxLength: 200 },
    description: { maxLength: 2000 },
  },
  document: {
    name: { required: true, minLength: 2, maxLength: 200 },
  },
  user: {
    name: { required: true, minLength: 2, maxLength: 100 },
    email: { required: true, email: true },
  },
  searchQuery: {
    query: { 
      required: true, 
      minLength: 3, 
      maxLength: 500,
      custom: (value: string) => {
        // Check for SQL injection patterns
        const sqlPatterns = /(--|;|\\*\\*|union|select|insert|update|delete|drop|exec|execute)/i;
        if (sqlPatterns.test(value)) {
          return 'Query contains invalid characters';
        }
        return null;
      }
    },
  },
  password: {
    currentPassword: { required: true, minLength: 8 },
    newPassword: { 
      required: true, 
      minLength: 8,
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
    },
    confirmPassword: { 
      required: true,
      custom: (value: string, allValues?: any) => {
        if (allValues?.newPassword && value !== allValues.newPassword) {
          return 'Passwords do not match';
        }
        return null;
      }
    },
  },
  organization: {
    name: { required: true, minLength: 2, maxLength: 100 },
    website: { url: true },
  },
};

/**
 * Sanitize user input
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < > to prevent HTML injection
    .slice(0, 10000); // Max 10k characters
}

/**
 * Debounce function for validation
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
