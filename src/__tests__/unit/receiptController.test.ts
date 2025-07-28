import { Request, Response } from 'express';
import '../../types/express.d'; // Import Express type extensions
import { ReceiptController } from '../../controllers/receiptController';
import { PrismaClient, ReceiptCategory, PaymentMethod, Currency } from '@prisma/client';

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    receipt: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn()
    }
  })),
  ReceiptCategory: {
    FOOD_AND_DRINKS: 'FOOD_AND_DRINKS',
    TRANSPORTATION: 'TRANSPORTATION',
    SHOPPING: 'SHOPPING',
    ENTERTAINMENT: 'ENTERTAINMENT',
    HEALTHCARE: 'HEALTHCARE',
    EDUCATION: 'EDUCATION',
    UTILITIES: 'UTILITIES',
    INSURANCE: 'INSURANCE',
    INVESTMENTS: 'INVESTMENTS',
    SAVINGS: 'SAVINGS',
    OTHER: 'OTHER'
  },
  PaymentMethod: {
    CASH: 'CASH',
    CREDIT_CARD: 'CREDIT_CARD',
    DEBIT_CARD: 'DEBIT_CARD',
    BANK_TRANSFER: 'BANK_TRANSFER',
    DIGITAL_WALLET: 'DIGITAL_WALLET',
    CRYPTO: 'CRYPTO',
    OTHER: 'OTHER'
  },
  Currency: {
    DOP: 'DOP',
    USD: 'USD',
    EUR: 'EUR',
    MXN: 'MXN',
    COP: 'COP'
  }
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

// Mock ReceiptService
jest.mock('../../services/receiptService', () => ({
  ReceiptService: {
    getInsights: jest.fn(),
    getAnalytics: jest.fn(),
    suggestCategory: jest.fn()
  }
}));

describe('ReceiptController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockPrisma: any;

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

    mockPrisma = new PrismaClient();
    
    // Set the mock Prisma instance in the controller
    ReceiptController.setPrisma(mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Reset to default Prisma instance
    ReceiptController.resetPrisma();
  });

  describe('uploadReceipt', () => {
    it('should upload a receipt successfully', async () => {
      const receiptData = {
        merchantName: 'Supermercado Nacional',
        amount: 1250.50,
        currency: 'DOP',
        transactionDate: '2024-01-15T10:30:00Z',
        category: 'FOOD_AND_DRINKS',
        subcategory: 'Groceries',
        paymentMethod: 'CREDIT_CARD',
        location: 'Santo Domingo',
        notes: 'Weekly groceries',
        imageUrl: 'https://example.com/receipt.jpg'
      };

      mockRequest.body = receiptData;

      const mockReceipt = {
        id: 'receipt-123',
        ...receiptData,
        userId: 'test-user-id',
        ocrProcessed: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.receipt.create.mockResolvedValue(mockReceipt);

      await ReceiptController.uploadReceipt(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.receipt.create).toHaveBeenCalledWith({
        data: {
          userId: 'test-user-id',
          merchantName: receiptData.merchantName,
          amount: receiptData.amount,
          currency: receiptData.currency,
          transactionDate: new Date(receiptData.transactionDate),
          category: receiptData.category,
          subcategory: receiptData.subcategory,
          paymentMethod: receiptData.paymentMethod,
          location: receiptData.location,
          notes: receiptData.notes,
          imageUrl: receiptData.imageUrl,
          ocrProcessed: false
        }
      });

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Receipt uploaded successfully',
        receipt: expect.objectContaining({
          id: mockReceipt.id,
          merchantName: mockReceipt.merchantName,
          amount: mockReceipt.amount
        })
      });
    });

    it('should return 401 if user is not authenticated', async () => {
      mockRequest.user = undefined;

      await ReceiptController.uploadReceipt(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should return 400 if required fields are missing', async () => {
      mockRequest.body = {
        merchantName: 'Test Store'
        // Missing amount, transactionDate, category
      };

      await ReceiptController.uploadReceipt(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Missing required fields',
        required: ['merchantName', 'amount', 'transactionDate', 'category']
      });
    });

    it('should return 400 for invalid category', async () => {
      mockRequest.body = {
        merchantName: 'Test Store',
        amount: 100,
        transactionDate: '2024-01-15T10:30:00Z',
        category: 'INVALID_CATEGORY'
      };

      await ReceiptController.uploadReceipt(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid category',
        validCategories: expect.any(Array)
      });
    });

    it('should return 400 for negative amount', async () => {
      mockRequest.body = {
        merchantName: 'Test Store',
        amount: -100,
        transactionDate: '2024-01-15T10:30:00Z',
        category: 'FOOD_AND_DRINKS'
      };

      await ReceiptController.uploadReceipt(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Amount must be a positive number'
      });
    });

    it('should return 400 for amount exceeding limit', async () => {
      mockRequest.body = {
        merchantName: 'Test Store',
        amount: 2000000,
        transactionDate: '2024-01-15T10:30:00Z',
        category: 'FOOD_AND_DRINKS'
      };

      await ReceiptController.uploadReceipt(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Amount exceeds maximum limit of 1,000,000'
      });
    });

    it('should return 400 for future transaction date', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      mockRequest.body = {
        merchantName: 'Test Store',
        amount: 100,
        transactionDate: futureDate.toISOString(),
        category: 'FOOD_AND_DRINKS'
      };

      await ReceiptController.uploadReceipt(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Transaction date cannot be in the future'
      });
    });

    it('should return 400 for very old transaction date', async () => {
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 15);
      
      mockRequest.body = {
        merchantName: 'Test Store',
        amount: 100,
        transactionDate: oldDate.toISOString(),
        category: 'FOOD_AND_DRINKS'
      };

      await ReceiptController.uploadReceipt(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Transaction date cannot be more than 10 years ago'
      });
    });

    it('should return 400 for invalid image URL', async () => {
      mockRequest.body = {
        merchantName: 'Test Store',
        amount: 100,
        transactionDate: '2024-01-15T10:30:00Z',
        category: 'FOOD_AND_DRINKS',
        imageUrl: 'not-a-valid-url'
      };

      await ReceiptController.uploadReceipt(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid image URL format'
      });
    });

    it('should return 400 for non-image URL', async () => {
      mockRequest.body = {
        merchantName: 'Test Store',
        amount: 100,
        transactionDate: '2024-01-15T10:30:00Z',
        category: 'FOOD_AND_DRINKS',
        imageUrl: 'https://example.com/document.pdf'
      };

      await ReceiptController.uploadReceipt(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Image URL must point to a valid image file (jpg, jpeg, png, gif, webp, bmp)'
      });
    });

    it('should sanitize input data', async () => {
      const receiptData = {
        merchantName: '  Test Store<script>alert("xss")</script>  ',
        amount: 100,
        transactionDate: '2024-01-15T10:30:00Z',
        category: 'FOOD_AND_DRINKS',
        subcategory: '<img src="x" onerror="alert(1)">',
        notes: '  Some notes<script>alert("xss")</script>  '
      };

      mockRequest.body = receiptData;

      const mockReceipt = {
        id: 'receipt-123',
        merchantName: 'Test Store',
        subcategory: '<img src="x" onerror="alert(1)">',
        notes: 'Some notes',
        amount: 100,
        currency: 'DOP',
        transactionDate: new Date('2024-01-15T10:30:00Z'),
        category: 'FOOD_AND_DRINKS',
        paymentMethod: null,
        location: null,
        imageUrl: null,
        ocrProcessed: false,
        userId: 'test-user-id',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.receipt.create.mockResolvedValue(mockReceipt);

      await ReceiptController.uploadReceipt(mockRequest as Request, mockResponse as Response);

      // Verify that the receipt was created successfully
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      
      // Verify that XSS attempts were sanitized
      const createCall = mockPrisma.receipt.create.mock.calls[0][0];
      expect(createCall.data.merchantName).not.toContain('<script>');
      expect(createCall.data.merchantName).not.toContain('</script>');
      expect(createCall.data.notes).not.toContain('<script>');
      expect(createCall.data.notes).not.toContain('</script>');
      expect(createCall.data.subcategory).not.toContain('<');
      expect(createCall.data.subcategory).not.toContain('>');
    });
  });

  describe('getReceipts', () => {
    it('should get receipts with pagination', async () => {
      mockRequest.query = {
        page: '1',
        limit: '10'
      };

      const mockReceipts = [
        {
          id: 'receipt-1',
          merchantName: 'Store 1',
          amount: 100,
          currency: 'DOP',
          transactionDate: new Date(),
          category: 'FOOD_AND_DRINKS',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockPrisma.receipt.findMany.mockResolvedValue(mockReceipts);
      mockPrisma.receipt.count.mockResolvedValue(1);

      await ReceiptController.getReceipts(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.receipt.findMany).toHaveBeenCalledWith({
        where: { userId: 'test-user-id' },
        orderBy: { transactionDate: 'desc' },
        skip: 0,
        take: 10,
        select: expect.any(Object)
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        receipts: mockReceipts,
        pagination: expect.objectContaining({
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1
        })
      });
    });

    it('should filter receipts by category', async () => {
      mockRequest.query = {
        category: 'FOOD_AND_DRINKS'
      };

      await ReceiptController.getReceipts(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.receipt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'test-user-id',
            category: 'FOOD_AND_DRINKS'
          }
        })
      );
    });
  });

  describe('getReceiptById', () => {
    it('should get a receipt by ID', async () => {
      mockRequest.params = { id: 'receipt-123' };

      const mockReceipt = {
        id: 'receipt-123',
        merchantName: 'Test Store',
        amount: 100,
        userId: 'test-user-id'
      };

      mockPrisma.receipt.findFirst.mockResolvedValue(mockReceipt);

      await ReceiptController.getReceiptById(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.receipt.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'receipt-123',
          userId: 'test-user-id'
        }
      });

      expect(mockResponse.json).toHaveBeenCalledWith({ receipt: mockReceipt });
    });

    it('should return 404 if receipt not found', async () => {
      mockRequest.params = { id: 'non-existent' };
      mockPrisma.receipt.findFirst.mockResolvedValue(null);

      await ReceiptController.getReceiptById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Receipt not found' });
    });
  });

  describe('updateReceipt', () => {
    it('should update a receipt successfully', async () => {
      mockRequest.params = { id: 'receipt-123' };
      mockRequest.body = {
        merchantName: 'Updated Store',
        amount: 150
      };

      const existingReceipt = {
        id: 'receipt-123',
        userId: 'test-user-id'
      };

      const updatedReceipt = {
        ...existingReceipt,
        merchantName: 'Updated Store',
        amount: 150
      };

      mockPrisma.receipt.findFirst.mockResolvedValue(existingReceipt);
      mockPrisma.receipt.update.mockResolvedValue(updatedReceipt);

      await ReceiptController.updateReceipt(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.receipt.update).toHaveBeenCalledWith({
        where: { id: 'receipt-123' },
        data: {
          merchantName: 'Updated Store',
          amount: 150
        }
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Receipt updated successfully',
        receipt: updatedReceipt
      });
    });
  });

  describe('deleteReceipt', () => {
    it('should delete a receipt successfully', async () => {
      mockRequest.params = { id: 'receipt-123' };

      const existingReceipt = {
        id: 'receipt-123',
        userId: 'test-user-id'
      };

      mockPrisma.receipt.findFirst.mockResolvedValue(existingReceipt);
      mockPrisma.receipt.delete.mockResolvedValue(existingReceipt);

      await ReceiptController.deleteReceipt(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.receipt.delete).toHaveBeenCalledWith({
        where: { id: 'receipt-123' }
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Receipt deleted successfully'
      });
    });
  });

  describe('processOCR', () => {
    it('should process OCR for a receipt', async () => {
      mockRequest.params = { id: 'receipt-123' };

      const receipt = {
        id: 'receipt-123',
        userId: 'test-user-id',
        imageUrl: 'https://example.com/receipt.jpg',
        merchantName: 'Test Store',
        amount: 100,
        currency: 'DOP'
      };

      const updatedReceipt = {
        ...receipt,
        ocrProcessed: true,
        ocrConfidence: 0.85,
        ocrRawText: 'Receipt from Test Store for 100 DOP'
      };

      mockPrisma.receipt.findFirst.mockResolvedValue(receipt);
      mockPrisma.receipt.update.mockResolvedValue(updatedReceipt);

      await ReceiptController.processOCR(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.receipt.update).toHaveBeenCalledWith({
        where: { id: 'receipt-123' },
        data: {
          ocrProcessed: true,
          ocrConfidence: 0.85,
          ocrRawText: expect.any(String)
        }
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'OCR processing completed',
        ocrResult: expect.any(Object),
        receipt: updatedReceipt
      });
    });
  });

  describe('getReceiptOptions', () => {
    it('should return available options', async () => {
      await ReceiptController.getReceiptOptions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        categories: expect.any(Array),
        paymentMethods: expect.any(Array),
        currencies: expect.any(Array)
      });
    });
  });
}); 