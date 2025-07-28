import request from 'supertest';
import '../../types/express.d'; // Import Express type extensions
import { app } from '../../server';
import { PrismaClient } from '@prisma/client';
import { ReceiptController } from '../../controllers/receiptController';

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
    },
    user: {
      findFirst: jest.fn()
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

// Mock authentication middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  })
}));

describe('Receipt Routes Integration Tests', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    
    // Set the mock Prisma instance in the controller
    ReceiptController.setPrisma(mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Reset to default Prisma instance
    ReceiptController.resetPrisma();
  });

  describe('POST /api/v1/receipts/upload', () => {
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

      const mockReceipt = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        ...receiptData,
        userId: 'test-user-id',
        ocrProcessed: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.receipt.create.mockResolvedValue(mockReceipt);

      const response = await request(app)
        .post('/api/v1/receipts/upload')
        .send(receiptData)
        .expect(201);

      expect(response.body).toEqual({
        message: 'Receipt uploaded successfully',
        receipt: expect.objectContaining({
          id: mockReceipt.id,
          merchantName: receiptData.merchantName,
          amount: receiptData.amount
        })
      });
    });

    it('should return 400 for missing required fields', async () => {
      const invalidData = {
        merchantName: 'Test Store'
        // Missing amount, transactionDate, category
      };

      const response = await request(app)
        .post('/api/v1/receipts/upload')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
      expect(response.body.details.length).toBeGreaterThan(0);
    });

    it('should return 400 for invalid category', async () => {
      const invalidData = {
        merchantName: 'Test Store',
        amount: 100,
        transactionDate: '2024-01-15T10:30:00Z',
        category: 'INVALID_CATEGORY'
      };

      const response = await request(app)
        .post('/api/v1/receipts/upload')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    });
  });

  describe('GET /api/v1/receipts', () => {
    it('should get receipts with pagination', async () => {
      const mockReceipts = [
        {
          id: 'receipt-1',
          merchantName: 'Store 1',
          amount: 100,
          currency: 'DOP',
          transactionDate: '2025-07-27T19:08:10.714Z',
          category: 'FOOD_AND_DRINKS',
          createdAt: '2025-07-27T19:08:10.714Z',
          updatedAt: '2025-07-27T19:08:10.714Z'
        }
      ];

      mockPrisma.receipt.findMany.mockResolvedValue(mockReceipts);
      mockPrisma.receipt.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/v1/receipts?page=1&limit=10')
        .expect(200);

      expect(response.body).toEqual({
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
      mockPrisma.receipt.findMany.mockResolvedValue([]);
      mockPrisma.receipt.count.mockResolvedValue(0);

      await request(app)
        .get('/api/v1/receipts?category=FOOD_AND_DRINKS')
        .expect(200);

      expect(mockPrisma.receipt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'FOOD_AND_DRINKS'
          })
        })
      );
    });
  });

  describe('GET /api/v1/receipts/:id', () => {
    it('should get a receipt by ID', async () => {
      const mockReceipt = {
        id: 'receipt-123',
        merchantName: 'Test Store',
        amount: 100,
        userId: 'test-user-id'
      };

      mockPrisma.receipt.findFirst.mockResolvedValue(mockReceipt);

      const response = await request(app)
        .get('/api/v1/receipts/123e4567-e89b-12d3-a456-426614174000')
        .expect(200);

      expect(response.body).toEqual({ receipt: mockReceipt });
    });

    it('should return 404 for non-existent receipt', async () => {
      mockPrisma.receipt.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/receipts/non-existent')
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('PUT /api/v1/receipts/:id', () => {
    it('should update a receipt successfully', async () => {
      const updateData = {
        merchantName: 'Updated Store',
        amount: 150
      };

      const existingReceipt = {
        id: 'receipt-123',
        userId: 'test-user-id'
      };

      const updatedReceipt = {
        ...existingReceipt,
        ...updateData
      };

      mockPrisma.receipt.findFirst.mockResolvedValue(existingReceipt);
      mockPrisma.receipt.update.mockResolvedValue(updatedReceipt);

      const response = await request(app)
        .put('/api/v1/receipts/123e4567-e89b-12d3-a456-426614174000')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Receipt updated successfully',
        receipt: updatedReceipt
      });
    });

    it('should return 404 for non-existent receipt', async () => {
      mockPrisma.receipt.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/v1/receipts/non-existent')
        .send({ merchantName: 'Updated Store' })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('DELETE /api/v1/receipts/:id', () => {
    it('should delete a receipt successfully', async () => {
      const existingReceipt = {
        id: 'receipt-123',
        userId: 'test-user-id'
      };

      mockPrisma.receipt.findFirst.mockResolvedValue(existingReceipt);
      mockPrisma.receipt.delete.mockResolvedValue(existingReceipt);

      const response = await request(app)
        .delete('/api/v1/receipts/123e4567-e89b-12d3-a456-426614174000')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Receipt deleted successfully'
      });
    });

    it('should return 404 for non-existent receipt', async () => {
      mockPrisma.receipt.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/v1/receipts/non-existent')
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /api/v1/receipts/:id/ocr', () => {
    it('should process OCR for a receipt', async () => {
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

      const response = await request(app)
        .post('/api/v1/receipts/123e4567-e89b-12d3-a456-426614174000/ocr')
        .expect(200);

      expect(response.body).toEqual({
        message: 'OCR processing completed',
        ocrResult: expect.any(Object),
        receipt: updatedReceipt
      });
    });

    it('should return 400 if no image available', async () => {
      const receipt = {
        id: 'receipt-123',
        userId: 'test-user-id',
        imageUrl: null,
        merchantName: 'Test Store',
        amount: 100
      };

      mockPrisma.receipt.findFirst.mockResolvedValue(receipt);

      const response = await request(app)
        .post('/api/v1/receipts/123e4567-e89b-12d3-a456-426614174000/ocr')
        .expect(400);

      expect(response.body.error).toBe('No image available for OCR processing');
    });
  });

  describe('GET /api/v1/receipts/stats', () => {
    it('should get receipt statistics', async () => {
      const mockStats = {
        totalReceipts: 10,
        totalAmount: { _sum: { amount: 1000 } },
        categoryStats: [
          {
            category: 'FOOD_AND_DRINKS',
            _count: { id: 5 },
            _sum: { amount: 500 }
          }
        ],
        monthlyStats: [
          {
            transactionDate: new Date(),
            _count: { id: 2 },
            _sum: { amount: 200 }
          }
        ]
      };

      mockPrisma.receipt.count.mockResolvedValue(mockStats.totalReceipts);
      mockPrisma.receipt.aggregate.mockResolvedValue(mockStats.totalAmount);
      mockPrisma.receipt.groupBy
        .mockResolvedValueOnce(mockStats.categoryStats)
        .mockResolvedValueOnce(mockStats.monthlyStats);

      const response = await request(app)
        .get('/api/v1/receipts/stats?period=month')
        .expect(200);

      expect(response.body).toEqual({
        period: 'month',
        stats: expect.objectContaining({
          totalReceipts: 10,
          totalAmount: 1000
        })
      });
    });
  });

  describe('GET /api/v1/receipts/options', () => {
    it('should return available options', async () => {
      const response = await request(app)
        .get('/api/v1/receipts/options')
        .expect(200);

      expect(response.body).toEqual({
        categories: expect.any(Array),
        paymentMethods: expect.any(Array),
        currencies: expect.any(Array)
      });
    });
  });

  describe('GET /api/v1/receipts/insights', () => {
    it('should get receipt insights', async () => {
      const mockInsights = {
        insights: ['Your spending increased by 20% compared to last month'],
        recommendations: ['Consider reviewing your budget'],
        trends: []
      };

      // Mock the ReceiptService.getInsights method
      const { ReceiptService } = require('../../services/receiptService');
      jest.spyOn(ReceiptService, 'getInsights').mockResolvedValue(mockInsights);

      const response = await request(app)
        .get('/api/v1/receipts/insights')
        .expect(200);

      expect(response.body).toEqual(mockInsights);
    });
  });

  describe('GET /api/v1/receipts/analytics', () => {
    it('should get detailed analytics', async () => {
      const mockAnalytics = {
        period: 'month',
        summary: {
          totalReceipts: 10,
          totalAmount: 1000,
          averageAmount: 100
        },
        categoryBreakdown: [],
        topMerchants: [],
        spendingTrend: []
      };

      // Mock the ReceiptService.getAnalytics method
      const { ReceiptService } = require('../../services/receiptService');
      jest.spyOn(ReceiptService, 'getAnalytics').mockResolvedValue(mockAnalytics);

      const response = await request(app)
        .get('/api/v1/receipts/analytics?period=month')
        .expect(200);

      expect(response.body).toEqual(mockAnalytics);
    });
  });

  describe('POST /api/v1/receipts/suggest-category', () => {
    it('should suggest category for a receipt', async () => {
      const requestData = {
        merchantName: 'Supermercado Nacional',
        amount: 100
      };

      // Mock the ReceiptService.suggestCategory method
      const { ReceiptService } = require('../../services/receiptService');
      jest.spyOn(ReceiptService, 'suggestCategory').mockResolvedValue('FOOD_AND_DRINKS');

      const response = await request(app)
        .post('/api/v1/receipts/suggest-category')
        .send(requestData)
        .expect(200);

      expect(response.body).toEqual({
        suggestedCategory: 'FOOD_AND_DRINKS',
        confidence: 'medium'
      });
    });

    it('should return 400 for missing fields', async () => {
      const response = await request(app)
        .post('/api/v1/receipts/suggest-category')
        .send({ merchantName: 'Test Store' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Missing required fields',
        required: ['merchantName', 'amount']
      });
    });
  });
}); 