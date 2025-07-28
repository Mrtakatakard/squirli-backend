import { Request, Response } from 'express';
import { UserController } from '../../controllers/userController';

// Mock the entire module
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    user: {
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn()
    }
  };
  
  return {
    PrismaClient: jest.fn().mockImplementation(() => mockPrisma)
  };
});

// Get the mocked Prisma instance
const { PrismaClient } = require('@prisma/client');
const mockPrisma = new PrismaClient();

describe('UserController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    
    mockRequest = {};
    mockResponse = {
      json: jsonMock,
      status: statusMock
    };

    jest.clearAllMocks();
  });

  describe('getUserStats', () => {
    it('should return user statistics successfully', async () => {
      // Mock Prisma responses
      const mockAggregateResult = { _count: { id: 10 } };
      const mockSubscriptionStats = [
        { subscription: 'FREE', _count: { subscription: 7 } },
        { subscription: 'PERSONAL', _count: { subscription: 3 } }
      ];
      const mockFinancialLevelStats = [
        { financialLevel: 'BEGINNER', _count: { financialLevel: 6 } },
        { financialLevel: 'INTERMEDIATE', _count: { financialLevel: 4 } }
      ];

      (mockPrisma.user.aggregate as jest.Mock).mockResolvedValue(mockAggregateResult);
      (mockPrisma.user.groupBy as jest.Mock)
        .mockResolvedValueOnce(mockSubscriptionStats)
        .mockResolvedValueOnce(mockFinancialLevelStats);

      await UserController.getUserStats(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'User statistics retrieved successfully',
        data: {
          totalUsers: 10,
          subscriptions: [
            { tier: undefined, count: { subscription: 7 } },
            { tier: undefined, count: { subscription: 3 } }
          ],
          financialLevels: [
            { level: 'BEGINNER', count: { financialLevel: 6 } },
            { level: 'INTERMEDIATE', count: { financialLevel: 4 } }
          ]
        },
        timestamp: expect.any(String)
      });
    });

    it('should handle database errors gracefully', async () => {
      const mockError = new Error('Database connection failed');
      (mockPrisma.user.aggregate as jest.Mock).mockRejectedValue(mockError);

      await UserController.getUserStats(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Internal server error',
        message: 'Failed to retrieve user statistics'
      });
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      mockRequest.params = { id: 'user123' };
      
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        financialLevel: 'BEGINNER',
        subscription: 'FREE',
        language: 'SPANISH',
        currency: 'DOP',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await UserController.getUserById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'User retrieved successfully',
        data: mockUser,
        timestamp: expect.any(String)
      });
    });

    it('should return 404 when user not found', async () => {
      mockRequest.params = { id: 'nonexistent' };
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await UserController.getUserById(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'User not found',
        message: 'User with ID nonexistent does not exist'
      });
    });
  });

  describe('createTestUser', () => {
    it('should create test user in development environment', async () => {
      process.env['NODE_ENV'] = 'development';
      
      const mockCreatedUser = {
        id: 'test123',
        email: 'test-123@squirli.test',
        firstName: 'Test',
        lastName: 'User',
        financialLevel: 'BEGINNER',
        subscription: 'FREE',
        createdAt: new Date()
      };

      (mockPrisma.user.create as jest.Mock).mockResolvedValue(mockCreatedUser);

      await UserController.createTestUser(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Test user created successfully',
        data: mockCreatedUser,
        timestamp: expect.any(String)
      });
    });

    it('should reject test user creation in production', async () => {
      process.env['NODE_ENV'] = 'production';

      await UserController.createTestUser(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Test user creation not allowed in production'
      });
    });
  });
}); 