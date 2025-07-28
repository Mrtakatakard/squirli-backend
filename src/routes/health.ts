import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import logger from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();
const redis = createClient({
  url: process.env['REDIS_URL'] || 'redis://localhost:6379'
});

// Initialize Redis connection
redis.connect().catch((error) => logger.error('Redis connection error:', error));

// Health check endpoint
router.get('/', async (_req, res) => {
  const services = {
    database: 'error',
    redis: 'error'
  };
  
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    services.database = 'connected';
  } catch (error) {
    logger.warn('Database health check failed:', error);
  }
  
  try {
    // Test Redis connection
    await redis.ping();
    services.redis = 'connected';
  } catch (error) {
    logger.warn('Redis health check failed:', error);
  }
  
  const isHealthy = services.database === 'connected' && services.redis === 'connected';
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services,
    version: '1.0.0'
  });
});

// Detailed health check
router.get('/detailed', async (_req, res) => {
  const checks = {
    database: false,
    redis: false,
    memory: false,
    uptime: process.uptime()
  };

  try {
    // Database check
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
      } catch (error) {
      logger.error('Database health check failed:', error);
    }

  try {
    // Redis check
    await redis.ping();
    checks.redis = true;
      } catch (error) {
      logger.error('Redis health check failed:', error);
    }

  // Memory check
  const memUsage = process.memoryUsage();
  checks.memory = memUsage.heapUsed < memUsage.heapTotal * 0.9;

  const isHealthy = checks.database && checks.redis && checks.memory;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks,
    memory: {
      used: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      usage: `${Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)}%`
    },
    uptime: {
      seconds: Math.floor(process.uptime()),
      human: `${Math.floor(process.uptime() / 60)} minutes`
    }
  });
});

export default router; 