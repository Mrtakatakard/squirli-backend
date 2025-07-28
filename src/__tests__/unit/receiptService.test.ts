import { ReceiptService } from '../../services/receiptService';
import { PrismaClient, ReceiptCategory, PaymentMethod } from '@prisma/client';

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    receipt: {
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
  }
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

describe('ReceiptService', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    
    // Set the mock Prisma instance in the service
    ReceiptService.setPrisma(mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Reset to default Prisma instance
    ReceiptService.resetPrisma();
  });

  describe('processOCR', () => {
    it('should process OCR and return structured data', async () => {
      const imageUrl = 'https://example.com/receipt.jpg';
      
      const result = await ReceiptService.processOCR(imageUrl);

      expect(result).toEqual({
        merchantName: 'Supermercado Nacional',
        amount: 1250.50,
        transactionDate: expect.any(Date),
        confidence: 0.85,
        rawText: expect.stringContaining('SUPERMERCADO NACIONAL'),
        category: ReceiptCategory.FOOD_AND_DRINKS,
        paymentMethod: PaymentMethod.CREDIT_CARD
      });
    });

    it('should throw error when OCR processing fails', async () => {
      // Mock the service to throw an error
      jest.spyOn(ReceiptService, 'processOCR').mockRejectedValue(new Error('OCR processing failed'));

      await expect(ReceiptService.processOCR('invalid-url')).rejects.toThrow('OCR processing failed');
    });
  });

  describe('suggestCategory', () => {
    it('should suggest FOOD_AND_DRINKS for grocery stores', async () => {
      const category = await ReceiptService.suggestCategory('Supermercado Nacional', 100);
      expect(category).toBe(ReceiptCategory.FOOD_AND_DRINKS);
    });

    it('should suggest TRANSPORTATION for gas stations', async () => {
      const category = await ReceiptService.suggestCategory('Gas Station', 50);
      expect(category).toBe(ReceiptCategory.TRANSPORTATION);
    });

    it('should suggest HEALTHCARE for medical services', async () => {
      const category = await ReceiptService.suggestCategory('Medical Clinic', 200);
      expect(category).toBe(ReceiptCategory.HEALTHCARE);
    });

    it('should suggest EDUCATION for schools', async () => {
      const category = await ReceiptService.suggestCategory('University', 500);
      expect(category).toBe(ReceiptCategory.EDUCATION);
    });

    it('should suggest UTILITIES for utility services', async () => {
      const category = await ReceiptService.suggestCategory('Electric Company', 150);
      expect(category).toBe(ReceiptCategory.UTILITIES);
    });

    it('should suggest INSURANCE for insurance companies', async () => {
      const category = await ReceiptService.suggestCategory('Insurance Co', 300);
      expect(category).toBe(ReceiptCategory.INSURANCE);
    });

    it('should suggest INVESTMENTS for financial services', async () => {
      const category = await ReceiptService.suggestCategory('Investment Bank', 1000);
      expect(category).toBe(ReceiptCategory.INVESTMENTS);
    });

    it('should suggest SHOPPING for retail stores', async () => {
      const category = await ReceiptService.suggestCategory('Fashion Store', 80);
      expect(category).toBe(ReceiptCategory.SHOPPING);
    });

    it('should suggest OTHER for unknown merchants', async () => {
      const category = await ReceiptService.suggestCategory('Unknown Store', 50);
      expect(category).toBe(ReceiptCategory.OTHER);
    });
  });

  describe('getAnalytics', () => {
    it('should return analytics for monthly period', async () => {
      const userId = 'test-user-id';
      const period = 'month';

      const mockData = {
        totalReceipts: 10,
        totalAmount: { _sum: { amount: 1000 } },
        categoryBreakdown: [
          {
            category: ReceiptCategory.FOOD_AND_DRINKS,
            _count: { id: 5 },
            _sum: { amount: 500 }
          },
          {
            category: ReceiptCategory.TRANSPORTATION,
            _count: { id: 3 },
            _sum: { amount: 300 }
          }
        ],
        topMerchants: [
          {
            merchantName: 'Store 1',
            _count: { id: 3 },
            _sum: { amount: 300 }
          }
        ],
        spendingTrend: [
          {
            transactionDate: new Date(),
            _count: { id: 2 },
            _sum: { amount: 200 }
          }
        ]
      };

      // Configure the mock Prisma instance
      mockPrisma.receipt.count.mockResolvedValue(mockData.totalReceipts);
      mockPrisma.receipt.aggregate.mockResolvedValue(mockData.totalAmount);
      mockPrisma.receipt.groupBy
        .mockResolvedValueOnce(mockData.categoryBreakdown)
        .mockResolvedValueOnce(mockData.topMerchants)
        .mockResolvedValueOnce(mockData.spendingTrend);

      const result = await ReceiptService.getAnalytics(userId, period);

      expect(result).toEqual({
        period: 'month',
        summary: {
          totalReceipts: 10,
          totalAmount: 1000,
          averageAmount: 100
        },
        categoryBreakdown: [
          {
            category: ReceiptCategory.FOOD_AND_DRINKS,
            count: 5,
            totalAmount: 500,
            percentage: 50
          },
          {
            category: ReceiptCategory.TRANSPORTATION,
            count: 3,
            totalAmount: 300,
            percentage: 30
          }
        ],
        topMerchants: [
          {
            name: 'Store 1',
            count: 3,
            totalAmount: 300
          }
        ],
        spendingTrend: [
          {
            month: expect.any(Date),
            count: 2,
            totalAmount: 200
          }
        ]
      });
    });

    it('should handle empty data gracefully', async () => {
      const userId = 'test-user-id';

      // Configure the mock Prisma instance for empty data
      mockPrisma.receipt.count.mockResolvedValue(0);
      mockPrisma.receipt.aggregate.mockResolvedValue({ _sum: { amount: null } });
      mockPrisma.receipt.groupBy.mockResolvedValue([]);

      const result = await ReceiptService.getAnalytics(userId, 'month');

      expect(result.summary.totalReceipts).toBe(0);
      expect(result.summary.totalAmount).toBe(0);
      expect(result.summary.averageAmount).toBe(0);
    });
  });

  describe('validateReceiptData', () => {
    it('should validate correct receipt data', () => {
      const validData = {
        merchantName: 'Test Store',
        amount: 100,
        transactionDate: '2024-01-15T10:30:00Z',
        category: ReceiptCategory.FOOD_AND_DRINKS
      };

      const result = ReceiptService.validateReceiptData(validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for missing merchant name', () => {
      const invalidData = {
        amount: 100,
        transactionDate: '2024-01-15T10:30:00Z',
        category: ReceiptCategory.FOOD_AND_DRINKS
      };

      const result = ReceiptService.validateReceiptData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Merchant name is required');
    });

    it('should return errors for invalid amount', () => {
      const invalidData = {
        merchantName: 'Test Store',
        amount: 'invalid',
        transactionDate: '2024-01-15T10:30:00Z',
        category: ReceiptCategory.FOOD_AND_DRINKS
      };

      const result = ReceiptService.validateReceiptData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Valid amount is required');
    });

    it('should return errors for invalid transaction date', () => {
      const invalidData = {
        merchantName: 'Test Store',
        amount: 100,
        transactionDate: 'invalid-date',
        category: ReceiptCategory.FOOD_AND_DRINKS
      };

      const result = ReceiptService.validateReceiptData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Valid transaction date is required');
    });

    it('should return errors for invalid category', () => {
      const invalidData = {
        merchantName: 'Test Store',
        amount: 100,
        transactionDate: '2024-01-15T10:30:00Z',
        category: 'INVALID_CATEGORY'
      };

      const result = ReceiptService.validateReceiptData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Valid category is required');
    });
  });

  describe('getInsights', () => {
    it('should return insights and recommendations', async () => {
      const userId = 'test-user-id';

      const mockData = {
        lastMonthStats: { _sum: { amount: 800 }, _count: { id: 8 } },
        currentMonthStats: { _sum: { amount: 1200 }, _count: { id: 12 } },
        categoryTrends: [
          {
            category: ReceiptCategory.FOOD_AND_DRINKS,
            _sum: { amount: 600 },
            _count: { id: 6 }
          }
        ]
      };

      // Configure the mock Prisma instance
      mockPrisma.receipt.aggregate
        .mockResolvedValueOnce(mockData.lastMonthStats)
        .mockResolvedValueOnce(mockData.currentMonthStats);
      mockPrisma.receipt.groupBy.mockResolvedValue(mockData.categoryTrends);

      const result = await ReceiptService.getInsights(userId);

      expect(result.insights).toContainEqual(expect.stringContaining('increased by'));
      expect(result.recommendations).toContainEqual(expect.stringContaining('reviewing your budget'));
      expect(result.trends).toHaveLength(1);
    });

    it('should handle decreased spending', async () => {
      const userId = 'test-user-id';

      const mockData = {
        lastMonthStats: { _sum: { amount: 1200 }, _count: { id: 12 } },
        currentMonthStats: { _sum: { amount: 800 }, _count: { id: 8 } },
        categoryTrends: []
      };

      // Configure the mock Prisma instance BEFORE calling the service
      mockPrisma.receipt.aggregate
        .mockResolvedValueOnce(mockData.lastMonthStats)
        .mockResolvedValueOnce(mockData.currentMonthStats);
      mockPrisma.receipt.groupBy.mockResolvedValue(mockData.categoryTrends);

      const result = await ReceiptService.getInsights(userId);

      expect(result.insights).toContainEqual(expect.stringContaining('decreased by'));
      expect(result.recommendations).toContainEqual(expect.stringContaining('good work'));
    });

    it('should handle zero spending in previous month', async () => {
      const userId = 'test-user-id';

      const mockData = {
        lastMonthStats: { _sum: { amount: 0 }, _count: { id: 0 } },
        currentMonthStats: { _sum: { amount: 1000 }, _count: { id: 10 } },
        categoryTrends: []
      };

      // Configure the mock Prisma instance
      mockPrisma.receipt.aggregate
        .mockResolvedValueOnce(mockData.lastMonthStats)
        .mockResolvedValueOnce(mockData.currentMonthStats);
      mockPrisma.receipt.groupBy.mockResolvedValue(mockData.categoryTrends);

      const result = await ReceiptService.getInsights(userId);

      expect(result.insights).toHaveLength(0);
      expect(result.recommendations).toHaveLength(0);
    });
  });
}); 