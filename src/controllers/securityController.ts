import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';
import '../types/express.d'; // Import Express type extensions
import { TwoFactorService } from '../services/twoFactorService';
import { GeoLocationService } from '../services/geoLocationService';
import { NotificationService } from '../services/notificationService';
import { AuditService } from '../services/auditService';
import { ValidationService } from '../services/validationService';
import { MetricsService } from '../services/metricsService';

// Default Prisma instance for production use
const defaultPrisma = new PrismaClient();

export class SecurityController {
  private static prisma: PrismaClient = defaultPrisma;

  // Method to set Prisma instance for testing
  static setPrisma(prismaInstance: PrismaClient) {
    SecurityController.prisma = prismaInstance;
  }

  // Method to reset to default Prisma instance
  static resetPrisma() {
    SecurityController.prisma = defaultPrisma;
  }

  // Get 2FA setup information
  static async get2FASetup(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const isEnabled = await TwoFactorService.is2FAEnabled(userId);
      if (isEnabled) {
        return res.status(400).json({ error: '2FA is already enabled' });
      }

      const setupInfo = await TwoFactorService.get2FASetupInfo(userId);
      if (!setupInfo) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Log the 2FA setup initiation
      await AuditService.logUserAction({
        userId,
        action: '2FA_SETUP_INITIATED',
        resource: 'SECURITY',
        ipAddress: req.clientIP,
        userAgent: req.headers['user-agent'],
        success: true
      });

      return res.json({
        success: true,
        data: {
          secret: setupInfo.secret,
          qrCodeUrl: setupInfo.qrCodeUrl,
          backupCodes: setupInfo.backupCodes
        }
      });
    } catch (error) {
      logger.error('Error getting 2FA setup:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Enable 2FA
  static async enable2FA(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { secret, code } = req.body;

      // Validate input
      const validation = ValidationService.validate(req.body, ValidationService.schemas.twoFactorSetup);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.errors
        });
      }

      // Verify the code
      const isValid = TwoFactorService.verifyTOTP(secret, code);
      if (!isValid) {
        await AuditService.logUserAction({
          userId,
          action: '2FA_SETUP_FAILED',
          resource: 'SECURITY',
          ipAddress: req.clientIP,
          userAgent: req.headers['user-agent'],
          success: false,
          errorMessage: 'Invalid 2FA code'
        });

        return res.status(400).json({ error: 'Invalid 2FA code' });
      }

      // Generate backup codes
      const backupCodes = TwoFactorService.generateBackupCodes();

      // Enable 2FA
      const success = await TwoFactorService.enable2FA(userId, secret, backupCodes);
      if (!success) {
        return res.status(500).json({ error: 'Failed to enable 2FA' });
      }

      // Send setup email
      const user = await SecurityController.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      });

      if (user?.email) {
        await TwoFactorService.send2FASetupEmail(userId, user.email, backupCodes);
      }

      // Log successful 2FA setup
      await AuditService.logUserAction({
        userId,
        action: '2FA_ENABLED',
        resource: 'SECURITY',
        ipAddress: req.clientIP,
        userAgent: req.headers['user-agent'],
        success: true
      });

      // Record metrics
      MetricsService.recordSecurityEvent('2FA_ENABLED', 'MEDIUM', req.clientIP || 'unknown');

      return res.json({
        success: true,
        message: '2FA enabled successfully',
        data: {
          backupCodes
        }
      });
    } catch (error) {
      logger.error('Error enabling 2FA:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Disable 2FA
  static async disable2FA(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const success = await TwoFactorService.disable2FA(userId);
      if (!success) {
        return res.status(500).json({ error: 'Failed to disable 2FA' });
      }

      // Log 2FA disable
      await AuditService.logUserAction({
        userId,
        action: '2FA_DISABLED',
        resource: 'SECURITY',
        ipAddress: req.clientIP,
        userAgent: req.headers['user-agent'],
        success: true
      });

      // Record metrics
      MetricsService.recordSecurityEvent('2FA_DISABLED', 'MEDIUM', req.clientIP || 'unknown');

      return res.json({
        success: true,
        message: '2FA disabled successfully'
      });
    } catch (error) {
      logger.error('Error disabling 2FA:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Verify 2FA code
  static async verify2FA(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { code } = req.body;

      if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: '2FA code is required' });
      }

      const result = await TwoFactorService.verify2FACode(userId, code);
      if (!result.success) {
        await AuditService.logUserAction({
          userId,
          action: '2FA_VERIFICATION_FAILED',
          resource: 'SECURITY',
          ipAddress: req.clientIP,
          userAgent: req.headers['user-agent'],
          success: false,
          errorMessage: 'Invalid 2FA code'
        });

        return res.status(400).json({ error: 'Invalid 2FA code' });
      }

      // Log successful verification
      await AuditService.logUserAction({
        userId,
        action: '2FA_VERIFICATION_SUCCESS',
        resource: 'SECURITY',
        ipAddress: req.clientIP,
        userAgent: req.headers['user-agent'],
        success: true
      });

      return res.json({
        success: true,
        message: '2FA verification successful',
        data: {
          isBackupCode: result.isBackupCode
        }
      });
    } catch (error) {
      logger.error('Error verifying 2FA:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get security settings
  static async getSecuritySettings(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await SecurityController.prisma.user.findUnique({
        where: { id: userId },
        select: {
          emailVerified: true,
          lastLoginAt: true,
          createdAt: true
        }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get location statistics
      const locationStats = await GeoLocationService.getUserLocationStats(userId);

      // Get remaining backup codes
      const remainingBackupCodes = await TwoFactorService.getRemainingBackupCodes(userId);

      return res.json({
        success: true,
        data: {
          twoFactorEnabled: false, // Will be implemented when 2FA fields are added to schema
          twoFactorEnabledAt: null,
          emailVerified: user.emailVerified,
          lastLoginAt: user.lastLoginAt,
          accountCreatedAt: user.createdAt,
          locationStats,
          remainingBackupCodes,
          securityScore: this.calculateSecurityScore(user, locationStats, remainingBackupCodes)
        }
      });
    } catch (error) {
      logger.error('Error getting security settings:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Update security settings
  static async updateSecuritySettings(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { emailNotifications, sessionTimeout } = req.body;

      // Validate input
      const validation = ValidationService.validate(req.body, ValidationService.schemas.securitySettings);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.errors
        });
      }

      // Update user preferences (simplified for now)
      await SecurityController.prisma.userPreference.upsert({
        where: { userId },
        update: {
          emailNotifications: emailNotifications ?? undefined
        },
        create: {
          userId,
          emailNotifications: emailNotifications ?? true
        }
      });

      // Log settings update
      await AuditService.logUserAction({
        userId,
        action: 'SECURITY_SETTINGS_UPDATED',
        resource: 'SECURITY',
        ipAddress: req.clientIP,
        userAgent: req.headers['user-agent'],
        success: true,
        details: { emailNotifications, sessionTimeout }
      });

      return res.json({
        success: true,
        message: 'Security settings updated successfully'
      });
    } catch (error) {
      logger.error('Error updating security settings:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Regenerate backup codes
  static async regenerateBackupCodes(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const newBackupCodes = await TwoFactorService.regenerateBackupCodes(userId);
      if (!newBackupCodes) {
        return res.status(500).json({ error: 'Failed to regenerate backup codes' });
      }

      // Send email with new backup codes
      const user = await SecurityController.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      });

      if (user?.email) {
        await TwoFactorService.send2FASetupEmail(userId, user.email, newBackupCodes);
      }

      // Log backup codes regeneration
      await AuditService.logUserAction({
        userId,
        action: 'BACKUP_CODES_REGENERATED',
        resource: 'SECURITY',
        ipAddress: req.clientIP,
        userAgent: req.headers['user-agent'],
        success: true
      });

      return res.json({
        success: true,
        message: 'Backup codes regenerated successfully',
        data: {
          backupCodes: newBackupCodes
        }
      });
    } catch (error) {
      logger.error('Error regenerating backup codes:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get security activity
  static async getSecurityActivity(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { limit = 20, offset = 0 } = req.query;

      const activities = await AuditService.getUserAuditLogs(userId, Number(limit), Number(offset));

      return res.json({
        success: true,
        data: {
          activities,
          total: activities.length
        }
      });
    } catch (error) {
      logger.error('Error getting security activity:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Calculate security score
  private static calculateSecurityScore(
    user: any,
    locationStats: any,
    remainingBackupCodes: number
  ): number {
    let score = 0;

    // 2FA enabled: +40 points (will be implemented when 2FA fields are added)
    // if (user.twoFactorEnabled) {
    //   score += 40;
    // }

    // Email verified: +20 points
    if (user.emailVerified) {
      score += 20;
    }

    // Account age: +10 points for accounts older than 30 days
    const accountAge = Date.now() - new Date(user.createdAt).getTime();
    if (accountAge > 30 * 24 * 60 * 60 * 1000) {
      score += 10;
    }

    // Location consistency: +15 points for users with consistent location
    if (locationStats.uniqueCountries <= 2) {
      score += 15;
    }

    // Backup codes available: +10 points
    if (remainingBackupCodes > 0) {
      score += 10;
    }

    // Recent activity: +5 points for recent login
    if (user.lastLoginAt) {
      const daysSinceLastLogin = (Date.now() - new Date(user.lastLoginAt).getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceLastLogin <= 7) {
        score += 5;
      }
    }

    return Math.min(score, 100);
  }
} 