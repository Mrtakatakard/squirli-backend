import nodemailer from 'nodemailer';
import logger from '../utils/logger';
import { EncryptionService } from './encryptionService';

export class NotificationService {
  private static transporter: nodemailer.Transporter | null = null;

  // Initialize email transporter
  static async initialize() {
    try {
      const smtpConfig = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      };

      this.transporter = nodemailer.createTransport(smtpConfig);

      // Verify connection
      await this.transporter.verify();
      logger.info('Email notification service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize email notification service:', error);
      this.transporter = null;
    }
  }

  // Send security alert email
  static async sendSecurityAlert(data: {
    to: string | string[];
    subject: string;
    alertType: 'LOGIN_FAILED' | 'SUSPICIOUS_ACTIVITY' | 'RATE_LIMIT_EXCEEDED' | 'UNAUTHORIZED_ACCESS' | 'FILE_UPLOAD_VIOLATION';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    details: {
      ipAddress?: string;
      userAgent?: string;
      timestamp: Date;
      location?: string;
      deviceInfo?: string;
      action?: string;
      resource?: string;
      [key: string]: any;
    };
  }) {
    try {
      if (!this.transporter) {
        logger.warn('Email transporter not initialized, skipping security alert');
        return false;
      }

      const { to, subject, alertType, severity, details } = data;
      
      const severityColors = {
        LOW: '#28a745',
        MEDIUM: '#ffc107',
        HIGH: '#fd7e14',
        CRITICAL: '#dc3545'
      };

      const alertIcons = {
        LOGIN_FAILED: '🔐',
        SUSPICIOUS_ACTIVITY: '⚠️',
        RATE_LIMIT_EXCEEDED: '🚫',
        UNAUTHORIZED_ACCESS: '🚨',
        FILE_UPLOAD_VIOLATION: '📁'
      };

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Security Alert - Squirli</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${severityColors[severity]}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
            .alert-icon { font-size: 48px; margin-bottom: 10px; }
            .severity-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; color: white; font-weight: bold; }
            .details-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .details-table th, .details-table td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            .details-table th { background: #e9ecef; font-weight: bold; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="alert-icon">${alertIcons[alertType]}</div>
              <h1>Security Alert</h1>
              <span class="severity-badge" style="background: ${severityColors[severity]}">${severity}</span>
            </div>
            <div class="content">
              <h2>${subject}</h2>
              <p>A security event has been detected on your Squirli account. Please review the details below:</p>
              
              <table class="details-table">
                <tr><th>Alert Type</th><td>${alertType.replace(/_/g, ' ')}</td></tr>
                <tr><th>Severity</th><td>${severity}</td></tr>
                <tr><th>Timestamp</th><td>${details.timestamp.toLocaleString()}</td></tr>
                ${details.ipAddress ? `<tr><th>IP Address</th><td>${details.ipAddress}</td></tr>` : ''}
                ${details.location ? `<tr><th>Location</th><td>${details.location}</td></tr>` : ''}
                ${details.action ? `<tr><th>Action</th><td>${details.action}</td></tr>` : ''}
                ${details.resource ? `<tr><th>Resource</th><td>${details.resource}</td></tr>` : ''}
                ${details.deviceInfo ? `<tr><th>Device</th><td>${details.deviceInfo}</td></tr>` : ''}
              </table>

              <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px;">
                <strong>Recommended Actions:</strong>
                <ul style="margin: 10px 0 0 20px;">
                  <li>Review your recent account activity</li>
                  <li>Change your password if you suspect unauthorized access</li>
                  <li>Enable two-factor authentication if not already enabled</li>
                  <li>Contact support if you need assistance</li>
                </ul>
              </div>
            </div>
            <div class="footer">
              <p>This is an automated security alert from Squirli. If you did not perform this action, please contact our support team immediately.</p>
              <p>© 2024 Squirli. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: `"Squirli Security" <${process.env.EMAIL_FROM_ADDRESS || 'security@squirli.com'}>`,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject: `[SECURITY ALERT] ${subject}`,
        html: htmlContent,
        text: this.generateTextContent(data)
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`Security alert email sent successfully to ${Array.isArray(to) ? to.join(', ') : to}`);
      
      return true;
    } catch (error) {
      logger.error('Failed to send security alert email:', error);
      return false;
    }
  }

  // Send account activity summary
  static async sendActivitySummary(data: {
    to: string;
    userId: string;
    period: 'daily' | 'weekly' | 'monthly';
    summary: {
      totalReceipts: number;
      totalAmount: number;
      currency: string;
      categories: { [key: string]: number };
      securityEvents: number;
      lastLogin: Date;
    };
  }) {
    try {
      if (!this.transporter) {
        logger.warn('Email transporter not initialized, skipping activity summary');
        return false;
      }

      const { to, userId, period, summary } = data;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Activity Summary - Squirli</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
            .stat-card { background: white; padding: 15px; margin: 10px 0; border-radius: 4px; border-left: 4px solid #007bff; }
            .category-item { display: flex; justify-content: space-between; padding: 5px 0; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📊 Activity Summary</h1>
              <p>Your ${period} activity report</p>
            </div>
            <div class="content">
              <div class="stat-card">
                <h3>📋 Receipts</h3>
                <p><strong>Total Receipts:</strong> ${summary.totalReceipts}</p>
                <p><strong>Total Amount:</strong> ${summary.totalAmount} ${summary.currency}</p>
              </div>

              <div class="stat-card">
                <h3>📈 Spending by Category</h3>
                ${Object.entries(summary.categories).map(([category, amount]) => 
                  `<div class="category-item">
                    <span>${category}</span>
                    <span>${amount} ${summary.currency}</span>
                   </div>`
                ).join('')}
              </div>

              <div class="stat-card">
                <h3>🔒 Security</h3>
                <p><strong>Security Events:</strong> ${summary.securityEvents}</p>
                <p><strong>Last Login:</strong> ${summary.lastLogin.toLocaleString()}</p>
              </div>
            </div>
            <div class="footer">
              <p>This is your automated ${period} activity summary from Squirli.</p>
              <p>© 2024 Squirli. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: `"Squirli" <${process.env.EMAIL_FROM_ADDRESS || 'hello@squirli.com'}>`,
        to,
        subject: `Your ${period.charAt(0).toUpperCase() + period.slice(1)} Activity Summary - Squirli`,
        html: htmlContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`Activity summary email sent successfully to ${to}`);
      
      return true;
    } catch (error) {
      logger.error('Failed to send activity summary email:', error);
      return false;
    }
  }

  // Send password reset email
  static async sendPasswordReset(data: {
    to: string;
    resetToken: string;
    userId: string;
    expiresAt: Date;
  }) {
    try {
      if (!this.transporter) {
        logger.warn('Email transporter not initialized, skipping password reset email');
        return false;
      }

      const { to, resetToken, userId, expiresAt } = data;
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Password Reset - Squirli</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset Request</h1>
            </div>
            <div class="content">
              <p>You requested a password reset for your Squirli account.</p>
              
              <a href="${resetUrl}" class="button">Reset Password</a>
              
              <div class="warning">
                <strong>⚠️ Important:</strong>
                <ul>
                  <li>This link expires at ${expiresAt.toLocaleString()}</li>
                  <li>If you didn't request this reset, please ignore this email</li>
                  <li>For security, this link can only be used once</li>
                </ul>
              </div>
              
              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #007bff;">${resetUrl}</p>
            </div>
            <div class="footer">
              <p>This is an automated password reset request from Squirli.</p>
              <p>© 2024 Squirli. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: `"Squirli Security" <${process.env.EMAIL_FROM_ADDRESS || 'security@squirli.com'}>`,
        to,
        subject: 'Password Reset Request - Squirli',
        html: htmlContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`Password reset email sent successfully to ${to}`);
      
      return true;
    } catch (error) {
      logger.error('Failed to send password reset email:', error);
      return false;
    }
  }

  // Generate plain text content for emails
  private static generateTextContent(data: any): string {
    return `
Security Alert - Squirli

Alert Type: ${data.alertType}
Severity: ${data.severity}
Timestamp: ${data.details.timestamp.toLocaleString()}
${data.details.ipAddress ? `IP Address: ${data.details.ipAddress}` : ''}
${data.details.location ? `Location: ${data.details.location}` : ''}
${data.details.action ? `Action: ${data.details.action}` : ''}
${data.details.resource ? `Resource: ${data.details.resource}` : ''}

Recommended Actions:
- Review your recent account activity
- Change your password if you suspect unauthorized access
- Enable two-factor authentication if not already enabled
- Contact support if you need assistance

This is an automated security alert from Squirli.
    `.trim();
  }

  // Test email configuration
  static async testEmailConfiguration(to: string): Promise<boolean> {
    try {
      if (!this.transporter) {
        logger.error('Email transporter not initialized');
        return false;
      }

      const mailOptions = {
        from: `"Squirli Test" <${process.env.EMAIL_FROM_ADDRESS || 'test@squirli.com'}>`,
        to,
        subject: 'Email Configuration Test - Squirli',
        text: 'This is a test email to verify your email configuration is working correctly.',
        html: '<h1>Email Configuration Test</h1><p>This is a test email to verify your email configuration is working correctly.</p>'
      };

      await this.transporter.sendMail(mailOptions);
      logger.info('Email configuration test successful');
      return true;
    } catch (error) {
      logger.error('Email configuration test failed:', error);
      return false;
    }
  }
} 