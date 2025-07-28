import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

export class UserController {
  // Get user statistics
  static async getUserStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await prisma.user.aggregate({
        _count: {
          id: true
        }
      });

      const subscriptionStats = await prisma.user.groupBy({
        by: ['subscription'],
        _count: {
          subscription: true
        }
      });

      const financialLevelStats = await prisma.user.groupBy({
        by: ['financialLevel'],
        _count: {
          financialLevel: true
        }
      });

      res.json({
        message: 'User statistics retrieved successfully',
        data: {
          totalUsers: stats._count.id,
          subscriptions: subscriptionStats.map((sub: any) => ({
            tier: sub.tier,
            count: sub._count
          })),
          financialLevels: financialLevelStats.map((level: any) => ({
            level: level.financialLevel,
            count: level._count
          })),
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error getting user stats:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve user statistics'
      });
    }
  }

  // Get user by ID (for testing)
  static async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Bad request',
          message: 'User ID is required'
        });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          financialLevel: true,
          subscription: true,
          language: true,
          currency: true,
          createdAt: true,
          updatedAt: true,
          // Don't include password or sensitive data
        }
      });

      if (!user) {
        res.status(404).json({
          error: 'User not found',
          message: `User with ID ${id} does not exist`
        });
        return;
      }

      res.json({
        message: 'User retrieved successfully',
        data: user,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error getting user by ID:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve user'
      });
    }
  }

  // Create test user (for development only)
  static async createTestUser(_req: Request, res: Response): Promise<void> {
    try {
      // Only allow in development
      if (process.env['NODE_ENV'] === 'production') {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Test user creation not allowed in production'
        });
        return;
      }

      const testUser = await prisma.user.create({
        data: {
          email: `test-${Date.now()}@squirli.test`,
          password: 'hashed_password_here', // In real app, this would be bcrypt hashed
          firstName: 'Test',
          lastName: 'User',
          financialLevel: 'BEGINNER',
          subscription: 'FREE',
          language: 'SPANISH',
          currency: 'DOP'
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          financialLevel: true,
          subscription: true,
          createdAt: true
        }
      });

      res.status(201).json({
        message: 'Test user created successfully',
        data: testUser,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error creating test user:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create test user'
      });
    }
  }

  // Delete test users (cleanup)
  static async deleteTestUsers(_req: Request, res: Response): Promise<void> {
    try {
      // Only allow in development
      if (process.env['NODE_ENV'] === 'production') {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Test user deletion not allowed in production'
        });
        return;
      }

      const result = await prisma.user.deleteMany({
        where: {
          email: {
            contains: '@squirli.test'
          }
        }
      });

      res.json({
        message: 'Test users deleted successfully',
        data: {
          deletedCount: result.count
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error deleting test users:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete test users'
      });
    }
  }
} 