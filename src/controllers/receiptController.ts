import { Request, Response } from 'express';
import { PrismaClient, ReceiptCategory, PaymentMethod, Currency } from '@prisma/client';
import logger from '../utils/logger';
import { ReceiptService } from '../services/receiptService';

// Default Prisma instance for production use
const defaultPrisma = new PrismaClient();

export class ReceiptController {
  private static prisma: PrismaClient = defaultPrisma;

  // Method to set Prisma instance for testing
  static setPrisma(prismaInstance: PrismaClient) {
    ReceiptController.prisma = prismaInstance;
  }

  // Method to reset to default Prisma instance
  static resetPrisma() {
    ReceiptController.prisma = defaultPrisma;
  }

  /**
   * Upload a new receipt
   * POST /api/v1/receipts/upload
   */
  static async uploadReceipt(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const {
        merchantName,
        amount,
        currency = 'DOP',
        transactionDate,
        category,
        subcategory,
        paymentMethod,
        location,
        notes,
        imageUrl
      } = req.body;

      // Sanitize inputs
      const sanitizedMerchantName = merchantName?.toString().trim().replace(/[<>]/g, '');
      const sanitizedSubcategory = subcategory?.toString().trim().replace(/[<>]/g, '');
      const sanitizedLocation = location?.toString().trim().replace(/[<>]/g, '');
      const sanitizedNotes = notes?.toString().trim().replace(/[<>]/g, '');

      // Validate required fields
      if (!sanitizedMerchantName || !amount || !transactionDate || !category) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['merchantName', 'amount', 'transactionDate', 'category']
        });
      }

      // Validate amount is positive and reasonable
      const amountValue = parseFloat(amount);
      if (isNaN(amountValue) || amountValue <= 0) {
        return res.status(400).json({
          error: 'Amount must be a positive number'
        });
      }

      if (amountValue > 1000000) { // 1 million limit
        return res.status(400).json({
          error: 'Amount exceeds maximum limit of 1,000,000'
        });
      }

      // Validate transaction date
      const transactionDateObj = new Date(transactionDate);
      if (isNaN(transactionDateObj.getTime())) {
        return res.status(400).json({
          error: 'Invalid transaction date format'
        });
      }

      // Check if transaction date is not in the future
      const now = new Date();
      if (transactionDateObj > now) {
        return res.status(400).json({
          error: 'Transaction date cannot be in the future'
        });
      }

      // Check if transaction date is not too old (more than 10 years)
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
      if (transactionDateObj < tenYearsAgo) {
        return res.status(400).json({
          error: 'Transaction date cannot be more than 10 years ago'
        });
      }

      // Validate merchant name length
      if (sanitizedMerchantName.length > 200) {
        return res.status(400).json({
          error: 'Merchant name is too long (max 200 characters)'
        });
      }

      // Validate notes length if provided
      if (sanitizedNotes && sanitizedNotes.length > 1000) {
        return res.status(400).json({
          error: 'Notes are too long (max 1000 characters)'
        });
      }

      // Validate imageUrl if provided
      if (imageUrl) {
        try {
          const url = new URL(imageUrl);
          if (!['http:', 'https:'].includes(url.protocol)) {
            return res.status(400).json({
              error: 'Image URL must use HTTP or HTTPS protocol'
            });
          }
          
          // Check for common image extensions
          const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
          const hasImageExtension = imageExtensions.some(ext => 
            url.pathname.toLowerCase().endsWith(ext)
          );
          
          if (!hasImageExtension) {
            return res.status(400).json({
              error: 'Image URL must point to a valid image file (jpg, jpeg, png, gif, webp, bmp)'
            });
          }
        } catch (error) {
          return res.status(400).json({
            error: 'Invalid image URL format'
          });
        }
      }

      // Validate category
      if (!Object.values(ReceiptCategory).includes(category)) {
        return res.status(400).json({
          error: 'Invalid category',
          validCategories: Object.values(ReceiptCategory)
        });
      }

      // Validate payment method if provided
      if (paymentMethod && !Object.values(PaymentMethod).includes(paymentMethod)) {
        return res.status(400).json({
          error: 'Invalid payment method',
          validPaymentMethods: Object.values(PaymentMethod)
        });
      }

      // Validate currency if provided
      if (currency && !Object.values(Currency).includes(currency)) {
        return res.status(400).json({
          error: 'Invalid currency',
          validCurrencies: Object.values(Currency)
        });
      }

      const receipt = await ReceiptController.prisma.receipt.create({
        data: {
          userId,
          merchantName: sanitizedMerchantName,
          amount: parseFloat(amount),
          currency: currency as Currency,
          transactionDate: new Date(transactionDate),
          category: category as ReceiptCategory,
          subcategory: sanitizedSubcategory,
          paymentMethod: paymentMethod as PaymentMethod,
          location: sanitizedLocation,
          notes: sanitizedNotes,
          imageUrl,
          ocrProcessed: false
        }
      });

      logger.info(`📸 Receipt uploaded: ${receipt.id} for user ${userId}`);

      res.status(201).json({
        message: 'Receipt uploaded successfully',
        receipt: {
          id: receipt.id,
          merchantName: receipt.merchantName,
          amount: receipt.amount,
          currency: receipt.currency,
          transactionDate: receipt.transactionDate,
          category: receipt.category,
          subcategory: receipt.subcategory,
          paymentMethod: receipt.paymentMethod,
          location: receipt.location,
          notes: receipt.notes,
          imageUrl: receipt.imageUrl,
          ocrProcessed: receipt.ocrProcessed,
          createdAt: receipt.createdAt
        }
      });
    } catch (error) {
      logger.error('Error uploading receipt:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
    return null;
  }

  /**
   * Get all receipts for a user
   * GET /api/v1/receipts
   */
  static async getReceipts(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const {
        page = 1,
        limit = 20,
        category,
        startDate,
        endDate,
        minAmount,
        maxAmount,
        search
      } = req.query;

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = parseInt(limit as string);

      // Build where clause
      const where: any = { userId };

      if (category) {
        where.category = category;
      }

      if (startDate || endDate) {
        where.transactionDate = {};
        if (startDate) {
          where.transactionDate.gte = new Date(startDate as string);
        }
        if (endDate) {
          where.transactionDate.lte = new Date(endDate as string);
        }
      }

      if (minAmount || maxAmount) {
        where.amount = {};
        if (minAmount) {
          where.amount.gte = parseFloat(minAmount as string);
        }
        if (maxAmount) {
          where.amount.lte = parseFloat(maxAmount as string);
        }
      }

      if (search) {
        where.OR = [
          { merchantName: { contains: search as string, mode: 'insensitive' } },
          { notes: { contains: search as string, mode: 'insensitive' } },
          { location: { contains: search as string, mode: 'insensitive' } }
        ];
      }

      const [receipts, total] = await Promise.all([
        ReceiptController.prisma.receipt.findMany({
          where,
          orderBy: { transactionDate: 'desc' },
          skip,
          take,
          select: {
            id: true,
            merchantName: true,
            amount: true,
            currency: true,
            transactionDate: true,
            category: true,
            subcategory: true,
            paymentMethod: true,
            location: true,
            notes: true,
            imageUrl: true,
            ocrProcessed: true,
            ocrConfidence: true,
            createdAt: true,
            updatedAt: true
          }
        }),
        ReceiptController.prisma.receipt.count({ where })
      ]);

      const totalPages = Math.ceil(total / take);

      res.json({
        receipts,
        pagination: {
          page: parseInt(page as string),
          limit: take,
          total,
          totalPages,
          hasNext: parseInt(page as string) < totalPages,
          hasPrev: parseInt(page as string) > 1
        }
      });
    } catch (error) {
      logger.error('Error getting receipts:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
    return null;
  }

  /**
   * Get a specific receipt by ID
   * GET /api/v1/receipts/:id
   */
  static async getReceiptById(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const receipt = await ReceiptController.prisma.receipt.findFirst({
        where: {
          id,
          userId
        }
      });

      if (!receipt) {
        return res.status(404).json({ error: 'Receipt not found' });
      }

      res.json({ receipt });
    } catch (error) {
      logger.error('Error getting receipt by ID:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
    return null;
  }

  /**
   * Update a receipt
   * PUT /api/v1/receipts/:id
   */
  static async updateReceipt(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      const updateData = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check if receipt exists and belongs to user
      const existingReceipt = await ReceiptController.prisma.receipt.findFirst({
        where: { id, userId }
      });

      if (!existingReceipt) {
        return res.status(404).json({ error: 'Receipt not found' });
      }

      // Sanitize inputs if provided
      if (updateData.merchantName) {
        updateData.merchantName = updateData.merchantName.toString().trim().replace(/[<>]/g, '');
        if (updateData.merchantName.length > 200) {
          return res.status(400).json({
            error: 'Merchant name is too long (max 200 characters)'
          });
        }
      }

      if (updateData.subcategory) {
        updateData.subcategory = updateData.subcategory.toString().trim().replace(/[<>]/g, '');
      }

      if (updateData.location) {
        updateData.location = updateData.location.toString().trim().replace(/[<>]/g, '');
      }

      if (updateData.notes) {
        updateData.notes = updateData.notes.toString().trim().replace(/[<>]/g, '');
        if (updateData.notes.length > 1000) {
          return res.status(400).json({
            error: 'Notes are too long (max 1000 characters)'
          });
        }
      }

      // Validate amount if provided
      if (updateData.amount) {
        const amountValue = parseFloat(updateData.amount);
        if (isNaN(amountValue) || amountValue <= 0) {
          return res.status(400).json({
            error: 'Amount must be a positive number'
          });
        }
        if (amountValue > 1000000) {
          return res.status(400).json({
            error: 'Amount exceeds maximum limit of 1,000,000'
          });
        }
        updateData.amount = amountValue;
      }

      // Validate transaction date if provided
      if (updateData.transactionDate) {
        const transactionDateObj = new Date(updateData.transactionDate);
        if (isNaN(transactionDateObj.getTime())) {
          return res.status(400).json({
            error: 'Invalid transaction date format'
          });
        }
        
        const now = new Date();
        if (transactionDateObj > now) {
          return res.status(400).json({
            error: 'Transaction date cannot be in the future'
          });
        }

        const tenYearsAgo = new Date();
        tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
        if (transactionDateObj < tenYearsAgo) {
          return res.status(400).json({
            error: 'Transaction date cannot be more than 10 years ago'
          });
        }
        
        updateData.transactionDate = transactionDateObj;
      }

      // Validate imageUrl if provided
      if (updateData.imageUrl) {
        try {
          const url = new URL(updateData.imageUrl);
          if (!['http:', 'https:'].includes(url.protocol)) {
            return res.status(400).json({
              error: 'Image URL must use HTTP or HTTPS protocol'
            });
          }
          
          const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
          const hasImageExtension = imageExtensions.some(ext => 
            url.pathname.toLowerCase().endsWith(ext)
          );
          
          if (!hasImageExtension) {
            return res.status(400).json({
              error: 'Image URL must point to a valid image file (jpg, jpeg, png, gif, webp, bmp)'
            });
          }
        } catch (error) {
          return res.status(400).json({
            error: 'Invalid image URL format'
          });
        }
      }

      // Validate category if provided
      if (updateData.category && !Object.values(ReceiptCategory).includes(updateData.category)) {
        return res.status(400).json({
          error: 'Invalid category',
          validCategories: Object.values(ReceiptCategory)
        });
      }

      // Validate payment method if provided
      if (updateData.paymentMethod && !Object.values(PaymentMethod).includes(updateData.paymentMethod)) {
        return res.status(400).json({
          error: 'Invalid payment method',
          validPaymentMethods: Object.values(PaymentMethod)
        });
      }

      // Validate currency if provided
      if (updateData.currency && !Object.values(Currency).includes(updateData.currency)) {
        return res.status(400).json({
          error: 'Invalid currency',
          validCurrencies: Object.values(Currency)
        });
      }

      const updatedReceipt = await ReceiptController.prisma.receipt.update({
        where: { id },
        data: updateData
      });

      logger.info(`📝 Receipt updated: ${id} by user ${userId}`);

      res.json({
        message: 'Receipt updated successfully',
        receipt: updatedReceipt
      });
    } catch (error) {
      logger.error('Error updating receipt:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
    return null;
  }

  /**
   * Delete a receipt
   * DELETE /api/v1/receipts/:id
   */
  static async deleteReceipt(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check if receipt exists and belongs to user
      const existingReceipt = await ReceiptController.prisma.receipt.findFirst({
        where: { id, userId }
      });

      if (!existingReceipt) {
        return res.status(404).json({ error: 'Receipt not found' });
      }

      await ReceiptController.prisma.receipt.delete({
        where: { id }
      });

      logger.info(`🗑️ Receipt deleted: ${id} by user ${userId}`);

      res.json({ message: 'Receipt deleted successfully' });
    } catch (error) {
      logger.error('Error deleting receipt:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
    return null;
  }

  /**
   * Process OCR for a receipt
   * POST /api/v1/receipts/:id/ocr
   */
  static async processOCR(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check if receipt exists and belongs to user
      const receipt = await ReceiptController.prisma.receipt.findFirst({
        where: { id, userId }
      });

      if (!receipt) {
        return res.status(404).json({ error: 'Receipt not found' });
      }

      if (!receipt.imageUrl) {
        return res.status(400).json({ error: 'No image available for OCR processing' });
      }

      // TODO: Implement actual OCR processing
      // For now, we'll simulate OCR processing
      const mockOCRResult = {
        merchantName: receipt.merchantName,
        amount: receipt.amount,
        transactionDate: receipt.transactionDate,
        confidence: 0.85,
        rawText: `Receipt from ${receipt.merchantName} for ${receipt.amount} ${receipt.currency}`,
        processed: true
      };

      const updatedReceipt = await ReceiptController.prisma.receipt.update({
        where: { id },
        data: {
          ocrProcessed: true,
          ocrConfidence: mockOCRResult.confidence,
          ocrRawText: mockOCRResult.rawText
        }
      });

      logger.info(`🔍 OCR processed for receipt: ${id}`);

      res.json({
        message: 'OCR processing completed',
        ocrResult: mockOCRResult,
        receipt: updatedReceipt
      });
    } catch (error) {
      logger.error('Error processing OCR:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
    return null;
  }

  /**
   * Get receipt statistics
   * GET /api/v1/receipts/stats
   */
  static async getReceiptStats(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { period = 'month' } = req.query;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      const [
        totalReceipts,
        totalAmount,
        categoryStats,
        monthlyStats
      ] = await Promise.all([
        // Total receipts in period
        ReceiptController.prisma.receipt.count({
          where: {
            userId,
            transactionDate: { gte: startDate }
          }
        }),
        // Total amount in period
        ReceiptController.prisma.receipt.aggregate({
          where: {
            userId,
            transactionDate: { gte: startDate }
          },
          _sum: { amount: true }
        }),
        // Stats by category
        ReceiptController.prisma.receipt.groupBy({
          by: ['category'],
          where: {
            userId,
            transactionDate: { gte: startDate }
          },
          _count: { id: true },
          _sum: { amount: true }
        }),
        // Monthly stats for the last 12 months
        ReceiptController.prisma.receipt.groupBy({
          by: ['transactionDate'],
          where: {
            userId,
            transactionDate: { gte: new Date(now.getFullYear() - 1, 0, 1) }
          },
          _count: { id: true },
          _sum: { amount: true }
        })
      ]);

      const totalAmountValue = totalAmount._sum.amount ? Number(totalAmount._sum.amount) : 0;
      
      res.json({
        period: period as string,
        stats: {
          totalReceipts,
          totalAmount: totalAmountValue,
          averageAmount: totalReceipts > 0 ? totalAmountValue / totalReceipts : 0,
          categoryBreakdown: categoryStats.map(stat => ({
            category: stat.category,
            count: stat._count.id,
            totalAmount: stat._sum.amount ? Number(stat._sum.amount) : 0
          })),
          monthlyBreakdown: monthlyStats.map(stat => ({
            month: stat.transactionDate,
            count: stat._count.id,
            totalAmount: stat._sum.amount ? Number(stat._sum.amount) : 0
          }))
        }
      });
    } catch (error) {
      logger.error('Error getting receipt stats:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
    return null;
  }

  /**
   * Get available categories and payment methods
   * GET /api/v1/receipts/options
   */
  static async getReceiptOptions(req: Request, res: Response) {
    try {
      res.json({
        categories: Object.values(ReceiptCategory),
        paymentMethods: Object.values(PaymentMethod),
        currencies: Object.values(Currency)
      });
    } catch (error) {
      logger.error('Error getting receipt options:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
    return null;
  }

  /**
   * Get receipt insights and recommendations
   * GET /api/v1/receipts/insights
   */
  static async getReceiptInsights(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const insights = await ReceiptService.getInsights(userId);

      res.json({
        insights: insights.insights,
        recommendations: insights.recommendations,
        trends: insights.trends
      });
    } catch (error) {
      logger.error('Error getting receipt insights:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
    return null;
  }

  /**
   * Get detailed analytics
   * GET /api/v1/receipts/analytics
   */
  static async getReceiptAnalytics(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { period = 'month' } = req.query;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const analytics = await ReceiptService.getAnalytics(userId, period as 'week' | 'month' | 'year');

      res.json(analytics);
    } catch (error) {
      logger.error('Error getting receipt analytics:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
    return null;
  }

  /**
   * Suggest category for a receipt
   * POST /api/v1/receipts/suggest-category
   */
  static async suggestCategory(req: Request, res: Response) {
    try {
      const { merchantName, amount } = req.body;

      if (!merchantName || !amount) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['merchantName', 'amount']
        });
      }

      const suggestedCategory = await ReceiptService.suggestCategory(merchantName, parseFloat(amount));

      res.json({
        suggestedCategory,
        confidence: 'medium' // TODO: Implement confidence scoring
      });
    } catch (error) {
      logger.error('Error suggesting category:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
    return null;
  }
} 