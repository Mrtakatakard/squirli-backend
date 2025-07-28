import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Custom validation types
export type ValidationRule = {
  type: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'date' | 'array' | 'object';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any) => boolean | string;
  transform?: (value: any) => any;
  message?: string;
};

export type ValidationSchema = {
  [key: string]: ValidationRule;
};

export type ValidationResult = {
  success: boolean;
  data?: any;
  errors?: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
};

export class ValidationService {
  // Validate data against schema
  static validate(data: any, schema: ValidationSchema): ValidationResult {
    const errors: Array<{ field: string; message: string; value?: any }> = [];
    const result: any = {};

    for (const [field, rule] of Object.entries(schema)) {
      const value = data[field];
      
      // Check if required
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field,
          message: rule.message || `${field} is required`,
          value
        });
        continue;
      }

      // Skip validation if value is not provided and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      const typeError = this.validateType(value, rule);
      if (typeError) {
        errors.push({
          field,
          message: typeError,
          value
        });
        continue;
      }

      // Length/range validation
      const rangeError = this.validateRange(value, rule);
      if (rangeError) {
        errors.push({
          field,
          message: rangeError,
          value
        });
        continue;
      }

      // Pattern validation
      if (rule.pattern && typeof value === 'string') {
        if (!rule.pattern.test(value)) {
          errors.push({
            field,
            message: rule.message || `${field} format is invalid`,
            value
          });
          continue;
        }
      }

      // Enum validation
      if (rule.enum && !rule.enum.includes(value)) {
        errors.push({
          field,
          message: rule.message || `${field} must be one of: ${rule.enum.join(', ')}`,
          value
        });
        continue;
      }

      // Custom validation
      if (rule.custom) {
        const customResult = rule.custom(value);
        if (customResult !== true) {
          errors.push({
            field,
            message: typeof customResult === 'string' ? customResult : rule.message || `${field} validation failed`,
            value
          });
          continue;
        }
      }

      // Transform value if needed
      const finalValue = rule.transform ? rule.transform(value) : value;
      result[field] = finalValue;
    }

    return {
      success: errors.length === 0,
      data: errors.length === 0 ? result : undefined,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  // Validate data type
  private static validateType(value: any, rule: ValidationRule): string | null {
    switch (rule.type) {
      case 'string':
        if (typeof value !== 'string') {
          return `${rule.message || 'Field'} must be a string`;
        }
        break;
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return `${rule.message || 'Field'} must be a number`;
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          return `${rule.message || 'Field'} must be a boolean`;
        }
        break;
      case 'email':
        if (typeof value !== 'string' || !this.isValidEmail(value)) {
          return `${rule.message || 'Field'} must be a valid email address`;
        }
        break;
      case 'url':
        if (typeof value !== 'string' || !this.isValidUrl(value)) {
          return `${rule.message || 'Field'} must be a valid URL`;
        }
        break;
      case 'date':
        if (!(value instanceof Date) && isNaN(Date.parse(value))) {
          return `${rule.message || 'Field'} must be a valid date`;
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          return `${rule.message || 'Field'} must be an array`;
        }
        break;
      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return `${rule.message || 'Field'} must be an object`;
        }
        break;
    }
    return null;
  }

  // Validate range/length
  private static validateRange(value: any, rule: ValidationRule): string | null {
    if (rule.min !== undefined) {
      if (typeof value === 'string' && value.length < rule.min) {
        return `${rule.message || 'Field'} must be at least ${rule.min} characters`;
      }
      if (typeof value === 'number' && value < rule.min) {
        return `${rule.message || 'Field'} must be at least ${rule.min}`;
      }
      if (Array.isArray(value) && value.length < rule.min) {
        return `${rule.message || 'Field'} must have at least ${rule.min} items`;
      }
    }

    if (rule.max !== undefined) {
      if (typeof value === 'string' && value.length > rule.max) {
        return `${rule.message || 'Field'} must be at most ${rule.max} characters`;
      }
      if (typeof value === 'number' && value > rule.max) {
        return `${rule.message || 'Field'} must be at most ${rule.max}`;
      }
      if (Array.isArray(value) && value.length > rule.max) {
        return `${rule.message || 'Field'} must have at most ${rule.max} items`;
      }
    }

    return null;
  }

  // Email validation
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // URL validation
  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Predefined schemas
  static schemas = {
    // User registration
    userRegistration: {
      email: {
        type: 'email' as const,
        required: true,
        message: 'Valid email address is required'
      },
      password: {
        type: 'string' as const,
        required: true,
        min: 8,
        max: 128,
        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        message: 'Password must be 8-128 characters with uppercase, lowercase, number, and special character'
      },
      firstName: {
        type: 'string' as const,
        required: true,
        min: 1,
        max: 50,
        pattern: /^[a-zA-Z\s]+$/,
        message: 'First name must be 1-50 characters, letters only'
      },
      lastName: {
        type: 'string' as const,
        required: true,
        min: 1,
        max: 50,
        pattern: /^[a-zA-Z\s]+$/,
        message: 'Last name must be 1-50 characters, letters only'
      },
      phone: {
        type: 'string' as const,
        required: false,
        pattern: /^\+?[\d\s\-\(\)]+$/,
        message: 'Phone number format is invalid'
      }
    },

    // Receipt upload
    receiptUpload: {
      merchantName: {
        type: 'string' as const,
        required: true,
        min: 1,
        max: 200,
        pattern: /^[^<>]*$/,
        message: 'Merchant name must be 1-200 characters without special characters'
      },
      amount: {
        type: 'number' as const,
        required: true,
        min: 0.01,
        max: 1000000,
        message: 'Amount must be between 0.01 and 1,000,000'
      },
      currency: {
        type: 'string' as const,
        required: true,
        enum: ['DOP', 'USD', 'EUR', 'GBP'],
        message: 'Currency must be DOP, USD, EUR, or GBP'
      },
      transactionDate: {
        type: 'date' as const,
        required: true,
        custom: (value: any) => {
          const date = new Date(value);
          const now = new Date();
          const tenYearsAgo = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
          
          if (date > now) {
            return 'Transaction date cannot be in the future';
          }
          if (date < tenYearsAgo) {
            return 'Transaction date cannot be older than 10 years';
          }
          return true;
        }
      },
      category: {
        type: 'string' as const,
        required: true,
        enum: ['FOOD', 'TRANSPORT', 'SHOPPING', 'ENTERTAINMENT', 'HEALTH', 'EDUCATION', 'UTILITIES', 'OTHER'],
        message: 'Invalid category selected'
      },
      subcategory: {
        type: 'string' as const,
        required: false,
        max: 100,
        pattern: /^[^<>]*$/,
        message: 'Subcategory must be 1-100 characters without special characters'
      },
      paymentMethod: {
        type: 'string' as const,
        required: true,
        enum: ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'DIGITAL_WALLET', 'OTHER'],
        message: 'Invalid payment method selected'
      },
      location: {
        type: 'string' as const,
        required: false,
        max: 200,
        pattern: /^[^<>]*$/,
        message: 'Location must be 1-200 characters without special characters'
      },
      notes: {
        type: 'string' as const,
        required: false,
        max: 1000,
        pattern: /^[^<>]*$/,
        message: 'Notes must be 1-1000 characters without special characters'
      },
      imageUrl: {
        type: 'url' as const,
        required: false,
        custom: (value: string) => {
          if (!value) return true;
          const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.pdf'];
          const url = new URL(value);
          const pathname = url.pathname.toLowerCase();
          const hasValidExtension = allowedExtensions.some(ext => pathname.endsWith(ext));
          return hasValidExtension || 'Image URL must have a valid image or PDF extension';
        }
      }
    },

    // 2FA setup
    twoFactorSetup: {
      secret: {
        type: 'string' as const,
        required: true,
        min: 16,
        max: 32,
        pattern: /^[A-Z2-7]+=*$/,
        message: 'Invalid 2FA secret format'
      },
      code: {
        type: 'string' as const,
        required: true,
        pattern: /^\d{6}$/,
        message: '2FA code must be 6 digits'
      }
    },

    // Security settings
    securitySettings: {
      enable2FA: {
        type: 'boolean' as const,
        required: false
      },
      emailNotifications: {
        type: 'boolean' as const,
        required: false
      },
      sessionTimeout: {
        type: 'number' as const,
        required: false,
        min: 15,
        max: 1440,
        message: 'Session timeout must be between 15 and 1440 minutes'
      }
    }
  };

  // Express middleware for validation
  static validateMiddleware(schema: ValidationSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const data = { ...req.body, ...req.params, ...req.query };
      const result = this.validate(data, schema);

      if (!result.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: result.errors
        });
        return;
      }

      // Replace request data with validated data
      req.body = { ...req.body, ...result.data };
      next();
    };
  }

  // Sanitize data
  static sanitize(data: any, schema: ValidationSchema): any {
    const result = this.validate(data, schema);
    return result.success ? result.data : data;
  }

  // Validate and transform data
  static validateAndTransform<T>(data: any, schema: ValidationSchema): T | null {
    const result = this.validate(data, schema);
    return result.success ? result.data as T : null;
  }

  // Create custom validation rule
  static createRule(rule: ValidationRule): ValidationRule {
    return rule;
  }

  // Extend existing schema
  static extendSchema(baseSchema: ValidationSchema, extensions: ValidationSchema): ValidationSchema {
    return { ...baseSchema, ...extensions };
  }
} 