import { Router } from 'express';

const router = Router();

// API Info endpoint
router.get('/', (_req, res) => {
  res.json({
    name: 'Squirli API',
    version: '1.0.0',
    description: '🐿️ Squirli Backend API - AI-powered financial management platform',
    environment: process.env['NODE_ENV'] || 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      receipts: '/api/v1/receipts',
      marketplace: '/api/v1/marketplace'
    },
    documentation: {
      swagger: '/api-docs',
      postman: 'Coming soon'
    },
    support: {
      email: 'hello@squirli.com',
      docs: 'https://docs.squirli.com'
    }
  });
});

// API Status endpoint
router.get('/status', (_req, res) => {
  res.json({
    status: 'operational',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: process.memoryUsage().heapUsed,
      total: process.memoryUsage().heapTotal
    },
    version: '1.0.0'
  });
});

// API Features endpoint
router.get('/features', (_req, res) => {
  res.json({
    features: [
      {
        name: 'Receipt OCR',
        description: 'Local receipt processing with Tesseract.js',
        status: 'development'
      },
      {
        name: 'Financial Test',
        description: '8-question financial level assessment',
        status: 'development'
      },
      {
        name: 'Marketplace',
        description: 'Open marketplace for financial services',
        status: 'development'
      },
      {
        name: 'AI Recommendations',
        description: 'Personalized financial advice with disclaimers',
        status: 'planned'
      },
      {
        name: 'Multi-currency',
        description: 'Support for DOP, USD, EUR, MXN, COP',
        status: 'development'
      }
    ],
    subscription_plans: ['FREE', 'PERSONAL', 'ADVANCED', 'FAMILY', 'BUSINESS'],
    supported_countries: ['Dominican Republic', 'Mexico', 'Colombia', 'United States'],
    languages: ['Spanish', 'English'],
    payment_gateways: ['Stripe', 'Azul', 'CardNet']
  });
});

export default router; 