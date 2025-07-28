import { FinancialQueryCategory, AIInteractionType } from '@prisma/client';
import { FunnyResponsesService, FunnyResponse } from './funnyResponsesService';

export interface DisclaimerConfig {
  version: string;
  language: 'SPANISH' | 'ENGLISH' | 'FRENCH';
  showForFreeUsers: boolean;
  showForPremiumUsers: boolean;
}

export interface FinancialQueryFilter {
  isFinancial: boolean;
  category?: FinancialQueryCategory | undefined;
  type?: AIInteractionType | undefined;
  confidence: number; // 0-1
}

export interface ValidationResponse {
  isValid: boolean;
  reason?: string;
  funnyResponse?: FunnyResponse;
}

export class DisclaimerService {
  private static readonly FINANCIAL_KEYWORDS = {
    SPANISH: [
      'invertir', 'inversión', 'ahorrar', 'ahorro', 'presupuesto', 'gastos', 'ingresos',
      'deuda', 'crédito', 'préstamo', 'hipoteca', 'seguro', 'impuestos', 'jubilación',
      'bolsa', 'acciones', 'bonos', 'fondos', 'mutual', 'crypto', 'bitcoin', 'ethereum',
      'banco', 'cuenta', 'tarjeta', 'interés', 'rendimiento', 'riesgo', 'diversificación',
      'planificación', 'financiera', 'economía', 'dinero', 'capital', 'patrimonio',
      'activos', 'pasivos', 'liquidez', 'rentabilidad', 'inflación', 'deflación'
    ],
    ENGLISH: [
      'invest', 'investment', 'save', 'savings', 'budget', 'expenses', 'income',
      'debt', 'credit', 'loan', 'mortgage', 'insurance', 'taxes', 'retirement',
      'stock', 'shares', 'bonds', 'funds', 'mutual', 'crypto', 'bitcoin', 'ethereum',
      'bank', 'account', 'card', 'interest', 'return', 'risk', 'diversification',
      'planning', 'financial', 'economy', 'money', 'capital', 'wealth',
      'assets', 'liabilities', 'liquidity', 'profitability', 'inflation', 'deflation'
    ],
    FRENCH: [
      'investir', 'investissement', 'épargner', 'épargne', 'budget', 'dépenses', 'revenus',
      'dette', 'crédit', 'prêt', 'hypothèque', 'assurance', 'impôts', 'retraite',
      'bourse', 'actions', 'obligations', 'fonds', 'mutuel', 'crypto', 'bitcoin', 'ethereum',
      'banque', 'compte', 'carte', 'intérêt', 'rendement', 'risque', 'diversification',
      'planification', 'financière', 'économie', 'argent', 'capital', 'richesse',
      'actifs', 'passifs', 'liquidité', 'rentabilité', 'inflation', 'déflation'
    ]
  };

  private static readonly DISCLAIMERS = {
    SPANISH: {
      v1_0: {
        title: "⚠️ Información Importante",
        content: `Esta respuesta es proporcionada por inteligencia artificial y debe considerarse únicamente como información educativa y de referencia.

**Limitaciones importantes:**
• La IA puede cometer errores o proporcionar información incompleta
• Las condiciones financieras cambian constantemente
• Cada situación personal es única

**Recomendaciones:**
• Consulta siempre con un asesor financiero certificado
• Verifica la información con fuentes oficiales
• Considera tu situación personal antes de tomar decisiones

**Descargo de responsabilidad:**
Squirli no se hace responsable por decisiones financieras basadas en esta información. Para asesoramiento profesional, consulta con un especialista en finanzas.`,
        short: "⚠️ Esta es información educativa. Consulta con un asesor financiero para decisiones importantes.",
        chatgpt_style: "⚠️ La IA puede cometer errores. Consulta con un especialista financiero certificado antes de tomar decisiones importantes."
      }
    },
    ENGLISH: {
      v1_0: {
        title: "⚠️ Important Information",
        content: `This response is provided by artificial intelligence and should be considered solely as educational and reference information.

**Important limitations:**
• AI may make errors or provide incomplete information
• Financial conditions change constantly
• Each personal situation is unique

**Recommendations:**
• Always consult with a certified financial advisor
• Verify information with official sources
• Consider your personal situation before making decisions

**Disclaimer:**
Squirli is not responsible for financial decisions based on this information. For professional advice, consult with a financial specialist.`,
        short: "⚠️ This is educational information. Consult with a financial advisor for important decisions.",
        chatgpt_style: "⚠️ AI may make errors. Consult with a certified financial specialist before making important decisions."
      }
    },
    FRENCH: {
      v1_0: {
        title: "⚠️ Information Importante",
        content: `Cette réponse est fournie par l'intelligence artificielle et doit être considérée uniquement comme information éducative et de référence.

**Limitations importantes:**
• L'IA peut commettre des erreurs ou fournir des informations incomplètes
• Les conditions financières changent constamment
• Chaque situation personnelle est unique

**Recommandations:**
• Consultez toujours un conseiller financier certifié
• Vérifiez les informations avec des sources officielles
• Considérez votre situation personnelle avant de prendre des décisions

**Avertissement:**
Squirli n'est pas responsable des décisions financières basées sur ces informations. Pour des conseils professionnels, consultez un spécialiste en finances.`,
        short: "⚠️ Ceci est une information éducative. Consultez un conseiller financier pour des décisions importantes.",
        chatgpt_style: "⚠️ L'IA peut commettre des erreurs. Consultez un spécialiste financier certifié avant de prendre des décisions importantes."
      }
    }
  };

  /**
   * Detecta si una consulta es financiera
   */
  static detectFinancialQuery(message: string, language: 'SPANISH' | 'ENGLISH' | 'FRENCH' = 'SPANISH'): FinancialQueryFilter {
    const lowerMessage = message.toLowerCase();
    const keywords = this.FINANCIAL_KEYWORDS[language];
    
    let matchCount = 0;
    let matchedKeywords: string[] = [];
    
    // Contar coincidencias de palabras clave
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        matchCount++;
        matchedKeywords.push(keyword);
      }
    }
    
    // Calcular confianza basada en coincidencias
    const confidence = Math.min(matchCount / 3, 1); // Máximo 1.0
    const isFinancial = confidence >= 0.3; // Umbral de 30%
    
    // Determinar categoría
    let category: FinancialQueryCategory | undefined;
    let type: AIInteractionType | undefined;
    
    if (isFinancial) {
      if (matchedKeywords.some(k => ['invertir', 'inversión', 'acciones', 'bonos', 'fondos'].includes(k))) {
        category = 'INVESTING';
        type = 'INVESTMENT_ADVICE';
      } else if (matchedKeywords.some(k => ['ahorrar', 'ahorro', 'savings'].includes(k))) {
        category = 'SAVING';
        type = 'SAVINGS_STRATEGY';
      } else if (matchedKeywords.some(k => ['presupuesto', 'budget', 'gastos', 'expenses'].includes(k))) {
        category = 'BUDGETING';
        type = 'BUDGET_PLANNING';
      } else if (matchedKeywords.some(k => ['deuda', 'crédito', 'préstamo', 'debt', 'credit'].includes(k))) {
        category = 'DEBT';
        type = 'DEBT_MANAGEMENT';
      } else if (matchedKeywords.some(k => ['impuestos', 'taxes'].includes(k))) {
        category = 'TAXES';
        type = 'TAX_ADVICE';
      } else if (matchedKeywords.some(k => ['seguro', 'insurance'].includes(k))) {
        category = 'INSURANCE';
        type = 'INSURANCE_ADVICE';
      } else if (matchedKeywords.some(k => ['jubilación', 'retirement'].includes(k))) {
        category = 'RETIREMENT';
        type = 'RETIREMENT_PLANNING';
      } else {
        category = 'OTHER';
        type = 'FINANCIAL_ADVICE';
      }
    }
    
    return {
      isFinancial,
      category,
      type,
      confidence
    };
  }

  /**
   * Obtiene el disclaimer apropiado
   */
  static getDisclaimer(
    language: 'SPANISH' | 'ENGLISH' | 'FRENCH' = 'SPANISH',
    version: string = 'v1_0',
    type: 'full' | 'short' | 'chatgpt_style' = 'full'
  ): string {
    const disclaimer = this.DISCLAIMERS[language]?.[version as keyof typeof this.DISCLAIMERS[typeof language]];
    
    if (!disclaimer) {
      // Fallback al disclaimer en español
      return type === 'short' ? this.DISCLAIMERS.SPANISH.v1_0.short : 
             type === 'chatgpt_style' ? this.DISCLAIMERS.SPANISH.v1_0.chatgpt_style :
             this.DISCLAIMERS.SPANISH.v1_0.content;
    }
    
    return type === 'short' ? disclaimer.short : 
           type === 'chatgpt_style' ? disclaimer.chatgpt_style :
           disclaimer.content;
  }

  /**
   * Determina si debe mostrar el disclaimer
   */
  static shouldShowDisclaimer(
    userTier: 'free' | 'premium',
    isFinancialQuery: boolean,
    config: DisclaimerConfig
  ): boolean {
    if (!isFinancialQuery) return false;
    
    if (userTier === 'free' && config.showForFreeUsers) return true;
    if (userTier === 'premium' && config.showForPremiumUsers) return true;
    
    return false;
  }

  /**
   * Formatea la respuesta con el disclaimer
   */
  static formatResponseWithDisclaimer(
    aiResponse: string,
    disclaimer: string
  ): string {
    const separator = '\n\n---\n\n';
    return `${aiResponse}${separator}${disclaimer}`;
  }

  /**
   * Valida si la consulta es apropiada y devuelve respuesta graciosa si no lo es
   */
  static validateQuery(message: string, language: 'SPANISH' | 'ENGLISH' | 'FRENCH' = 'SPANISH'): ValidationResponse {
    const lowerMessage = message.toLowerCase();
    
    // Detectar específicamente "hackear banco" o "hack bank"
    const bankHackPatterns = [
      'hackear banco', 'hackear bancos', 'hackear cuenta bancaria',
      'hack bank', 'hack banks', 'hack bank account',
      'pirater banque', 'pirater banques', 'pirater compte bancaire'
    ];
    
    for (const pattern of bankHackPatterns) {
      if (lowerMessage.includes(pattern)) {
        const funnyResponse = FunnyResponsesService.getFunnyResponse('hack_bank', language);
        return {
          isValid: false,
          reason: `La consulta contiene palabras inapropiadas relacionadas con hackear bancos`,
          funnyResponse
        };
      }
    }
    
    // Palabras prohibidas o inapropiadas
    const forbiddenWords = [
      { word: 'hack', type: 'hack' },
      { word: 'crack', type: 'hack' },
      { word: 'robar', type: 'steal' },
      { word: 'steal', type: 'steal' },
      { word: 'fraude', type: 'fraud' },
      { word: 'fraud', type: 'fraud' },
      { word: 'ilegal', type: 'illegal' },
      { word: 'illegal', type: 'illegal' },
      { word: 'drogas', type: 'drugs' },
      { word: 'drugs', type: 'drugs' },
      { word: 'violencia', type: 'violence' },
      { word: 'violence', type: 'violence' },
      { word: 'pornografía', type: 'inappropriate' },
      { word: 'pornography', type: 'inappropriate' }
    ];
    
    for (const { word, type } of forbiddenWords) {
      if (lowerMessage.includes(word)) {
        const funnyResponse = FunnyResponsesService.getFunnyResponse(type, language);
        return {
          isValid: false,
          reason: `La consulta contiene palabras inapropiadas: ${word}`,
          funnyResponse
        };
      }
    }
    
    // Verificar longitud mínima
    if (message.trim().length < 3) {
      const funnyResponse = FunnyResponsesService.getFunnyResponse('too_short', language);
      return {
        isValid: false,
        reason: 'La consulta es demasiado corta',
        funnyResponse
      };
    }
    
    // Verificar longitud máxima
    if (message.length > 1000) {
      const funnyResponse = FunnyResponsesService.getFunnyResponse('too_long', language);
      return {
        isValid: false,
        reason: 'La consulta es demasiado larga (máximo 1000 caracteres)',
        funnyResponse
      };
    }
    
    return { isValid: true };
  }
} 