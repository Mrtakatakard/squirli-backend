import { Request, Response } from 'express';
import { getClaudeService } from '../services/claudeService';
import logger from '../utils/logger';

// Request interfaces
interface ChatRequest {
  message: string;
  userTier?: 'free' | 'premium';
  context?: string;
}

interface TestConnectionRequest {
  // No additional fields needed for testing
}

interface RateInteractionRequest {
  interactionId: string;
  rating: number;
  feedback?: string;
}

// Response interfaces
interface ChatResponse {
  success: boolean;
  data?: {
    response: string;
    model: string;
    tokens: number;
    cost: number;
    isFinancialQuery: boolean;
    queryCategory?: string;
    disclaimerShown: boolean;
    disclaimerText?: string;
    responseTime: number;
    timestamp: string;
  };
  error?: string;
}

interface TestConnectionResponse {
  success: boolean;
  data?: {
    message: string;
    model: string;
    response?: string;
    timestamp: string;
  };
  error?: string;
}

interface StatsResponse {
  success: boolean;
  data?: {
    totalInteractions: number;
    financialInteractions: number;
    averageResponseTime: number;
    mostCommonCategories: Array<{
      category: string;
      count: number;
    }>;
    userSatisfaction: {
      averageRating: number;
      totalRatings: number;
    };
    timestamp: string;
  };
  error?: string;
}

/**
 * Test Claude connection
 * GET /api/v1/claude/test
 */
export const testConnection = async (
  _req: Request<{}, TestConnectionResponse, TestConnectionRequest>,
  res: Response<TestConnectionResponse>
): Promise<void> => {
  try {
    logger.info('🧪 Claude connection test requested');

    const claudeService = getClaudeService();
    const result = await claudeService.testConnection();

    if (result.success) {
      res.status(200).json({
        success: true,
        data: {
          message: result.message,
          model: result.model,
          ...(result.response && { response: result.response }),
          timestamp: new Date().toISOString()
        }
      });
      logger.info('✅ Claude connection test successful');
    } else {
      res.status(500).json({
        success: false,
        error: result.message
      });
      logger.error('❌ Claude connection test failed');
    }

  } catch (error) {
    logger.error('❌ Claude connection test error:', error);
    res.status(500).json({
      success: false,
      error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
};

/**
 * Send a message to Claude (requires authentication)
 * POST /api/v1/claude/chat
 */
export const chat = async (
  req: Request<{}, ChatResponse, ChatRequest>,
  res: Response<ChatResponse>
): Promise<void> => {
  try {
    const { message, userTier = 'free', context } = req.body;

    // Validate request
    if (!message || typeof message !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Message is required and must be a string'
      });
      return;
    }

    if (message.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Message cannot be empty'
      });
      return;
    }

    if (userTier && !['free', 'premium'].includes(userTier)) {
      res.status(400).json({
        success: false,
        error: 'User tier must be either "free" or "premium"'
      });
      return;
    }

    // Get user from request (set by auth middleware)
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    // Get IP address and user agent
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];

    logger.info(`🤖 Claude chat request - User: ${userId}, Tier: ${userTier}, Message length: ${message.length}`);

    const claudeService = getClaudeService();
    const result = await claudeService.chat(
      message, 
      userTier, 
      context, 
      userId,
      undefined, // sessionId
      ipAddress,
      userAgent
    );

    res.status(200).json({
      success: true,
      data: {
        response: result.response,
        model: result.model,
        tokens: result.tokens,
        cost: result.cost,
        isFinancialQuery: result.isFinancialQuery,
        queryCategory: result.queryCategory || undefined,
        disclaimerShown: result.disclaimerShown,
        disclaimerText: result.disclaimerText,
        responseTime: result.responseTime,
        timestamp: new Date().toISOString()
      }
    });

    logger.info(`✅ Claude chat response sent - User: ${userId}, Tokens: ${result.tokens}, Cost: $${result.cost.toFixed(4)}, Financial: ${result.isFinancialQuery}`);

  } catch (error) {
    logger.error('❌ Claude chat error:', error);
    res.status(500).json({
      success: false,
      error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
};

/**
 * Get AI interaction statistics
 * GET /api/v1/claude/stats
 */
export const getStats = async (
  req: Request,
  res: Response<StatsResponse>
): Promise<void> => {
  try {
    // Get user from request (set by auth middleware)
    const userId = (req as any).user?.id;

    logger.info(`📊 AI stats requested - User: ${userId || 'all'}`);

    const claudeService = getClaudeService();
    const stats = await claudeService.getInteractionStats(userId);

    res.status(200).json({
      success: true,
      data: {
        totalInteractions: stats.totalInteractions,
        financialInteractions: stats.financialInteractions,
        averageResponseTime: stats.averageResponseTime,
        mostCommonCategories: stats.mostCommonCategories.map((cat: any) => ({
          category: cat.category,
          count: cat.count
        })),
        userSatisfaction: {
          averageRating: stats.userSatisfaction.averageRating,
          totalRatings: stats.userSatisfaction.totalRatings
        },
        timestamp: new Date().toISOString()
      }
    });

    logger.info(`📊 AI stats sent - Total interactions: ${stats.totalInteractions}`);

  } catch (error) {
    logger.error('❌ AI stats error:', error);
    res.status(500).json({
      success: false,
      error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
};

/**
 * Get user interaction history
 * GET /api/v1/claude/history
 */
export const getHistory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Get user from request (set by auth middleware)
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    // Optional query parameters
    const limit = req.query['limit'] ? parseInt(req.query['limit'] as string) : 50;
    const offset = req.query['offset'] ? parseInt(req.query['offset'] as string) : 0;

    logger.info(`📋 AI history requested - User: ${userId}, Limit: ${limit}, Offset: ${offset}`);

    const claudeService = getClaudeService();
    const history = await claudeService.getUserInteractionHistory(userId, limit, offset);

    res.status(200).json({
      success: true,
      data: {
        interactions: history,
        total: history.length,
        limit,
        offset,
        timestamp: new Date().toISOString()
      }
    });

    logger.info(`📋 AI history sent - User: ${userId}, Interactions: ${history.length}`);

  } catch (error) {
    logger.error('❌ AI history error:', error);
    res.status(500).json({
      success: false,
      error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
};

/**
 * Rate an interaction
 * POST /api/v1/claude/rate
 */
export const rateInteraction = async (
  req: Request<{}, any, RateInteractionRequest>,
  res: Response
): Promise<void> => {
  try {
    const { interactionId, rating, feedback } = req.body;

    // Validate request
    if (!interactionId || !rating) {
      res.status(400).json({
        success: false,
        error: 'Interaction ID and rating are required'
      });
      return;
    }

    if (rating < 1 || rating > 5) {
      res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
      return;
    }

    // Get user from request (set by auth middleware)
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    logger.info(`⭐ Rating interaction - User: ${userId}, Interaction: ${interactionId}, Rating: ${rating}`);

    // Import the logging service to update rating
    const { AILoggingService } = await import('../services/aiLoggingService');
    const updatedInteraction = await AILoggingService.updateInteractionRating(
      interactionId,
      rating,
      feedback
    );

    res.status(200).json({
      success: true,
      data: {
        interactionId: updatedInteraction.id,
        rating: updatedInteraction.userRating,
        feedback: updatedInteraction.userFeedback,
        timestamp: new Date().toISOString()
      }
    });

    logger.info(`⭐ Interaction rated - User: ${userId}, Rating: ${rating}`);

  } catch (error) {
    logger.error('❌ Rate interaction error:', error);
    res.status(500).json({
      success: false,
      error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
};

/**
 * Get Claude service status
 * GET /api/v1/claude/status
 */
export const getStatus = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    logger.info('📊 Claude status requested');

    const claudeService = getClaudeService();
    
    // Test the connection
    const testResult = await claudeService.testConnection();

    res.status(200).json({
      success: true,
      data: {
        service: 'Claude AI',
        status: testResult.success ? 'connected' : 'disconnected',
        message: testResult.message,
        model: testResult.model,
        timestamp: new Date().toISOString(),
        environment: process.env['NODE_ENV'] || 'development'
      }
    });

    logger.info(`📊 Claude status: ${testResult.success ? 'connected' : 'disconnected'}`);

  } catch (error) {
    logger.error('❌ Claude status error:', error);
    res.status(500).json({
      success: false,
      error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
};

/**
 * Get full disclaimer for first-time users
 * GET /api/v1/claude/disclaimer
 */
export const getFullDisclaimer = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const language = (req.query['language'] as 'SPANISH' | 'ENGLISH' | 'FRENCH') || 'SPANISH';
    
    logger.info(`📋 Full disclaimer requested - Language: ${language}`);

    const { DisclaimerService } = await import('../services/disclaimerService');
    const disclaimer = DisclaimerService.getDisclaimer(language, 'v1_0', 'full');

    res.status(200).json({
      success: true,
      data: {
        disclaimer,
        language,
        version: 'v1_0',
        timestamp: new Date().toISOString()
      }
    });

    logger.info(`📋 Full disclaimer sent - Language: ${language}`);

  } catch (error) {
    logger.error('❌ Get disclaimer error:', error);
    res.status(500).json({
      success: false,
      error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
};

/**
 * Get Claude configuration
 * GET /api/v1/claude/config
 */
export const getConfig = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    logger.info('⚙️ Claude configuration requested');

    // Only return non-sensitive configuration
    const config = {
      freeModel: process.env['CLAUDE_FREE_MODEL'] || 'claude-3-haiku-20240307',
      premiumModel: process.env['CLAUDE_PREMIUM_MODEL'] || 'claude-3-5-sonnet-20241022',
      maxTokensFree: parseInt(process.env['AI_MAX_TOKENS_FREE'] || '200'),
      maxTokensPremium: parseInt(process.env['AI_MAX_TOKENS_PREMIUM'] || '2000'),
      temperature: parseFloat(process.env['AI_TEMPERATURE'] || '0.7'),
      hasApiKey: !!process.env['CLAUDE_API_KEY'],
      disclaimerVersion: 'v1.0',
      loggingEnabled: true,
      timestamp: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      data: config
    });

    logger.info('⚙️ Claude configuration sent');

  } catch (error) {
    logger.error('❌ Claude config error:', error);
    res.status(500).json({
      success: false,
      error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}; 