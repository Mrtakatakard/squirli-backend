import { Express } from 'express';
import logger from '../utils/logger';

// Import all route modules
import healthRoutes from './health';
import apiRoutes from './api';
import userRoutes from './users';
import authRoutes from './auth';
import claudeRoutes from './claude';
import receiptRoutes from './receipts';
import securityRoutes from './security';

// Route configuration interface
interface RouteConfig {
  path: string;
  router: any;
  description?: string;
}

// Routes mapping
const routes: RouteConfig[] = [
  {
    path: '/health',
    router: healthRoutes,
    description: 'Health check endpoints'
  },
  {
    path: '/api/v1',
    router: apiRoutes,
    description: 'API information endpoints'
  },
  {
    path: '/api/v1/users',
    router: userRoutes,
    description: 'User management endpoints'
  },
  {
    path: '/api/v1/auth',
    router: authRoutes,
    description: 'Authentication endpoints'
  },
  {
    path: '/api/v1/claude',
    router: claudeRoutes,
    description: 'Claude AI endpoints'
  },
  {
    path: '/api/v1/receipts',
    router: receiptRoutes,
    description: 'Receipt processing endpoints'
  },
  {
    path: '/api/v1/security',
    router: securityRoutes,
    description: 'Security and 2FA endpoints'
  }
  // Add new routes here as you create them
  // {
  //   path: '/api/v1/marketplace',
  //   router: marketplaceRoutes,
  //   description: 'Marketplace endpoints'
  // }
];

// Function to register all routes
export const registerRoutes = (app: Express, verbose: boolean = false): void => {
  if (verbose) {
    logger.info('🔗 Registering routes...');
  }
  
  routes.forEach(({ path, router, description }) => {
    app.use(path, router);
    if (verbose) {
      logger.info(`   ✅ ${path} - ${description}`);
    }
  });
  
  logger.info(`🚀 ${routes.length} routes registered`);
};

// Export routes configuration for documentation
export const getRoutesInfo = () => {
  return routes.map(({ path, description }) => ({
    path,
    description,
    endpoints: `Available at: ${path}`
  }));
};

// Export individual routes if needed
export {
  healthRoutes,
  apiRoutes,
  userRoutes,
  authRoutes,
  claudeRoutes,
  receiptRoutes,
  securityRoutes
}; 