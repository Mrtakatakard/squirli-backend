/**
 * Servicio para manejar respuestas graciosas y divertidas
 * en lugar de mostrar errores feos al usuario
 */

export interface FunnyResponse {
  message: string;
  emoji: string;
  suggestions?: string[];
  redirectTo?: string;
}

export interface ValidationResponse {
  isValid: boolean;
  reason?: string;
  funnyResponse?: FunnyResponse;
}

export class FunnyResponsesService {
  
  private static readonly RESPONSES = {
    SPANISH: {
      // Hackear bancos - Respuesta especial
      hack_bank: {
        message: "¡Vaya! Eso suena como una película de hackers. En lugar de hackear bancos, ¿qué tal si aprendemos a 'hackear' tu salud financiera?",
        emoji: "🏦",
        suggestions: [
          "¿Cómo proteger tu cuenta bancaria de hackers reales?",
          "¿Cómo detectar fraudes bancarios?",
          "¿Cómo crear contraseñas seguras para tus finanzas?",
          "¿Cómo usar la banca en línea de forma segura?",
          "¿Cómo configurar alertas de seguridad?"
        ],
        redirectTo: "security"
      },
      
      // Hackear en general
      hack: {
        message: "¡Ups! Parece que quieres hackear algo. Yo solo sé hackear malos hábitos financieros. ¿Te ayudo con eso en su lugar?",
        emoji: "🤖",
        suggestions: [
          "¿Cómo hackear tu presupuesto para ahorrar más?",
          "¿Cómo hackear tu mente para gastar menos?",
          "¿Cómo hackear tu cuenta de ahorros?",
          "¿Cómo hackear tu plan de inversión?"
        ],
        redirectTo: "budgeting"
      },
      
      // Robar
      steal: {
        message: "¡Vaya! Eso suena como una película de acción. Yo prefiero ayudarte a 'robar' buenas oportunidades de inversión. ¿Qué tal?",
        emoji: "🦹‍♂️",
        suggestions: [
          "¿Cómo 'robar' mejores tasas de interés?",
          "¿Cómo 'robar' descuentos en tus compras?",
          "¿Cómo 'robar' tiempo para planificar tus finanzas?",
          "¿Cómo 'robar' ideas de inversión exitosas?"
        ],
        redirectTo: "investing"
      },
      
      // Fraude
      fraud: {
        message: "¡Oh no! Eso suena como un guión de telenovela. Yo solo manejo el drama de los presupuestos. ¿Hablemos de finanzas legales?",
        emoji: "🎭",
        suggestions: [
          "¿Cómo detectar fraudes financieros?",
          "¿Cómo protegerte de estafas?",
          "¿Cómo verificar inversiones legítimas?",
          "¿Cómo reportar actividades sospechosas?"
        ],
        redirectTo: "fraud_prevention"
      },
      
      // Ilegal
      illegal: {
        message: "¡Alto ahí! Eso suena muy sospechoso. Yo solo doy consejos legales y financieros. ¿Te ayudo con algo que no me meta en problemas?",
        emoji: "🚔",
        suggestions: [
          "¿Cómo invertir legalmente?",
          "¿Cómo ahorrar de forma legal?",
          "¿Cómo planificar tu jubilación?",
          "¿Cómo optimizar tus impuestos legalmente?"
        ],
        redirectTo: "legal_finance"
      },
      
      // Drogas
      drugs: {
        message: "¡Ups! Eso no es mi especialidad. Yo solo manejo 'drogas' financieras como el interés compuesto. ¿Te interesa?",
        emoji: "💊",
        suggestions: [
          "¿Cómo el interés compuesto puede multiplicar tu dinero?",
          "¿Cómo 'adictarte' al ahorro?",
          "¿Cómo 'depender' de buenos hábitos financieros?",
          "¿Cómo 'rehabilitarte' de malos gastos?"
        ],
        redirectTo: "compound_interest"
      },
      
      // Violencia
      violence: {
        message: "¡Wow! Eso suena intenso. Yo solo manejo la 'violencia' contra malos hábitos de gasto. ¿Hablemos de eso?",
        emoji: "🥊",
        suggestions: [
          "¿Cómo 'combatir' gastos innecesarios?",
          "¿Cómo 'derrotar' la deuda?",
          "¿Cómo 'luchar' contra la inflación?",
          "¿Cómo 'vencer' malos hábitos financieros?"
        ],
        redirectTo: "debt_management"
      },
      
      // Contenido inapropiado
      inappropriate: {
        message: "¡Oh! Eso no es apropiado. Yo solo manejo contenido financiero 'hot' como las tasas de interés. ¿Te interesa?",
        emoji: "🔞",
        suggestions: [
          "¿Cómo las tasas de interés afectan tus inversiones?",
          "¿Cómo hacer que tu dinero 'trabaje' para ti?",
          "¿Cómo 'calentar' tu cuenta de ahorros?",
          "¿Cómo hacer 'magia' con tu presupuesto?"
        ],
        redirectTo: "interest_rates"
      },
      
      // Mensaje muy corto
      too_short: {
        message: "¡Eso es muy corto! Necesito más información para darte una respuesta útil. ¿Puedes expandir un poco tu pregunta?",
        emoji: "🤏",
        suggestions: [
          "¿Qué quieres saber sobre finanzas?",
          "¿Tienes alguna pregunta específica?",
          "¿En qué área necesitas ayuda?",
          "¿Puedes dar más detalles?"
        ],
        redirectTo: "help"
      },
      
      // Mensaje muy largo
      too_long: {
        message: "¡Wow! Eso es como una novela. ¿Puedes resumir tu pregunta en menos de 1000 caracteres? Mi memoria es limitada 😅",
        emoji: "📚",
        suggestions: [
          "¿Puedes hacer tu pregunta más específica?",
          "¿Cuál es el punto principal de tu consulta?",
          "¿Puedes dividir tu pregunta en partes más pequeñas?",
          "¿Hay algo específico que quieras saber?"
        ],
        redirectTo: "help"
      }
    },
    
    ENGLISH: {
      hack_bank: {
        message: "Wow! That sounds like a hacker movie. Instead of hacking banks, how about we learn to 'hack' your financial health?",
        emoji: "🏦",
        suggestions: [
          "How to protect your bank account from real hackers?",
          "How to detect banking fraud?",
          "How to create secure passwords for your finances?",
          "How to use online banking safely?",
          "How to set up security alerts?"
        ],
        redirectTo: "security"
      },
      
      hack: {
        message: "Oops! Looks like you want to hack something. I only know how to hack bad financial habits. Want help with that instead?",
        emoji: "🤖",
        suggestions: [
          "How to hack your budget to save more?",
          "How to hack your mind to spend less?",
          "How to hack your savings account?",
          "How to hack your investment plan?"
        ],
        redirectTo: "budgeting"
      },
      
      steal: {
        message: "Wow! That sounds like an action movie. I prefer helping you 'steal' good investment opportunities. How about that?",
        emoji: "🦹‍♂️",
        suggestions: [
          "How to 'steal' better interest rates?",
          "How to 'steal' discounts on your purchases?",
          "How to 'steal' time to plan your finances?",
          "How to 'steal' successful investment ideas?"
        ],
        redirectTo: "investing"
      },
      
      fraud: {
        message: "Oh no! That sounds like a soap opera script. I only handle budget drama. Let's talk about legal finances?",
        emoji: "🎭",
        suggestions: [
          "How to detect financial fraud?",
          "How to protect yourself from scams?",
          "How to verify legitimate investments?",
          "How to report suspicious activities?"
        ],
        redirectTo: "fraud_prevention"
      },
      
      illegal: {
        message: "Hold up! That sounds very suspicious. I only give legal and financial advice. Want help with something that won't get me in trouble?",
        emoji: "🚔",
        suggestions: [
          "How to invest legally?",
          "How to save money legally?",
          "How to plan your retirement?",
          "How to optimize your taxes legally?"
        ],
        redirectTo: "legal_finance"
      },
      
      drugs: {
        message: "Oops! That's not my specialty. I only handle financial 'drugs' like compound interest. Interested?",
        emoji: "💊",
        suggestions: [
          "How compound interest can multiply your money?",
          "How to get 'addicted' to saving?",
          "How to 'depend' on good financial habits?",
          "How to 'rehabilitate' from bad spending?"
        ],
        redirectTo: "compound_interest"
      },
      
      violence: {
        message: "Wow! That sounds intense. I only handle 'violence' against bad spending habits. Want to talk about that?",
        emoji: "🥊",
        suggestions: [
          "How to 'combat' unnecessary expenses?",
          "How to 'defeat' debt?",
          "How to 'fight' inflation?",
          "How to 'overcome' bad financial habits?"
        ],
        redirectTo: "debt_management"
      },
      
      inappropriate: {
        message: "Oh! That's not appropriate. I only handle 'hot' financial content like interest rates. Interested?",
        emoji: "🔞",
        suggestions: [
          "How interest rates affect your investments?",
          "How to make your money 'work' for you?",
          "How to 'heat up' your savings account?",
          "How to do 'magic' with your budget?"
        ],
        redirectTo: "interest_rates"
      },
      
      too_short: {
        message: "That's too short! I need more information to give you a useful response. Can you expand your question a bit?",
        emoji: "🤏",
        suggestions: [
          "What do you want to know about finances?",
          "Do you have a specific question?",
          "What area do you need help with?",
          "Can you provide more details?"
        ],
        redirectTo: "help"
      },
      
      too_long: {
        message: "Wow! That's like a novel. Can you summarize your question in less than 1000 characters? My memory is limited 😅",
        emoji: "📚",
        suggestions: [
          "Can you make your question more specific?",
          "What's the main point of your inquiry?",
          "Can you break your question into smaller parts?",
          "Is there something specific you want to know?"
        ],
        redirectTo: "help"
      }
    },
    
    FRENCH: {
      hack_bank: {
        message: "Wow ! Cela ressemble à un film de hackers. Au lieu de pirater les banques, que diriez-vous d'apprendre à 'pirater' votre santé financière ?",
        emoji: "🏦",
        suggestions: [
          "Comment protéger votre compte bancaire des vrais pirates ?",
          "Comment détecter les fraudes bancaires ?",
          "Comment créer des mots de passe sécurisés pour vos finances ?",
          "Comment utiliser la banque en ligne en toute sécurité ?",
          "Comment configurer les alertes de sécurité ?"
        ],
        redirectTo: "security"
      },
      
      hack: {
        message: "Oups ! Il semble que vous vouliez pirater quelque chose. Je ne sais que pirater les mauvaises habitudes financières. Voulez-vous de l'aide avec ça à la place ?",
        emoji: "🤖",
        suggestions: [
          "Comment pirater votre budget pour économiser plus ?",
          "Comment pirater votre esprit pour dépenser moins ?",
          "Comment pirater votre compte d'épargne ?",
          "Comment pirater votre plan d'investissement ?"
        ],
        redirectTo: "budgeting"
      },
      
      steal: {
        message: "Wow ! Cela ressemble à un film d'action. Je préfère vous aider à 'voler' de bonnes opportunités d'investissement. Qu'en pensez-vous ?",
        emoji: "🦹‍♂️",
        suggestions: [
          "Comment 'voler' de meilleurs taux d'intérêt ?",
          "Comment 'voler' des réductions sur vos achats ?",
          "Comment 'voler' du temps pour planifier vos finances ?",
          "Comment 'voler' des idées d'investissement réussies ?"
        ],
        redirectTo: "investing"
      },
      
      fraud: {
        message: "Oh non ! Cela ressemble à un scénario de soap opera. Je ne gère que le drame du budget. Parlons de finances légales ?",
        emoji: "🎭",
        suggestions: [
          "Comment détecter les fraudes financières ?",
          "Comment vous protéger des arnaques ?",
          "Comment vérifier les investissements légitimes ?",
          "Comment signaler les activités suspectes ?"
        ],
        redirectTo: "fraud_prevention"
      },
      
      illegal: {
        message: "Attendez ! Cela semble très suspect. Je ne donne que des conseils légaux et financiers. Voulez-vous de l'aide avec quelque chose qui ne me mettra pas dans le pétrin ?",
        emoji: "🚔",
        suggestions: [
          "Comment investir légalement ?",
          "Comment économiser de l'argent légalement ?",
          "Comment planifier votre retraite ?",
          "Comment optimiser vos impôts légalement ?"
        ],
        redirectTo: "legal_finance"
      },
      
      drugs: {
        message: "Oups ! Ce n'est pas ma spécialité. Je ne gère que les 'drogues' financières comme l'intérêt composé. Intéressé ?",
        emoji: "💊",
        suggestions: [
          "Comment l'intérêt composé peut multiplier votre argent ?",
          "Comment 's'addict' à l'épargne ?",
          "Comment 'dépendre' de bonnes habitudes financières ?",
          "Comment 'se réhabiliter' des mauvaises dépenses ?"
        ],
        redirectTo: "compound_interest"
      },
      
      violence: {
        message: "Wow ! Cela semble intense. Je ne gère que la 'violence' contre les mauvaises habitudes de dépenses. Voulez-vous en parler ?",
        emoji: "🥊",
        suggestions: [
          "Comment 'combattre' les dépenses inutiles ?",
          "Comment 'vaincre' la dette ?",
          "Comment 'lutter' contre l'inflation ?",
          "Comment 'surmonter' les mauvaises habitudes financières ?"
        ],
        redirectTo: "debt_management"
      },
      
      inappropriate: {
        message: "Oh ! Ce n'est pas approprié. Je ne gère que le contenu financier 'chaud' comme les taux d'intérêt. Intéressé ?",
        emoji: "🔞",
        suggestions: [
          "Comment les taux d'intérêt affectent vos investissements ?",
          "Comment faire 'travailler' votre argent pour vous ?",
          "Comment 'réchauffer' votre compte d'épargne ?",
          "Comment faire de la 'magie' avec votre budget ?"
        ],
        redirectTo: "interest_rates"
      },
      
      too_short: {
        message: "C'est trop court ! J'ai besoin de plus d'informations pour vous donner une réponse utile. Pouvez-vous développer un peu votre question ?",
        emoji: "🤏",
        suggestions: [
          "Que voulez-vous savoir sur les finances ?",
          "Avez-vous une question spécifique ?",
          "Dans quel domaine avez-vous besoin d'aide ?",
          "Pouvez-vous fournir plus de détails ?"
        ],
        redirectTo: "help"
      },
      
      too_long: {
        message: "Wow ! C'est comme un roman. Pouvez-vous résumer votre question en moins de 1000 caractères ? Ma mémoire est limitée 😅",
        emoji: "📚",
        suggestions: [
          "Pouvez-vous rendre votre question plus spécifique ?",
          "Quel est le point principal de votre demande ?",
          "Pouvez-vous diviser votre question en parties plus petites ?",
          "Y a-t-il quelque chose de spécifique que vous voulez savoir ?"
        ],
        redirectTo: "help"
      }
    }
  };

  /**
   * Obtiene una respuesta graciosa basada en el tipo de validación
   */
  static getFunnyResponse(
    type: string,
    language: 'SPANISH' | 'ENGLISH' | 'FRENCH' = 'SPANISH'
  ): FunnyResponse {
    const responses = this.RESPONSES[language];
    const response = responses[type as keyof typeof responses];
    
    if (!response) {
      // Fallback a respuesta genérica
      return {
        message: language === 'SPANISH' ? "¡Ups! Algo salió mal. ¿Puedes reformular tu pregunta?" :
                language === 'ENGLISH' ? "Oops! Something went wrong. Can you rephrase your question?" :
                "Oups ! Quelque chose s'est mal passé. Pouvez-vous reformuler votre question ?",
        emoji: "🤖",
        suggestions: [],
        redirectTo: "help"
      };
    }
    
    return response;
  }

  /**
   * Formatea la respuesta graciosa para mostrar en la UI
   */
  static formatFunnyResponse(response: FunnyResponse): string {
    let formatted = `${response.emoji} ${response.message}`;
    
    if (response.suggestions && response.suggestions.length > 0) {
      formatted += '\n\n💡 **Sugerencias:**\n';
      response.suggestions.forEach(suggestion => {
        formatted += `• ${suggestion}\n`;
      });
    }
    
    return formatted;
  }

  /**
   * Obtiene todas las respuestas disponibles para un idioma
   */
  static getAllResponses(language: 'SPANISH' | 'ENGLISH' | 'FRENCH' = 'SPANISH'): Record<string, FunnyResponse> {
    return this.RESPONSES[language];
  }

  /**
   * Agrega una nueva respuesta personalizada
   */
  static addCustomResponse(
    type: string,
    response: FunnyResponse,
    language: 'SPANISH' | 'ENGLISH' | 'FRENCH' = 'SPANISH'
  ): void {
    if (!this.RESPONSES[language]) {
      // Inicializar con un objeto vacío del tipo correcto
      this.RESPONSES[language] = {} as typeof this.RESPONSES[typeof language];
    }
    
    // Usar type assertion para evitar problemas de tipos
    (this.RESPONSES[language] as any)[type] = response;
  }
} 