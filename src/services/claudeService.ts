import Anthropic from '@anthropic-ai/sdk';
import logger from '../utils/logger';
import { DisclaimerService, FinancialQueryFilter } from './disclaimerService';
import { AILoggingService } from './aiLoggingService';

// Claude service configuration
interface ClaudeConfig {
  apiKey: string;
  freeModel: string;
  premiumModel: string;
  maxTokensFree: number;
  maxTokensPremium: number;
  temperature: number;
}

// User tier types
type UserTier = 'free' | 'premium';

// Enhanced chat response interface
export interface ChatResponse {
  response: string;
  model: string;
  tokens: number;
  cost: number;
  isFinancialQuery: boolean;
  queryCategory?: string;
  disclaimerShown: boolean;
  disclaimerText?: string;
  responseTime: number;
  suggestions?: string[];
  redirectTo?: string;
}

// Claude service class
class ClaudeService {
  private client: Anthropic;
  private config: ClaudeConfig;

  constructor(config: ClaudeConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
  }

  /**
   * Send a message to Claude and get a response with disclaimers and logging
   */
  async chat(
    message: string,
    userTier: UserTier = 'free',
    context?: string,
    userId?: string,
    sessionId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      // 1. Validate query
      const validation = DisclaimerService.validateQuery(message, 'SPANISH');
      if (!validation.isValid) {
        // Return funny response instead of throwing error
        const funnyResponse = validation.funnyResponse;
        const responseText = funnyResponse ? 
          `${funnyResponse.emoji} ${funnyResponse.message}` : 
          "🤖 ¡Ups! Algo salió mal. ¿Puedes reformular tu pregunta?";
        
        // Log the interaction even if it's invalid
        if (userId) {
          try {
            await AILoggingService.logInteraction({
              userId,
              sessionId,
              userMessage: message,
              aiResponse: responseText,
              model: 'validation_error',
              responseTime: Date.now() - startTime,
              ipAddress,
              userAgent,
              metadata: { 
                validationError: true,
                reason: validation.reason,
                funnyResponseType: funnyResponse?.redirectTo
              }
            });
          } catch (logError) {
            logger.error('❌ Error logging validation interaction:', logError);
          }
        }

        return {
          response: responseText,
          model: 'validation_error',
          tokens: 0,
          cost: 0,
          isFinancialQuery: false,
          disclaimerShown: false,
          responseTime: Date.now() - startTime,
          suggestions: funnyResponse?.suggestions,
          redirectTo: funnyResponse?.redirectTo
        };
      }

      // 2. Detect if it's a financial query
      const financialFilter = DisclaimerService.detectFinancialQuery(message);
      
      // 3. Get appropriate model and tokens
      const model = userTier === 'premium' 
        ? this.config.premiumModel 
        : this.config.freeModel;
      
      const maxTokens = userTier === 'premium' 
        ? this.config.maxTokensPremium 
        : this.config.maxTokensFree;

      // 4. Create system prompt with financial focus
      const systemPrompt = this.createSystemPrompt(userTier, context, financialFilter);

      logger.info(`🤖 Claude chat request - Model: ${model}, Tier: ${userTier}, Financial: ${financialFilter.isFinancial}`);

      // 5. Get Claude response
      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: message
          }
        ]
      });

      const tokens = response.usage?.input_tokens + response.usage?.output_tokens || 0;
      const cost = this.calculateCost(tokens, model);
      const responseTime = Date.now() - startTime;

      // 6. Extract text content from response
      const content = response.content[0];
      let responseText = 'No response received';
      
      if (content && 'text' in content) {
        responseText = content.text;
      }

      // 7. Add disclaimer if needed
      let finalResponse = responseText;
      let disclaimerShown = false;
      let disclaimerText: string | undefined;

      if (financialFilter.isFinancial) {
        const disclaimer = DisclaimerService.getDisclaimer('SPANISH', 'v1_0', 'chatgpt_style');
        finalResponse = DisclaimerService.formatResponseWithDisclaimer(responseText, disclaimer);
        disclaimerShown = true;
        disclaimerText = disclaimer;
      }

      // 8. Log the interaction if userId is provided
      if (userId) {
        try {
          await AILoggingService.logInteraction({
            userId,
            sessionId,
            userMessage: message,
            aiResponse: finalResponse,
            model,
            tokensUsed: tokens,
            responseTime,
            ipAddress,
            userAgent,
            metadata: {
              financialFilter,
              userTier,
              cost,
              originalResponse: responseText,
              disclaimerShown
            }
          });
        } catch (logError) {
          logger.error('❌ Error logging AI interaction:', logError);
          // Don't fail the request if logging fails
        }
      }

      logger.info(`✅ Claude response received - Tokens: ${tokens}, Cost: $${cost.toFixed(4)}, Time: ${responseTime}ms`);

      return {
        response: finalResponse,
        model,
        tokens,
        cost,
        isFinancialQuery: financialFilter.isFinancial,
        queryCategory: financialFilter.category || undefined,
        disclaimerShown,
        disclaimerText,
        responseTime
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('❌ Claude API error:', error);
      
      // Log failed interaction
      if (userId) {
        try {
          await AILoggingService.logInteraction({
            userId,
            sessionId: sessionId || undefined,
            userMessage: message,
            aiResponse: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            model: 'error',
            responseTime,
            ipAddress,
            userAgent,
            metadata: { error: true }
          });
        } catch (logError) {
          logger.error('❌ Error logging failed AI interaction:', logError);
        }
      }
      
      throw new Error(`Claude API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create system prompt for financial advisor role with enhanced focus
   */
  private createSystemPrompt(userTier: UserTier, context?: string, financialFilter?: FinancialQueryFilter): string {
    const basePrompt = `You are Squirli, an AI-powered financial assistant focused on providing educational financial guidance.

Your role is to help users understand and improve their financial situation through:
- Educational explanations of financial concepts
- Personalized budgeting advice
- Investment guidance and risk assessment
- Debt management strategies
- Financial goal planning
- Security and fraud prevention tips

Always maintain a friendly, encouraging tone while being educational and responsible.`;

    return basePrompt;
  }

  /**
   * Calculate estimated cost based on tokens and model
   */
  private calculateCost(tokens: number, model: string): number {
    // Approximate costs per 1K tokens (these are estimates)
    const costs = {
      'claude-3-haiku-20240307': 0.00025, // $0.25 per 1M tokens
      'claude-3-5-sonnet-20241022': 0.003, // $3 per 1M tokens
    };

    const costPerToken = costs[model as keyof typeof costs] || 0.001;
    return (tokens / 1000) * costPerToken;
  }

  /**
   * Test Claude connection
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    model: string;
    response?: string;
  }> {
    try {
      logger.info('🧪 Testing Claude connection...');
      
      const result = await this.chat(
        'Hello! Can you give me a simple financial tip?',
        'free'
      );

      return {
        success: true,
        message: 'Claude connection successful!',
        model: result.model,
        response: result.response
      };

    } catch (error) {
      logger.error('❌ Claude connection test failed:', error);
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        model: 'none'
      };
    }
  }

  /**
   * Get AI interaction statistics
   */
  async getInteractionStats(userId?: string): Promise<any> {
    try {
      return await AILoggingService.getInteractionStats(userId);
    } catch (error) {
      logger.error('❌ Error getting AI interaction stats:', error);
      throw error;
    }
  }

  /**
   * Get user interaction history
   */
  async getUserInteractionHistory(userId: string, limit: number = 50, offset: number = 0): Promise<any> {
    try {
      return await AILoggingService.getUserInteractionHistory(userId, limit, offset);
    } catch (error) {
      logger.error('❌ Error getting user interaction history:', error);
      throw error;
    }
  }
}

// Create and export Claude service instance
let claudeService: ClaudeService | null = null;

export const initializeClaudeService = (): ClaudeService => {
  const apiKey = process.env['CLAUDE_API_KEY'];
  const freeModel = process.env['CLAUDE_FREE_MODEL'] || 'claude-3-haiku-20240307';
  const premiumModel = process.env['CLAUDE_PREMIUM_MODEL'] || 'claude-3-5-sonnet-20241022';
  const maxTokensFree = parseInt(process.env['AI_MAX_TOKENS_FREE'] || '200');
  const maxTokensPremium = parseInt(process.env['AI_MAX_TOKENS_PREMIUM'] || '2000');
  const temperature = parseFloat(process.env['AI_TEMPERATURE'] || '0.7');

  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY is required in environment variables');
  }

  claudeService = new ClaudeService({
    apiKey,
    freeModel,
    premiumModel,
    maxTokensFree,
    maxTokensPremium,
    temperature
  });

  logger.info('🤖 Claude service initialized with disclaimer and logging support');
  return claudeService;
};

export const getClaudeService = (): ClaudeService => {
  if (!claudeService) {
    throw new Error('Claude service not initialized. Call initializeClaudeService() first.');
  }
  return claudeService;
};

export default ClaudeService; 