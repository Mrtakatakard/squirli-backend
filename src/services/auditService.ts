import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

// Default Prisma instance for production use
const defaultPrisma = new PrismaClient();

export class AuditService {
  private static prisma: PrismaClient = defaultPrisma;

  // Method to set Prisma instance for testing
  static setPrisma(prismaInstance: PrismaClient) {
    AuditService.prisma = prismaInstance;
  }

  // Method to reset to default Prisma instance
  static resetPrisma() {
    AuditService.prisma = defaultPrisma;
  }

  // Log user action
  static async logUserAction(data: {
    userId: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
    success: boolean;
    errorMessage?: string;
  }) {
    try {
      await AuditService.prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          resource: data.resource,
          resourceId: data.resourceId,
          details: data.details ? JSON.stringify(data.details) : null,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          success: data.success,
          errorMessage: data.errorMessage,
          timestamp: new Date()
        }
      });

      // Also log to Winston for immediate visibility
      const logLevel = data.success ? 'info' : 'warn';
      logger[logLevel](`AUDIT: ${data.action} on ${data.resource} by user ${data.userId} - ${data.success ? 'SUCCESS' : 'FAILED'}`, {
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        ipAddress: data.ipAddress,
        success: data.success,
        errorMessage: data.errorMessage
      });
    } catch (error) {
      logger.error('Failed to log audit entry:', error);
    }
  }

  // Log authentication events
  static async logAuthEvent(data: {
    userId?: string;
    email?: string;
    action: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED' | 'REGISTER' | 'PASSWORD_RESET' | 'PASSWORD_CHANGE';
    ipAddress?: string;
    userAgent?: string;
    success: boolean;
    errorMessage?: string;
  }) {
    await AuditService.logUserAction({
      userId: data.userId || 'anonymous',
      action: data.action,
      resource: 'AUTH',
      details: { email: data.email },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      success: data.success,
      errorMessage: data.errorMessage
    });
  }

  // Log receipt operations
  static async logReceiptOperation(data: {
    userId: string;
    action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'UPLOAD' | 'OCR_PROCESS';
    receiptId?: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
    success: boolean;
    errorMessage?: string;
  }) {
    await AuditService.logUserAction({
      userId: data.userId,
      action: data.action,
      resource: 'RECEIPT',
      resourceId: data.receiptId,
      details: data.details,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      success: data.success,
      errorMessage: data.errorMessage
    });
  }

  // Log security events
  static async logSecurityEvent(data: {
    userId?: string;
    action: 'RATE_LIMIT_EXCEEDED' | 'INVALID_TOKEN' | 'UNAUTHORIZED_ACCESS' | 'SUSPICIOUS_ACTIVITY' | 'FILE_UPLOAD_VIOLATION';
    details?: any;
    ipAddress?: string;
    userAgent?: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }) {
    try {
      await AuditService.prisma.securityLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          details: data.details ? JSON.stringify(data.details) : null,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          severity: data.severity,
          timestamp: new Date()
        }
      });

      // Log to Winston with appropriate level
      const logLevel = data.severity === 'CRITICAL' ? 'error' : 
                      data.severity === 'HIGH' ? 'warn' : 'info';
      
      logger[logLevel](`SECURITY: ${data.action} - Severity: ${data.severity}`, {
        userId: data.userId,
        action: data.action,
        ipAddress: data.ipAddress,
        severity: data.severity,
        details: data.details
      });
    } catch (error) {
      logger.error('Failed to log security event:', error);
    }
  }

  // Get audit logs for a user
  static async getUserAuditLogs(userId: string, limit: number = 50, offset: number = 0) {
    return await AuditService.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset
    });
  }

  // Get security logs
  static async getSecurityLogs(severity?: string, limit: number = 50, offset: number = 0) {
    const where = severity ? { severity } : {};
    
    return await AuditService.prisma.securityLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset
    });
  }

  // Get audit statistics
  static async getAuditStats(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [totalActions, failedActions, securityEvents] = await Promise.all([
      AuditService.prisma.auditLog.count({
        where: { timestamp: { gte: startDate } }
      }),
      AuditService.prisma.auditLog.count({
        where: { 
          timestamp: { gte: startDate },
          success: false
        }
      }),
      AuditService.prisma.securityLog.count({
        where: { timestamp: { gte: startDate } }
      })
    ]);

    return {
      totalActions,
      failedActions,
      securityEvents,
      successRate: totalActions > 0 ? ((totalActions - failedActions) / totalActions) * 100 : 0
    };
  }

  // Clean old audit logs (keep last 90 days)
  static async cleanupOldLogs() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    try {
      const [auditDeleted, securityDeleted] = await Promise.all([
        AuditService.prisma.auditLog.deleteMany({
          where: { timestamp: { lt: cutoffDate } }
        }),
        AuditService.prisma.securityLog.deleteMany({
          where: { timestamp: { lt: cutoffDate } }
        })
      ]);

      logger.info(`Cleaned up ${auditDeleted.count} audit logs and ${securityDeleted.count} security logs older than 90 days`);
      
      return {
        auditLogsDeleted: auditDeleted.count,
        securityLogsDeleted: securityDeleted.count
      };
    } catch (error) {
      logger.error('Failed to cleanup old logs:', error);
      throw error;
    }
  }
} 