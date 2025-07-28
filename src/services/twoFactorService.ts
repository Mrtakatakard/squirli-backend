import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';
import { EncryptionService } from './encryptionService';
import { NotificationService } from './notificationService';

// Default Prisma instance for production use
const defaultPrisma = new PrismaClient();

export class TwoFactorService {
  private static prisma: PrismaClient = defaultPrisma;

  // Method to set Prisma instance for testing
  static setPrisma(prismaInstance: PrismaClient) {
    TwoFactorService.prisma = prismaInstance;
  }

  // Method to reset to default Prisma instance
  static resetPrisma() {
    TwoFactorService.prisma = defaultPrisma;
  }

  // Generate TOTP secret
  static generateSecret(): string {
    return crypto.randomBytes(20).toString('base64').replace(/[+/=]/g, '').substring(0, 32);
  }

  // Generate QR code URL for authenticator apps
  static generateQRCodeUrl(secret: string, email: string, issuer: string = 'Squirli'): string {
    const encodedIssuer = encodeURIComponent(issuer);
    const encodedEmail = encodeURIComponent(email);
    const encodedSecret = encodeURIComponent(secret);
    
    return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${encodedSecret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
  }

  // Base32 decode implementation
  private static base32Decode(encoded: string): Buffer {
    const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    const result: number[] = [];

    for (let i = 0; i < encoded.length; i++) {
      const char = encoded[i].toUpperCase();
      const index = base32Chars.indexOf(char);
      if (index === -1) continue;

      value = (value << 5) | index;
      bits += 5;

      if (bits >= 8) {
        result.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }

    return Buffer.from(result);
  }

  // Generate TOTP code
  static generateTOTP(secret: string, timeStep: number = 30): string {
    let counter = Math.floor(Date.now() / 1000 / timeStep);
    const buffer = Buffer.alloc(8);
    
    for (let i = 0; i < 8; i++) {
      buffer[7 - i] = (counter & 0xff);
      counter = counter >> 8;
    }

    // Simple base32 decode implementation
    const key = this.base32Decode(secret);
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(buffer);
    const hash = hmac.digest();

    const offset = hash[hash.length - 1] & 0xf;
    const code = ((hash[offset] & 0x7f) << 24) |
                 ((hash[offset + 1] & 0xff) << 16) |
                 ((hash[offset + 2] & 0xff) << 8) |
                 (hash[offset + 3] & 0xff);

    return (code % 1000000).toString().padStart(6, '0');
  }

  // Verify TOTP code
  static verifyTOTP(secret: string, code: string, window: number = 1): boolean {
    const timeStep = 30;
    const counter = Math.floor(Date.now() / 1000 / timeStep);
    
    for (let i = -window; i <= window; i++) {
      const expectedCode = this.generateTOTP(secret, timeStep);
      if (code === expectedCode) {
        return true;
      }
    }
    
    return false;
  }

  // Enable 2FA for user
  static async enable2FA(userId: string, secret: string, backupCodes: string[]): Promise<boolean> {
    try {
      // Encrypt the secret before storing
      const encryptedSecret = EncryptionService.encrypt(secret);
      
      // Hash backup codes before storing
      const hashedBackupCodes = backupCodes.map(code => {
        const { hash } = EncryptionService.hash(code);
        return hash;
      });

      await TwoFactorService.prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: encryptedSecret,
          twoFactorBackupCodes: hashedBackupCodes,
          twoFactorEnabledAt: new Date()
        }
      });

      logger.info(`2FA enabled for user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Failed to enable 2FA:', error);
      return false;
    }
  }

  // Disable 2FA for user
  static async disable2FA(userId: string): Promise<boolean> {
    try {
      await TwoFactorService.prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: [],
          twoFactorEnabledAt: null,
          twoFactorDisabledAt: new Date()
        }
      });

      logger.info(`2FA disabled for user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Failed to disable 2FA:', error);
      return false;
    }
  }

  // Verify 2FA code
  static async verify2FACode(userId: string, code: string): Promise<{ success: boolean; isBackupCode: boolean }> {
    try {
      const user = await TwoFactorService.prisma.user.findUnique({
        where: { id: userId },
        select: {
          twoFactorEnabled: true,
          twoFactorSecret: true,
          twoFactorBackupCodes: true
        }
      });

      if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
        return { success: false, isBackupCode: false };
      }

      // Decrypt the secret
      const secret = EncryptionService.decrypt(user.twoFactorSecret);

      // First, try to verify as TOTP code
      if (this.verifyTOTP(secret, code)) {
        return { success: true, isBackupCode: false };
      }

      // If not TOTP, try as backup code
      if (user.twoFactorBackupCodes && user.twoFactorBackupCodes.length > 0) {
        for (let i = 0; i < user.twoFactorBackupCodes.length; i++) {
          if (EncryptionService.verifyHash(code, user.twoFactorBackupCodes[i], '')) {
            // Remove used backup code
            const updatedBackupCodes = user.twoFactorBackupCodes.filter((_, index) => index !== i);
            await TwoFactorService.prisma.user.update({
              where: { id: userId },
              data: { twoFactorBackupCodes: updatedBackupCodes }
            });

            logger.warn(`Backup code used for user ${userId}`);
            return { success: true, isBackupCode: true };
          }
        }
      }

      return { success: false, isBackupCode: false };
    } catch (error) {
      logger.error('Failed to verify 2FA code:', error);
      return { success: false, isBackupCode: false };
    }
  }

  // Generate backup codes
  static generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric codes
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  // Check if user has 2FA enabled
  static async is2FAEnabled(userId: string): Promise<boolean> {
    try {
      const user = await TwoFactorService.prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorEnabled: true }
      });

      return user?.twoFactorEnabled || false;
    } catch (error) {
      logger.error('Failed to check 2FA status:', error);
      return false;
    }
  }

  // Get 2FA setup info
  static async get2FASetupInfo(userId: string): Promise<{
    secret: string;
    qrCodeUrl: string;
    backupCodes: string[];
  } | null> {
    try {
      const user = await TwoFactorService.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      });

      if (!user) return null;

      const secret = this.generateSecret();
      const qrCodeUrl = this.generateQRCodeUrl(secret, user.email);
      const backupCodes = this.generateBackupCodes();

      return {
        secret,
        qrCodeUrl,
        backupCodes
      };
    } catch (error) {
      logger.error('Failed to get 2FA setup info:', error);
      return null;
    }
  }

  // Send 2FA setup email
  static async send2FASetupEmail(userId: string, email: string, backupCodes: string[]): Promise<boolean> {
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Two-Factor Authentication Setup - Squirli</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #28a745; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
            .backup-codes { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0; }
            .code { font-family: monospace; font-size: 16px; font-weight: bold; color: #007bff; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Two-Factor Authentication Enabled</h1>
            </div>
            <div class="content">
              <h2>Your account is now more secure!</h2>
              <p>Two-factor authentication has been successfully enabled for your Squirli account.</p>
              
              <h3>📱 Backup Codes</h3>
              <p>Store these backup codes in a safe place. You can use them to access your account if you lose your authenticator device:</p>
              
              <div class="backup-codes">
                ${backupCodes.map(code => `<div class="code">${code}</div>`).join('')}
              </div>
              
              <div style="margin-top: 20px; padding: 15px; background: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px;">
                <strong>⚠️ Important:</strong>
                <ul style="margin: 10px 0 0 20px;">
                  <li>Keep these backup codes secure and private</li>
                  <li>Each code can only be used once</li>
                  <li>If you lose both your device and backup codes, contact support</li>
                </ul>
              </div>
            </div>
            <div class="footer">
              <p>This is an automated notification from Squirli.</p>
              <p>© 2024 Squirli. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: `"Squirli Security" <${process.env.EMAIL_FROM_ADDRESS || 'security@squirli.com'}>`,
        to: email,
        subject: 'Two-Factor Authentication Enabled - Squirli',
        html: htmlContent
      };

      if (NotificationService['transporter']) {
        await NotificationService['transporter'].sendMail(mailOptions);
        logger.info(`2FA setup email sent to ${email}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to send 2FA setup email:', error);
      return false;
    }
  }

  // Validate backup codes format
  static validateBackupCode(code: string): boolean {
    // Backup codes should be 8-character alphanumeric
    return /^[A-F0-9]{8}$/.test(code);
  }

  // Get remaining backup codes count
  static async getRemainingBackupCodes(userId: string): Promise<number> {
    try {
      const user = await TwoFactorService.prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorBackupCodes: true }
      });

      return user?.twoFactorBackupCodes?.length || 0;
    } catch (error) {
      logger.error('Failed to get remaining backup codes count:', error);
      return 0;
    }
  }

  // Regenerate backup codes
  static async regenerateBackupCodes(userId: string): Promise<string[] | null> {
    try {
      const newBackupCodes = this.generateBackupCodes();
      const hashedBackupCodes = newBackupCodes.map(code => {
        const { hash } = EncryptionService.hash(code);
        return hash;
      });

      await TwoFactorService.prisma.user.update({
        where: { id: userId },
        data: { twoFactorBackupCodes: hashedBackupCodes }
      });

      logger.info(`Backup codes regenerated for user ${userId}`);
      return newBackupCodes;
    } catch (error) {
      logger.error('Failed to regenerate backup codes:', error);
      return null;
    }
  }
} 