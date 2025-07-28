import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWTPayload, RefreshTokenPayload, PasswordStrength } from '../types/auth.types';

// Environment variables
const JWT_SECRET = process.env['JWT_SECRET'] || 'fallback-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env['JWT_REFRESH_SECRET'] || 'fallback-refresh-secret';
const JWT_EXPIRES_IN = process.env['JWT_EXPIRES_IN'] || '30m'; // 30 minutes for security
const JWT_REFRESH_EXPIRES_IN = process.env['JWT_REFRESH_EXPIRES_IN'] || '7d'; // 7 days max

// Salt rounds for bcrypt (higher = more secure but slower)
const SALT_ROUNDS = 12;

/**
 * Password Hashing Utilities
 */
export class PasswordUtils {
  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    try {
      const salt = await bcrypt.genSalt(SALT_ROUNDS);
      return await bcrypt.hash(password, salt);
    } catch (_error) {
      throw new Error('Error hashing password');
    }
  }

  /**
   * Verify a password against its hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (_error) {
      throw new Error('Error verifying password');
    }
  }

  /**
   * Validate password strength
   */
  static validatePasswordStrength(password: string): PasswordStrength {
    const requirements = {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)
    };

    const passedRequirements = Object.values(requirements).filter(Boolean).length;
    const score = Math.min(passedRequirements, 4); // 0-4 scale

    const suggestions: string[] = [];
    if (!requirements.minLength) suggestions.push('Use at least 8 characters');
    if (!requirements.hasUppercase) suggestions.push('Add uppercase letters');
    if (!requirements.hasLowercase) suggestions.push('Add lowercase letters');
    if (!requirements.hasNumber) suggestions.push('Add numbers');
    if (!requirements.hasSpecialChar) suggestions.push('Add special characters');

    let warning: string | undefined;
    if (score < 2) warning = 'Password is too weak';
    else if (score < 3) warning = 'Password could be stronger';

    return {
      score,
      feedback: { warning, suggestions },
      isValid: score >= 3, // Require at least 3/4 requirements
      requirements
    };
  }
}

/**
 * JWT Token Utilities
 */
export class JWTUtils {
  /**
   * Generate an access token
   */
  static generateAccessToken(payload: Omit<JWTPayload, 'type' | 'iat' | 'exp'>): string {
    const tokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      ...payload,
      type: 'access'
    };

    return jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN
    } as any);
  }

  /**
   * Generate a refresh token
   */
  static generateRefreshToken(payload: Omit<RefreshTokenPayload, 'type' | 'iat' | 'exp'>): string {
    const tokenPayload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
      ...payload,
      type: 'refresh'
    };

    return jwt.sign(tokenPayload, JWT_REFRESH_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRES_IN
    } as any);
  }

  /**
   * Verify an access token
   */
  static verifyAccessToken(token: string): JWTPayload {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;

      if (payload.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('TOKEN_EXPIRED');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('INVALID_TOKEN');
      }
      throw new Error('TOKEN_VERIFICATION_FAILED');
    }
  }

  /**
   * Verify a refresh token
   */
  static verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const payload = jwt.verify(token, JWT_REFRESH_SECRET) as RefreshTokenPayload;

      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('REFRESH_TOKEN_EXPIRED');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('INVALID_REFRESH_TOKEN');
      }
      throw new Error('REFRESH_TOKEN_VERIFICATION_FAILED');
    }
  }

  /**
   * Extract token from Authorization header
   */
  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }

  /**
   * Get token expiration time in seconds
   */
  static getTokenExpirationTime(): number {
    // Convert JWT_EXPIRES_IN to seconds
    const expiresIn = JWT_EXPIRES_IN;
    if (expiresIn.endsWith('d')) {
      return parseInt(expiresIn) * 24 * 60 * 60;
    }
    if (expiresIn.endsWith('h')) {
      return parseInt(expiresIn) * 60 * 60;
    }
    if (expiresIn.endsWith('m')) {
      return parseInt(expiresIn) * 60;
    }
    return parseInt(expiresIn); // Assume seconds
  }
}

/**
 * Session Utilities
 */
export class SessionUtils {
  /**
   * Generate a unique session ID
   */
  static generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Parse device info from User-Agent
   */
  static parseDeviceInfo(userAgent: string | undefined): { platform?: string; version?: string } {
    if (!userAgent) return {};

    // Basic parsing - you can enhance this with a library like 'user-agent'
    const isIOS = /iPhone|iPad|iPod/.test(userAgent);
    const isAndroid = /Android/.test(userAgent);
    const isWeb = /Mozilla/.test(userAgent) && !isIOS && !isAndroid;

    let platform = 'unknown';
    if (isIOS) platform = 'ios';
    else if (isAndroid) platform = 'android';
    else if (isWeb) platform = 'web';

    return { platform };
  }

  /**
   * Check if session is expired
   */
  static isSessionExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  }
}

/**
 * Validation Utilities
 */
export class ValidationUtils {
  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate Dominican phone number
   */
  static isValidDominicanPhone(phone: string): boolean {
    // Dominican phone format: +1-XXX-XXX-XXXX or similar variations
    const phoneRegex = /^(\+1[-\s]?)?(\()?[0-9]{3}(\))?[-\s]?[0-9]{3}[-\s]?[0-9]{4}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Sanitize user input
   */
  static sanitizeString(input: string): string {
    return input.trim().replace(/[<>]/g, '');
  }

  /**
   * Validate age (must be 18+)
   */
  static isValidAge(dateOfBirth: Date): boolean {
    const today = new Date();
    const age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
      return age - 1 >= 18;
    }
    return age >= 18;
  }
}

/**
 * Rate Limiting Utilities
 */
export class RateLimitUtils {
  /**
   * Generate rate limit key for Redis
   */
  static generateRateLimitKey(identifier: string, action: string): string {
    return `rate_limit:${action}:${identifier}`;
  }

  /**
   * Calculate reset time for rate limit
   */
  static calculateResetTime(windowMs: number): Date {
    return new Date(Date.now() + windowMs);
  }
} 