import { Request, Response, NextFunction } from 'express';
import '../types/express.d';
import { IPBlacklistService } from '../services/ipBlacklistService';

// Get client IP address
function getClientIP(req: Request): string {
  // Check for forwarded headers (when behind proxy/load balancer)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return ips.split(',')[0].trim();
  }

  // Check for real IP header
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP;
  }

  // Fallback to connection remote address
  return req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
}

// IP Blacklist middleware
export const checkIPBlacklist = async (req: Request, res: Response, next: NextFunction) => {
  const clientIP = getClientIP(req);
  
  if (clientIP === 'unknown') {
    return res.status(400).json({
      error: 'Unable to determine client IP address'
    });
  }

  // Check if IP is blacklisted
  if (IPBlacklistService.isBlacklisted(clientIP)) {
    const reason = IPBlacklistService.getBlacklistReason(clientIP);
    
    // Log the blocked request
    const { AuditService } = await import('../services/auditService');
    await AuditService.logSecurityEvent({
      action: 'UNAUTHORIZED_ACCESS',
      ipAddress: clientIP,
      severity: 'MEDIUM',
      details: {
        reason: reason || 'IP blacklisted',
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method
      }
    });

    return res.status(403).json({
      error: 'Access denied',
      message: 'Your IP address has been blocked due to suspicious activity',
      reason: reason || 'IP blacklisted'
    });
  }

  // Add IP to request for logging
  req.clientIP = clientIP;
  next();
  return null;
};

// Middleware to track suspicious activity
export const trackSuspiciousActivity = async (req: Request, res: Response, next: NextFunction) => {
  const clientIP = getClientIP(req);
  
  // Track failed login attempts
  if (req.path.includes('/auth/login') && req.method === 'POST') {
    const originalSend = res.send;
    
    res.send = function(data) {
      if (res.statusCode === 401 || res.statusCode === 400) {
        // Failed login attempt
        IPBlacklistService.handleSuspiciousActivity({
          ipAddress: clientIP,
          activity: 'LOGIN_FAILED',
          count: 1, // This would be tracked in a more sophisticated way
          threshold: 5,
          details: {
            path: req.path,
            userAgent: req.headers['user-agent']
          }
        });
      }
      
      return originalSend.call(this, data);
    };
  }

  // Track rate limit violations
  if (res.statusCode === 429) {
    IPBlacklistService.handleSuspiciousActivity({
      ipAddress: clientIP,
      activity: 'RATE_LIMIT_EXCEEDED',
      count: 1,
      threshold: 3,
      details: {
        path: req.path,
        method: req.method,
        userAgent: req.headers['user-agent']
      }
    });
  }

  next();
};

// Middleware to track file upload violations
export const trackFileUploadViolations = async (req: Request, res: Response, next: NextFunction) => {
  const clientIP = getClientIP(req);
  
  if (req.file && req.path.includes('/upload')) {
    const originalSend = res.send;
    
    res.send = function(data) {
      if (res.statusCode >= 400) {
        // File upload violation
        IPBlacklistService.handleSuspiciousActivity({
          ipAddress: clientIP,
          activity: 'FILE_UPLOAD_VIOLATION',
          count: 1,
          threshold: 3,
          details: {
            path: req.path,
            fileInfo: req.file ? {
              originalName: req.file.originalname,
              mimetype: req.file.mimetype,
              size: req.file.size
            } : null,
            userAgent: req.headers['user-agent']
          }
        });
      }
      
      return originalSend.call(this, data);
    };
  }

  next();
};

// Initialize blacklist cache on startup
export const initializeBlacklist = async () => {
  await IPBlacklistService.initializeCache();
  
  // Set up periodic cleanup
  setInterval(async () => {
    await IPBlacklistService.cleanupExpiredEntries();
  }, 60 * 60 * 1000); // Clean up every hour
}; 