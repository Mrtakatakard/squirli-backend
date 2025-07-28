import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { JWTUtils } from '../utils/authUtils';
import logger from '../utils/logger';


const prisma = new PrismaClient();

/**
 * Middleware to verify JWT access token
 * Adds user information to req.user if token is valid
 */
export const authenticateToken = async (
  req: any,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = (req.headers as any).authorization;
    const token = JWTUtils.extractTokenFromHeader(authHeader);

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token required',
        errors: [{ message: 'Please provide a valid access token' }]
      });
      return;
    }

    // Verify token
    let payload;
    try {
      payload = JWTUtils.verifyAccessToken(token);
    } catch (error) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        errors: [{ message: 'Please login again' }]
      });
      return;
    }

    // Check if user exists and session is active
    const session = await prisma.userSession.findFirst({
      where: {
        userId: payload.userId,
        token,
        isActive: true
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            financialLevel: true,
            subscription: true,
            emailVerified: true
          }
        }
      }
    });

    if (!session) {
      res.status(401).json({
        success: false,
        message: 'Session not found or inactive',
        errors: [{ message: 'Please login again' }]
      });
      return;
    }

    // Check if user still exists
    if (!session.user) {
      res.status(401).json({
        success: false,
        message: 'User account not found',
        errors: [{ message: 'Please login again' }]
      });
      return;
    }

    // Add user information to request
    req.user = {
      id: session.user.id,
      email: session.user.email,
      financialLevel: session.user.financialLevel,
      subscription: session.user.subscription
    };

    // Update session last used
    await prisma.userSession.update({
      where: { id: session.id },
      data: { updatedAt: new Date() }
    });

    next();

  } catch (error) {
    logger.error('Authentication middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication',
      errors: [{ message: 'Please try again later' }]
    });
  }
};

/**
 * Optional authentication middleware
 * Adds user information to req.user if token is valid, but doesn't fail if no token
 */
export const optionalAuth = async (
  req: any,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = (req.headers as any).authorization;
    const token = JWTUtils.extractTokenFromHeader(authHeader);

    if (!token) {
      // No token provided, continue without authentication
      next();
      return;
    }

    // Try to verify token
    try {
      const payload = JWTUtils.verifyAccessToken(token);

      // Check if session exists and is active
      const session = await prisma.userSession.findFirst({
        where: {
          userId: payload.userId,
          token,
          isActive: true
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              financialLevel: true,
              subscription: true,
              emailVerified: true
            }
          }
        }
      });

      if (session && session.user) {
        // Add user information to request
        req.user = {
          id: session.user.id,
          email: session.user.email,
          financialLevel: session.user.financialLevel,
          subscription: session.user.subscription
        };

        // Update session last used
        await prisma.userSession.update({
          where: { id: session.id },
          data: { updatedAt: new Date() }
        });
      }
    } catch (_error) {
      // Token is invalid, but we don't fail the request
      logger.warn('Optional auth: Invalid token provided');
    }

    next();

  } catch (error) {
    logger.error('Optional authentication middleware error:', error);
    // Don't fail the request, just continue
    next();
  }
};

/**
 * Middleware to check if user has required subscription level
 */
export const requireSubscription = (requiredLevel: 'FREE' | 'PERSONAL' | 'ADVANCED' | 'FAMILY' | 'BUSINESS') => {
  return (req: any, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        errors: [{ message: 'Please login to access this feature' }]
      });
      return;
    }

    const subscriptionLevels = ['FREE', 'PERSONAL', 'ADVANCED', 'FAMILY', 'BUSINESS'];
    const userLevel = subscriptionLevels.indexOf(req.user.subscription);
    const requiredLevelIndex = subscriptionLevels.indexOf(requiredLevel);

    if (userLevel < requiredLevelIndex) {
      res.status(403).json({
        success: false,
        message: 'Subscription level required',
        errors: [{ 
          message: `This feature requires ${requiredLevel} subscription or higher`,
          requiredLevel,
          currentLevel: req.user.subscription
        }]
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to check if user has verified email
 */
export const requireEmailVerification = (
  req: any,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
      errors: [{ message: 'Please login to access this feature' }]
    });
    return;
  }

  // For now, we'll skip email verification check since we haven't implemented it yet
  // TODO: Implement email verification check
  next();
};

/**
 * Rate limiting middleware for authentication endpoints
 */
export const authRateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: {
    register: 5, // 5 registration attempts per window
    login: 10,   // 10 login attempts per window
    refresh: 20  // 20 refresh attempts per window
  }
}; 