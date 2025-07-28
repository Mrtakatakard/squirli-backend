import { PrismaClient, AIInteraction, FinancialQueryCategory } from '@prisma/client';
import { DisclaimerService } from './disclaimerService';

const prisma = new PrismaClient();

export interface AIInteractionLog {
  userId: string;
  sessionId?: string;
  userMessage: string;
  aiResponse: string;
  model: string;
  tokensUsed?: number;
  responseTime?: number;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
}

export interface AIInteractionStats {
  totalInteractions: number;
  financialInteractions: number;
  averageResponseTime: number;
  mostCommonCategories: Array<{
    category: FinancialQueryCategory;
    count: number;
  }>;
  userSatisfaction: {
    averageRating: number;
    totalRatings: number;
  };
}

export class AILoggingService {
  /**
   * Registra una interacción con IA
   */
  static async logInteraction(logData: AIInteractionLog): Promise<AIInteraction> {
    const startTime = Date.now();
    
    try {
      // Detectar si es consulta financiera
      const financialFilter = DisclaimerService.detectFinancialQuery(logData.userMessage);
      
      // Validar la consulta
      const validation = DisclaimerService.validateQuery(logData.userMessage);
      if (!validation.isValid) {
        throw new Error(validation.reason);
      }
      
      // Crear el registro en la base de datos
      const interaction = await prisma.aIInteraction.create({
        data: {
          userId: logData.userId,
          sessionId: logData.sessionId || null,
          interactionType: financialFilter.type || 'GENERAL_QUESTION',
          userMessage: logData.userMessage,
          aiResponse: logData.aiResponse,
          model: logData.model,
          tokensUsed: logData.tokensUsed || null,
          responseTime: logData.responseTime || null,
          isFinancialQuery: financialFilter.isFinancial,
          queryCategory: financialFilter.category || null,
          disclaimerShown: financialFilter.isFinancial,
          disclaimerVersion: 'v1.0',
          ipAddress: logData.ipAddress,
          userAgent: logData.userAgent,
          metadata: logData.metadata
        }
      });
      
      const endTime = Date.now();
      console.log(`📊 AI Interaction logged in ${endTime - startTime}ms`);
      
      return interaction;
    } catch (error) {
      console.error('❌ Error logging AI interaction:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de interacciones
   */
  static async getInteractionStats(
    userId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<AIInteractionStats> {
    const whereClause: any = {};
    
    if (userId) {
      whereClause.userId = userId;
    }
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }

    try {
      // Obtener estadísticas básicas
      const [totalInteractions, financialInteractions, avgResponseTime] = await Promise.all([
        prisma.aIInteraction.count({ where: whereClause }),
        prisma.aIInteraction.count({ 
          where: { 
            ...whereClause, 
            isFinancialQuery: true 
          } 
        }),
        prisma.aIInteraction.aggregate({
          where: { 
            ...whereClause, 
            responseTime: { not: null } 
          },
          _avg: { responseTime: true }
        })
      ]);

      // Obtener categorías más comunes
      const categoryStats = await prisma.aIInteraction.groupBy({
        by: ['queryCategory'],
        where: { 
          ...whereClause, 
          queryCategory: { not: null } 
        },
        _count: { queryCategory: true },
        orderBy: { _count: { queryCategory: 'desc' } },
        take: 10
      });

      // Obtener estadísticas de satisfacción
      const satisfactionStats = await prisma.aIInteraction.aggregate({
        where: { 
          ...whereClause, 
          userRating: { not: null } 
        },
        _avg: { userRating: true },
        _count: { userRating: true }
      });

      return {
        totalInteractions,
        financialInteractions,
        averageResponseTime: avgResponseTime._avg.responseTime || 0,
        mostCommonCategories: categoryStats.map(stat => ({
          category: stat.queryCategory as FinancialQueryCategory,
          count: stat._count.queryCategory
        })),
        userSatisfaction: {
          averageRating: satisfactionStats._avg.userRating || 0,
          totalRatings: satisfactionStats._count.userRating
        }
      };

    } catch (error) {
      console.error('❌ Error getting interaction stats:', error);
      throw error;
    }
  }

  /**
   * Obtiene el historial de interacciones de un usuario
   */
  static async getUserInteractionHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<AIInteraction[]> {
    try {
      return await prisma.aIInteraction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      });
    } catch (error) {
      console.error('❌ Error getting user interaction history:', error);
      throw error;
    }
  }

  /**
   * Actualiza la calificación de una interacción
   */
  static async updateInteractionRating(
    interactionId: string,
    rating: number,
    feedback?: string
  ): Promise<AIInteraction> {
    try {
      return await prisma.aIInteraction.update({
        where: { id: interactionId },
        data: {
          userRating: rating,
          userFeedback: feedback || null
        }
      });
    } catch (error) {
      console.error('❌ Error updating interaction rating:', error);
      throw error;
    }
  }

  /**
   * Obtiene análisis de tendencias
   */
  static async getTrendAnalysis(days: number = 30): Promise<any> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const dailyStats = await prisma.aIInteraction.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: { gte: startDate }
        },
        _count: { id: true },
        _avg: { responseTime: true }
      });

      const financialTrend = await prisma.aIInteraction.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: { gte: startDate },
          isFinancialQuery: true
        },
        _count: { id: true }
      });

      return {
        dailyStats: dailyStats.map(stat => ({
          date: stat.createdAt,
          totalInteractions: stat._count.id,
          avgResponseTime: stat._avg.responseTime
        })),
        financialTrend: financialTrend.map(stat => ({
          date: stat.createdAt,
          financialInteractions: stat._count.id
        }))
      };

    } catch (error) {
      console.error('❌ Error getting trend analysis:', error);
      throw error;
    }
  }

  /**
   * Exporta datos de interacciones
   */
  static async exportInteractionData(
    startDate?: Date,
    endDate?: Date,
    format: 'json' | 'csv' = 'json'
  ): Promise<any> {
    try {
      const whereClause: any = {};
      
      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt.gte = startDate;
        if (endDate) whereClause.createdAt.lte = endDate;
      }

      const interactions = await prisma.aIInteraction.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          interactionType: true,
          userMessage: true,
          aiResponse: true,
          model: true,
          tokensUsed: true,
          responseTime: true,
          isFinancialQuery: true,
          queryCategory: true,
          disclaimerShown: true,
          userRating: true,
          userFeedback: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true
        }
      });

      if (format === 'csv') {
        // Convertir a CSV
        const headers = [
          'ID', 'User ID', 'Type', 'User Message', 'AI Response', 'Model',
          'Tokens', 'Response Time', 'Financial', 'Category', 'Disclaimer',
          'Rating', 'Feedback', 'IP', 'User Agent', 'Created At'
        ];

        const csvRows = [
          headers.join(','),
          ...interactions.map(interaction => [
            interaction.id,
            interaction.userId,
            interaction.interactionType,
            `"${interaction.userMessage.replace(/"/g, '""')}"`,
            `"${interaction.aiResponse.replace(/"/g, '""')}"`,
            interaction.model,
            interaction.tokensUsed || '',
            interaction.responseTime || '',
            interaction.isFinancialQuery,
            interaction.queryCategory || '',
            interaction.disclaimerShown,
            interaction.userRating || '',
            `"${(interaction.userFeedback || '').replace(/"/g, '""')}"`,
            interaction.ipAddress || '',
            `"${(interaction.userAgent || '').replace(/"/g, '""')}"`,
            interaction.createdAt.toISOString()
          ].join(','))
        ];

        return {
          format: 'csv',
          data: csvRows.join('\n'),
          totalRecords: interactions.length
        };
      }

      return {
        format: 'json',
        data: interactions,
        totalRecords: interactions.length
      };

    } catch (error) {
      console.error('❌ Error exporting interaction data:', error);
      throw error;
    }
  }

  /**
   * Limpia datos antiguos
   */
  static async cleanupOldData(daysToKeep: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await prisma.aIInteraction.deleteMany({
        where: {
          createdAt: { lt: cutoffDate }
        }
      });

      console.log(`🗑️ Cleaned up ${result.count} old AI interactions`);
      return result.count;

    } catch (error) {
      console.error('❌ Error cleaning up old data:', error);
      throw error;
    }
  }
} 