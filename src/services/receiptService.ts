import { PrismaClient, ReceiptCategory, PaymentMethod } from '@prisma/client';
import logger from '../utils/logger';

// Default Prisma instance for production use
const defaultPrisma = new PrismaClient();

export class ReceiptService {
  private static prisma: PrismaClient = defaultPrisma;

  // Method to set Prisma instance for testing
  static setPrisma(prismaInstance: PrismaClient) {
    ReceiptService.prisma = prismaInstance;
  }

  // Method to reset to default Prisma instance
  static resetPrisma() {
    ReceiptService.prisma = defaultPrisma;
  }

  /**
   * Process OCR for a receipt image
   */
  static async processOCR(imageUrl: string): Promise<{
    merchantName: string;
    amount: number;
    transactionDate: Date;
    confidence: number;
    rawText: string;
    category?: ReceiptCategory;
    paymentMethod?: PaymentMethod;
  }> {
    try {
      logger.info(`🔍 Processing OCR for image: ${imageUrl}`);

      // TODO: Integrate with actual OCR service (Google Vision API, AWS Textract, etc.)
      // For now, we'll simulate OCR processing
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock OCR result
      const mockResult = {
        merchantName: 'Supermercado Nacional',
        amount: 1250.50,
        transactionDate: new Date(),
        confidence: 0.85,
        rawText: `SUPERMERCADO NACIONAL
        Fecha: ${new Date().toLocaleDateString()}
        Total: RD$ 1,250.50
        Método de pago: Tarjeta de crédito
        Gracias por su compra!`,
        category: ReceiptCategory.FOOD_AND_DRINKS,
        paymentMethod: PaymentMethod.CREDIT_CARD
      };

      logger.info(`✅ OCR processing completed for: ${imageUrl}`);
      return mockResult;
    } catch (error) {
      logger.error('Error processing OCR:', error);
      throw new Error('OCR processing failed');
    }
  }

  /**
   * Analyze receipt data and suggest category
   */
  static async suggestCategory(merchantName: string, amount: number): Promise<ReceiptCategory> {
    try {
      // Simple category suggestion based on merchant name and amount
      const merchantLower = merchantName.toLowerCase();
      
      if (merchantLower.includes('super') || merchantLower.includes('market') || 
          merchantLower.includes('grocery') || merchantLower.includes('food')) {
        return ReceiptCategory.FOOD_AND_DRINKS;
      }
      
      if (merchantLower.includes('gas') || merchantLower.includes('fuel') || 
          merchantLower.includes('uber') || merchantLower.includes('taxi')) {
        return ReceiptCategory.TRANSPORTATION;
      }
      
      if (merchantLower.includes('clinic') || merchantLower.includes('hospital') || 
          merchantLower.includes('pharmacy') || merchantLower.includes('medical')) {
        return ReceiptCategory.HEALTHCARE;
      }
      
      if (merchantLower.includes('school') || merchantLower.includes('university') || 
          merchantLower.includes('course') || merchantLower.includes('education')) {
        return ReceiptCategory.EDUCATION;
      }
      
      if (merchantLower.includes('electric') || merchantLower.includes('water') || 
          merchantLower.includes('internet') || merchantLower.includes('phone')) {
        return ReceiptCategory.UTILITIES;
      }
      
      if (merchantLower.includes('insurance') || merchantLower.includes('assurance')) {
        return ReceiptCategory.INSURANCE;
      }
      
      if (merchantLower.includes('bank') || merchantLower.includes('investment') || 
          merchantLower.includes('savings')) {
        return ReceiptCategory.INVESTMENTS;
      }
      
      // Check if it's a known store type that should be OTHER
      if (merchantLower.includes('unknown') || merchantLower.includes('misc')) {
        return ReceiptCategory.OTHER;
      }
      
      // Default to shopping for retail stores
      return ReceiptCategory.SHOPPING;
    } catch (error) {
      logger.error('Error suggesting category:', error);
      return ReceiptCategory.OTHER;
    }
  }

  /**
   * Get receipt analytics for a user
   */
  static async getAnalytics(userId: string, period: 'week' | 'month' | 'year' = 'month') {
    try {
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
        categoryBreakdown,
        topMerchants,
        spendingTrend
      ] = await Promise.all([
        // Total receipts
        ReceiptService.prisma.receipt.count({
          where: {
            userId,
            transactionDate: { gte: startDate }
          }
        }),
        // Total amount
        ReceiptService.prisma.receipt.aggregate({
          where: {
            userId,
            transactionDate: { gte: startDate }
          },
          _sum: { amount: true }
        }),
        // Category breakdown
        ReceiptService.prisma.receipt.groupBy({
          by: ['category'],
          where: {
            userId,
            transactionDate: { gte: startDate }
          },
          _count: { id: true },
          _sum: { amount: true }
        }),
        // Top merchants
        ReceiptService.prisma.receipt.groupBy({
          by: ['merchantName'],
          where: {
            userId,
            transactionDate: { gte: startDate }
          },
          _count: { id: true },
          _sum: { amount: true },
          orderBy: {
            _sum: {
              amount: 'desc'
            }
          },
          take: 10
        }),
        // Spending trend (last 12 months)
        ReceiptService.prisma.receipt.groupBy({
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
      
      return {
        period,
        summary: {
          totalReceipts,
          totalAmount: totalAmountValue,
          averageAmount: totalReceipts > 0 ? totalAmountValue / totalReceipts : 0
        },
        categoryBreakdown: categoryBreakdown.map(stat => ({
          category: stat.category,
          count: stat._count.id,
          totalAmount: stat._sum.amount ? Number(stat._sum.amount) : 0,
          percentage: totalAmountValue > 0 ? ((stat._sum.amount ? Number(stat._sum.amount) : 0) / totalAmountValue) * 100 : 0
        })),
        topMerchants: topMerchants.map(merchant => ({
          name: merchant.merchantName,
          count: merchant._count.id,
          totalAmount: merchant._sum.amount ? Number(merchant._sum.amount) : 0
        })),
        spendingTrend: spendingTrend.map(month => ({
          month: month.transactionDate,
          count: month._count.id,
          totalAmount: month._sum.amount ? Number(month._sum.amount) : 0
        }))
      };
    } catch (error) {
      logger.error('Error getting receipt analytics:', error);
      throw new Error('Failed to get analytics');
    }
  }

  /**
   * Validate receipt data
   */
  static validateReceiptData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.merchantName || data.merchantName.trim().length === 0) {
      errors.push('Merchant name is required');
    }

    if (!data.amount || isNaN(parseFloat(data.amount)) || parseFloat(data.amount) <= 0) {
      errors.push('Valid amount is required');
    }

    if (!data.transactionDate || isNaN(Date.parse(data.transactionDate))) {
      errors.push('Valid transaction date is required');
    }

    if (!data.category || !Object.values(ReceiptCategory).includes(data.category)) {
      errors.push('Valid category is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get receipt insights and recommendations
   */
  static async getInsights(userId: string): Promise<{
    insights: string[];
    recommendations: string[];
    trends: any[];
  }> {
    try {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        lastMonthStats,
        currentMonthStats,
        categoryTrends
      ] = await Promise.all([
        // Last month stats
        ReceiptService.prisma.receipt.aggregate({
          where: {
            userId,
            transactionDate: { gte: lastMonth, lt: currentMonth }
          },
          _sum: { amount: true },
          _count: { id: true }
        }),
        // Current month stats
        ReceiptService.prisma.receipt.aggregate({
          where: {
            userId,
            transactionDate: { gte: currentMonth }
          },
          _sum: { amount: true },
          _count: { id: true }
        }),
        // Category trends
        ReceiptService.prisma.receipt.groupBy({
          by: ['category'],
          where: {
            userId,
            transactionDate: { gte: lastMonth }
          },
          _sum: { amount: true },
          _count: { id: true }
        })
      ]);

      const insights: string[] = [];
      const recommendations: string[] = [];

      // Compare spending between months
      const lastMonthTotal = lastMonthStats._sum.amount ? Number(lastMonthStats._sum.amount) : 0;
      const currentMonthTotal = currentMonthStats._sum.amount ? Number(currentMonthStats._sum.amount) : 0;
      const change = lastMonthTotal > 0 ? ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0;

      if (change > 20) {
        insights.push(`Your spending increased by ${change.toFixed(1)}% compared to last month`);
        recommendations.push('Consider reviewing your budget and identifying areas to reduce expenses');
      } else if (change < -20) {
        insights.push(`Great job! Your spending decreased by ${Math.abs(change).toFixed(1)}% compared to last month`);
        recommendations.push('Keep up the good work with your spending habits');
      }

      // Analyze category spending
      const topCategory = categoryTrends.length > 0 ? categoryTrends.reduce((max, current) => 
        (current._sum.amount || 0) > (max._sum.amount || 0) ? current : max
      ) : null;

      if (topCategory) {
        insights.push(`Your highest spending category is ${topCategory.category}`);
        if (topCategory.category === ReceiptCategory.FOOD_AND_DRINKS) {
          recommendations.push('Consider meal planning to reduce food expenses');
        } else if (topCategory.category === ReceiptCategory.TRANSPORTATION) {
          recommendations.push('Look into carpooling or public transportation options');
        }
      }

      // Frequency insights
      const avgReceiptsPerMonth = (lastMonthStats._count.id + currentMonthStats._count.id) / 2;
      if (avgReceiptsPerMonth > 50) {
        insights.push('You make many small purchases. Consider consolidating them');
        recommendations.push('Try to reduce impulse purchases and plan your shopping');
      }

      return {
        insights,
        recommendations,
        trends: categoryTrends.map(trend => ({
          category: trend.category,
          totalAmount: trend._sum.amount ? Number(trend._sum.amount) : 0,
          count: trend._count.id
        }))
      };
    } catch (error) {
      logger.error('Error getting receipt insights:', error);
      return {
        insights: [],
        recommendations: [],
        trends: []
      };
    }
  }
} 