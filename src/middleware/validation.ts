import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { ReceiptCategory, PaymentMethod, Currency } from '@prisma/client';

// Validation result handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: (err as any).path || err.type,
        message: err.msg,
        value: (err as any).value
      }))
    });
  }
  next();
  return null;
};

// Receipt upload validation
export const validateReceiptUpload = [
  body('merchantName')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Merchant name must be between 1 and 200 characters')
    .matches(/^[^<>]*$/)
    .withMessage('Merchant name contains invalid characters'),
  
  body('amount')
    .isFloat({ min: 0.01, max: 1000000 })
    .withMessage('Amount must be a positive number between 0.01 and 1,000,000'),
  
  body('currency')
    .optional()
    .isIn(Currency ? Object.values(Currency) : ['DOP', 'USD', 'EUR', 'MXN', 'COP'])
    .withMessage('Invalid currency'),
  
  body('transactionDate')
    .isISO8601()
    .withMessage('Transaction date must be a valid ISO 8601 date')
    .custom((value) => {
      const date = new Date(value);
      const now = new Date();
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
      
      if (date > now) {
        throw new Error('Transaction date cannot be in the future');
      }
      if (date < tenYearsAgo) {
        throw new Error('Transaction date cannot be more than 10 years ago');
      }
      return true;
    }),
  
  body('category')
    .isIn(Object.values(ReceiptCategory))
    .withMessage('Invalid category'),
  
  body('subcategory')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Subcategory must be less than 100 characters')
    .matches(/^[^<>]*$/)
    .withMessage('Subcategory contains invalid characters'),
  
  body('paymentMethod')
    .optional()
    .isIn(Object.values(PaymentMethod))
    .withMessage('Invalid payment method'),
  
  body('location')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Location must be less than 200 characters')
    .matches(/^[^<>]*$/)
    .withMessage('Location contains invalid characters'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters')
    .matches(/^[^<>]*$/)
    .withMessage('Notes contain invalid characters'),
  
  body('imageUrl')
    .optional()
    .isURL()
    .withMessage('Image URL must be a valid URL')
    .custom((value) => {
      if (value) {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('Image URL must use HTTP or HTTPS protocol');
        }
        
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        const hasImageExtension = imageExtensions.some(ext => 
          url.pathname.toLowerCase().endsWith(ext)
        );
        
        if (!hasImageExtension) {
          throw new Error('Image URL must point to a valid image file (jpg, jpeg, png, gif, webp, bmp)');
        }
      }
      return true;
    }),
  
  handleValidationErrors
];

// Receipt update validation
export const validateReceiptUpdate = [
  param('id')
    .isUUID()
    .withMessage('Invalid receipt ID'),
  
  body('merchantName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Merchant name must be between 1 and 200 characters')
    .matches(/^[^<>]*$/)
    .withMessage('Merchant name contains invalid characters'),
  
  body('amount')
    .optional()
    .isFloat({ min: 0.01, max: 1000000 })
    .withMessage('Amount must be a positive number between 0.01 and 1,000,000'),
  
  body('currency')
    .optional()
    .isIn(Currency ? Object.values(Currency) : ['DOP', 'USD', 'EUR', 'MXN', 'COP'])
    .withMessage('Invalid currency'),
  
  body('transactionDate')
    .optional()
    .isISO8601()
    .withMessage('Transaction date must be a valid ISO 8601 date')
    .custom((value) => {
      const date = new Date(value);
      const now = new Date();
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
      
      if (date > now) {
        throw new Error('Transaction date cannot be in the future');
      }
      if (date < tenYearsAgo) {
        throw new Error('Transaction date cannot be more than 10 years ago');
      }
      return true;
    }),
  
  body('category')
    .optional()
    .isIn(Object.values(ReceiptCategory))
    .withMessage('Invalid category'),
  
  body('subcategory')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Subcategory must be less than 100 characters')
    .matches(/^[^<>]*$/)
    .withMessage('Subcategory contains invalid characters'),
  
  body('paymentMethod')
    .optional()
    .isIn(Object.values(PaymentMethod))
    .withMessage('Invalid payment method'),
  
  body('location')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Location must be less than 200 characters')
    .matches(/^[^<>]*$/)
    .withMessage('Location contains invalid characters'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters')
    .matches(/^[^<>]*$/)
    .withMessage('Notes contain invalid characters'),
  
  body('imageUrl')
    .optional()
    .isURL()
    .withMessage('Image URL must be a valid URL')
    .custom((value) => {
      if (value) {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('Image URL must use HTTP or HTTPS protocol');
        }
        
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        const hasImageExtension = imageExtensions.some(ext => 
          url.pathname.toLowerCase().endsWith(ext)
        );
        
        if (!hasImageExtension) {
          throw new Error('Image URL must point to a valid image file (jpg, jpeg, png, gif, webp, bmp)');
        }
      }
      return true;
    }),
  
  handleValidationErrors
];

// Receipt ID validation
export const validateReceiptId = [
  param('id')
    .isUUID()
    .withMessage('Invalid receipt ID'),
  
  handleValidationErrors
];

// Pagination validation
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

// Category suggestion validation
export const validateCategorySuggestion = [
  body('merchantName')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Merchant name must be between 1 and 200 characters')
    .matches(/^[^<>]*$/)
    .withMessage('Merchant name contains invalid characters'),
  
  handleValidationErrors
]; 