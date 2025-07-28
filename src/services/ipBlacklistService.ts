import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

// Default Prisma instance for production use
const defaultPrisma = new PrismaClient();

// In-memory cache for blacklisted IPs (for performance)
const blacklistCache = new Map<string, { reason: string; expiresAt: Date | null }>();

export class IPBlacklistService {
  private static prisma: PrismaClient = defaultPrisma;

  // Method to set Prisma instance for testing
  static setPrisma(prismaInstance: PrismaClient) {
    IPBlacklistService.prisma = prismaInstance;
  }

  // Method to reset to default Prisma instance
  static resetPrisma() {
    IPBlacklistService.prisma = defaultPrisma;
  }

  // Initialize cache from database
  static async initializeCache() {
    try {
      const blacklistedIPs = await IPBlacklistService.prisma.iPBlacklist.findMany({
        where: {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      });

      blacklistCache.clear();
      blacklistedIPs.forEach(ip => {
        blacklistCache.set(ip.ipAddress, {
          reason: ip.reason,
          expiresAt: ip.expiresAt
        });
      });

      logger.info(`Loaded ${blacklistCache.size} blacklisted IPs into cache`);
    } catch (error) {
      logger.error('Failed to initialize IP blacklist cache:', error);
    }
  }

  // Check if IP is blacklisted
  static isBlacklisted(ipAddress: string): boolean {
    const blacklistEntry = blacklistCache.get(ipAddress);
    
    if (!blacklistEntry) {
      return false;
    }

    // Check if entry has expired
    if (blacklistEntry.expiresAt && blacklistEntry.expiresAt < new Date()) {
      blacklistCache.delete(ipAddress);
      return false;
    }

    return true;
  }

  // Get blacklist reason
  static getBlacklistReason(ipAddress: string): string | null {
    const blacklistEntry = blacklistCache.get(ipAddress);
    return blacklistEntry ? blacklistEntry.reason : null;
  }

  // Add IP to blacklist
  static async addToBlacklist(data: {
    ipAddress: string;
    reason: string;
    duration?: number; // Duration in minutes, null for permanent
    source: 'MANUAL' | 'AUTOMATIC' | 'SYSTEM';
    details?: any;
  }) {
    try {
      const expiresAt = data.duration ? new Date(Date.now() + data.duration * 60 * 1000) : null;

      // Add to database
      await IPBlacklistService.prisma.iPBlacklist.upsert({
        where: { ipAddress: data.ipAddress },
        update: {
          reason: data.reason,
          expiresAt,
          source: data.source,
          details: data.details ? JSON.stringify(data.details) : null,
          updatedAt: new Date()
        },
        create: {
          ipAddress: data.ipAddress,
          reason: data.reason,
          expiresAt,
          source: data.source,
          details: data.details ? JSON.stringify(data.details) : null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Update cache
      blacklistCache.set(data.ipAddress, {
        reason: data.reason,
        expiresAt
      });

      logger.warn(`IP ${data.ipAddress} blacklisted: ${data.reason}`, {
        ipAddress: data.ipAddress,
        reason: data.reason,
        duration: data.duration,
        source: data.source,
        expiresAt
      });

      return true;
    } catch (error) {
      logger.error('Failed to add IP to blacklist:', error);
      return false;
    }
  }

  // Remove IP from blacklist
  static async removeFromBlacklist(ipAddress: string) {
    try {
      await IPBlacklistService.prisma.iPBlacklist.delete({
        where: { ipAddress }
      });

      blacklistCache.delete(ipAddress);

      logger.info(`IP ${ipAddress} removed from blacklist`);

      return true;
    } catch (error) {
      logger.error('Failed to remove IP from blacklist:', error);
      return false;
    }
  }

  // Automatic blacklisting based on suspicious activity
  static async handleSuspiciousActivity(data: {
    ipAddress: string;
    activity: string;
    count: number;
    threshold: number;
    details?: any;
  }) {
    if (data.count >= data.threshold) {
      const reason = `Suspicious activity detected: ${data.activity} (${data.count} attempts)`;
      
      // Determine duration based on activity type
      let duration: number;
      switch (data.activity) {
        case 'LOGIN_FAILED':
          duration = 30; // 30 minutes
          break;
        case 'RATE_LIMIT_EXCEEDED':
          duration = 60; // 1 hour
          break;
        case 'UNAUTHORIZED_ACCESS':
          duration = 120; // 2 hours
          break;
        case 'FILE_UPLOAD_VIOLATION':
          duration = 240; // 4 hours
          break;
        default:
          duration = 60; // Default 1 hour
      }

      await IPBlacklistService.addToBlacklist({
        ipAddress: data.ipAddress,
        reason,
        duration,
        source: 'AUTOMATIC',
        details: {
          activity: data.activity,
          count: data.count,
          threshold: data.threshold,
          ...data.details
        }
      });

      // Log security event
      const { AuditService } = await import('./auditService');
      await AuditService.logSecurityEvent({
        action: 'SUSPICIOUS_ACTIVITY',
        ipAddress: data.ipAddress,
        severity: 'HIGH',
        details: {
          activity: data.activity,
          count: data.count,
          threshold: data.threshold,
          action: 'IP_BLACKLISTED'
        }
      });
    }
  }

  // Get blacklist statistics
  static async getBlacklistStats() {
    try {
      const [total, permanent, temporary, recent] = await Promise.all([
        IPBlacklistService.prisma.iPBlacklist.count(),
        IPBlacklistService.prisma.iPBlacklist.count({
          where: { expiresAt: null }
        }),
        IPBlacklistService.prisma.iPBlacklist.count({
          where: { expiresAt: { not: null } }
        }),
        IPBlacklistService.prisma.iPBlacklist.count({
          where: {
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        })
      ]);

      return {
        total,
        permanent,
        temporary,
        recent24h: recent,
        cacheSize: blacklistCache.size
      };
    } catch (error) {
      logger.error('Failed to get blacklist stats:', error);
      return null;
    }
  }

  // Clean expired entries
  static async cleanupExpiredEntries() {
    try {
      const result = await IPBlacklistService.prisma.iPBlacklist.deleteMany({
        where: {
          expiresAt: { lt: new Date() }
        }
      });

      // Clean cache
      for (const [ip, entry] of blacklistCache.entries()) {
        if (entry.expiresAt && entry.expiresAt < new Date()) {
          blacklistCache.delete(ip);
        }
      }

      logger.info(`Cleaned up ${result.count} expired blacklist entries`);
      return result.count;
    } catch (error) {
      logger.error('Failed to cleanup expired blacklist entries:', error);
      return 0;
    }
  }

  // Get blacklisted IPs
  static async getBlacklistedIPs(limit: number = 50, offset: number = 0) {
    return await IPBlacklistService.prisma.iPBlacklist.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
  }
} 