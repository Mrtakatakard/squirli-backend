import { Request, Response, NextFunction } from 'express';
import '../../types/express.d'; // Import Express type extensions
import { 
  validateReceiptUpload, 
  validateReceiptUpdate, 
  validateReceiptId, 
  validatePagination,
  validateCategorySuggestion,
  handleValidationErrors 
} from '../../middleware/validation';

// Mock express-validator
jest.mock('express-validator', () => ({
  body: jest.fn(() => ({
    trim: jest.fn().mockReturnThis(),
    isLength: jest.fn().mockReturnThis(),
    matches: jest.fn().mockReturnThis(),
    isFloat: jest.fn().mockReturnThis(),
    isIn: jest.fn().mockReturnThis(),
    isISO8601: jest.fn().mockReturnThis(),
    custom: jest.fn().mockReturnThis(),
    optional: jest.fn().mockReturnThis(),
    isURL: jest.fn().mockReturnThis(),
    isInt: jest.fn().mockReturnThis(),
    withMessage: jest.fn().mockReturnThis()
  })),
  param: jest.fn(() => ({
    isUUID: jest.fn().mockReturnThis(),
    withMessage: jest.fn().mockReturnThis()
  })),
  query: jest.fn(() => ({
    isInt: jest.fn().mockReturnThis(),
    withMessage: jest.fn().mockReturnThis(),
    optional: jest.fn().mockReturnThis()
  })),
  validationResult: jest.fn()
}));

describe('Validation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      body: {},
      params: {},
      query: {},
      user: { id: 'test-user-id', email: 'test@example.com' }
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleValidationErrors', () => {
    it('should call next() when no validation errors', () => {
      const { validationResult } = require('express-validator');
      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => []
      });

      handleValidationErrors(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 400 with validation errors when validation fails', () => {
      const { validationResult } = require('express-validator');
      const mockErrors = [
        { path: 'merchantName', msg: 'Merchant name is required', value: '' },
        { path: 'amount', msg: 'Amount must be positive', value: -100 }
      ];
      
      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => mockErrors
      });

      handleValidationErrors(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: mockErrors.map(err => ({
          field: err.path,
          message: err.msg,
          value: err.value
        }))
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validateReceiptUpload', () => {
    it('should be an array of validation functions', () => {
      expect(Array.isArray(validateReceiptUpload)).toBe(true);
      expect(validateReceiptUpload.length).toBeGreaterThan(0);
    });

    it('should include handleValidationErrors as the last function', () => {
      expect(validateReceiptUpload[validateReceiptUpload.length - 1]).toBe(handleValidationErrors);
    });
  });

  describe('validateReceiptUpdate', () => {
    it('should be an array of validation functions', () => {
      expect(Array.isArray(validateReceiptUpdate)).toBe(true);
      expect(validateReceiptUpdate.length).toBeGreaterThan(0);
    });

    it('should include handleValidationErrors as the last function', () => {
      expect(validateReceiptUpdate[validateReceiptUpdate.length - 1]).toBe(handleValidationErrors);
    });
  });

  describe('validateReceiptId', () => {
    it('should be an array of validation functions', () => {
      expect(Array.isArray(validateReceiptId)).toBe(true);
      expect(validateReceiptId.length).toBeGreaterThan(0);
    });

    it('should include handleValidationErrors as the last function', () => {
      expect(validateReceiptId[validateReceiptId.length - 1]).toBe(handleValidationErrors);
    });
  });

  describe('validatePagination', () => {
    it('should be an array of validation functions', () => {
      expect(Array.isArray(validatePagination)).toBe(true);
      expect(validatePagination.length).toBeGreaterThan(0);
    });

    it('should include handleValidationErrors as the last function', () => {
      expect(validatePagination[validatePagination.length - 1]).toBe(handleValidationErrors);
    });
  });

  describe('validateCategorySuggestion', () => {
    it('should be an array of validation functions', () => {
      expect(Array.isArray(validateCategorySuggestion)).toBe(true);
      expect(validateCategorySuggestion.length).toBeGreaterThan(0);
    });

    it('should include handleValidationErrors as the last function', () => {
      expect(validateCategorySuggestion[validateCategorySuggestion.length - 1]).toBe(handleValidationErrors);
    });
  });
}); 