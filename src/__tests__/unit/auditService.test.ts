import { PrismaClient } from '@prisma/client';
import { AuditService } from '../../services/auditService';

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn()
    },
    securityLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn()
    }
  }))
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('AuditService', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        deleteMany: jest.fn()
      },
      securityLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        deleteMany: jest.fn()
      }
    };
    AuditService.setPrisma(mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
    AuditService.resetPrisma();
  });

  describe('logUserAction', () => {
    it('should log user action successfully', async () => {
      const mockAuditLog = {
        id: 'audit-1',
        userId: 'user-1',
        action: 'CREATE',
        resource: 'RECEIPT',
        resourceId: 'receipt-1',
        details: '{"amount": 100}',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        success: true,
        errorMessage: null,
        timestamp: new Date()
      };

      mockPrisma.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await AuditService.logUserAction({
        userId: 'user-1',
        action: 'CREATE',
        resource: 'RECEIPT',
        resourceId: 'receipt-1',
        details: { amount: 100 },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        success: true
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'CREATE',
          resource: 'RECEIPT',
          resourceId: 'receipt-1',
          details: '{"amount":100}',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          success: true
        })
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.auditLog.create.mockRejectedValue(new Error('Database error'));

      // Should not throw error
      await expect(AuditService.logUserAction({
        userId: 'user-1',
        action: 'CREATE',
        resource: 'RECEIPT',
        success: true
      })).resolves.not.toThrow();
    });
  });

  describe('logAuthEvent', () => {
    it('should log authentication event', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await AuditService.logAuthEvent({
        userId: 'user-1',
        email: 'test@example.com',
        action: 'LOGIN',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        success: true
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'LOGIN',
          resource: 'AUTH',
          details: '{"email":"test@example.com"}',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          success: true
        })
      });
    });
  });

  describe('logReceiptOperation', () => {
    it('should log receipt operation', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await AuditService.logReceiptOperation({
        userId: 'user-1',
        action: 'CREATE',
        receiptId: 'receipt-1',
        details: { amount: 100 },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        success: true
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'CREATE',
          resource: 'RECEIPT',
          resourceId: 'receipt-1',
          details: '{"amount":100}',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          success: true
        })
      });
    });
  });

  describe('logSecurityEvent', () => {
    it('should log security event', async () => {
      const mockSecurityLog = {
        id: 'security-1',
        userId: 'user-1',
        action: 'SUSPICIOUS_ACTIVITY',
        details: '{"ip":"192.168.1.1"}',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        severity: 'HIGH',
        timestamp: new Date()
      };

      mockPrisma.securityLog.create.mockResolvedValue(mockSecurityLog);

      await AuditService.logSecurityEvent({
        userId: 'user-1',
        action: 'SUSPICIOUS_ACTIVITY',
        details: { ip: '192.168.1.1' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        severity: 'HIGH'
      });

      expect(mockPrisma.securityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'SUSPICIOUS_ACTIVITY',
          details: '{"ip":"192.168.1.1"}',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          severity: 'HIGH'
        })
      });
    });
  });

  describe('getUserAuditLogs', () => {
    it('should get user audit logs', async () => {
      const mockLogs = [
        { id: 'audit-1', userId: 'user-1', action: 'CREATE' },
        { id: 'audit-2', userId: 'user-1', action: 'UPDATE' }
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await AuditService.getUserAuditLogs('user-1', 10, 0);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { timestamp: 'desc' },
        take: 10,
        skip: 0
      });

      expect(result).toEqual(mockLogs);
    });
  });

  describe('getSecurityLogs', () => {
    it('should get security logs', async () => {
      const mockLogs = [
        { id: 'security-1', action: 'SUSPICIOUS_ACTIVITY', severity: 'HIGH' }
      ];

      mockPrisma.securityLog.findMany.mockResolvedValue(mockLogs);

      const result = await AuditService.getSecurityLogs('HIGH', 10, 0);

      expect(mockPrisma.securityLog.findMany).toHaveBeenCalledWith({
        where: { severity: 'HIGH' },
        orderBy: { timestamp: 'desc' },
        take: 10,
        skip: 0
      });

      expect(result).toEqual(mockLogs);
    });
  });

  describe('getAuditStats', () => {
    it('should get audit statistics', async () => {
      mockPrisma.auditLog.count
        .mockResolvedValueOnce(100) // totalActions
        .mockResolvedValueOnce(10); // failedActions
      mockPrisma.securityLog.count.mockResolvedValue(5); // securityEvents

      const result = await AuditService.getAuditStats(30);

      expect(result).toEqual({
        totalActions: 100,
        failedActions: 10,
        securityEvents: 5,
        successRate: 90
      });
    });
  });

  describe('cleanupOldLogs', () => {
    it('should cleanup old logs', async () => {
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 50 });
      mockPrisma.securityLog.deleteMany.mockResolvedValue({ count: 10 });

      const result = await AuditService.cleanupOldLogs();

      expect(result).toEqual({
        auditLogsDeleted: 50,
        securityLogsDeleted: 10
      });
    });
  });
}); 