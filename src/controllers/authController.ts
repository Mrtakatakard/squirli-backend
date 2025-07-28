import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';
import { 
  RegisterRequest, 
  LoginRequest, 
  AuthResponse, 
  UserProfile, 
  AuthTokens
} from '../types/auth.types';
import { 
  PasswordUtils, 
  JWTUtils, 
  ValidationUtils, 
  SessionUtils 
} from '../utils/authUtils';

const prisma = new PrismaClient();

export class AuthController {
  /**
   * Register a new user
   * POST /api/v1/auth/register
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const {
        email,
        password,
        firstName,
        lastName,
        phone,
        dateOfBirth,
        gender,
        financialLevel = 'BEGINNER',
        language = 'SPANISH',
        currency = 'DOP'
      }: RegisterRequest = req.body;

      // Input validation
      if (!email || !password || !firstName || !lastName) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields',
          errors: [
            { field: 'email', message: 'Email is required' },
            { field: 'password', message: 'Password is required' },
            { field: 'firstName', message: 'First name is required' },
            { field: 'lastName', message: 'Last name is required' }
          ]
        });
        return;
      }

      // Validate email format
      if (!ValidationUtils.isValidEmail(email)) {
        res.status(400).json({
          success: false,
          message: 'Invalid email format',
          errors: [{ field: 'email', message: 'Please provide a valid email address' }]
        });
        return;
      }

      // Validate password strength
      const passwordValidation = PasswordUtils.validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        res.status(400).json({
          success: false,
          message: 'Password does not meet requirements',
          errors: [{ 
            field: 'password', 
            message: passwordValidation.feedback.warning || 'Password is too weak',
            suggestions: passwordValidation.feedback.suggestions
          }]
        });
        return;
      }

      // Validate phone number (if provided)
      if (phone && !ValidationUtils.isValidDominicanPhone(phone)) {
        res.status(400).json({
          success: false,
          message: 'Invalid phone number format',
          errors: [{ field: 'phone', message: 'Please provide a valid Dominican phone number' }]
        });
        return;
      }

      // Validate age (if provided)
      if (dateOfBirth && !ValidationUtils.isValidAge(new Date(dateOfBirth))) {
        res.status(400).json({
          success: false,
          message: 'User must be 18 years or older',
          errors: [{ field: 'dateOfBirth', message: 'You must be at least 18 years old to register' }]
        });
        return;
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (existingUser) {
        res.status(409).json({
          success: false,
          message: 'User already exists',
          errors: [{ field: 'email', message: 'An account with this email already exists' }]
        });
        return;
      }

      // Hash password
      const hashedPassword = await PasswordUtils.hashPassword(password);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          password: hashedPassword,
          firstName: ValidationUtils.sanitizeString(firstName),
          lastName: ValidationUtils.sanitizeString(lastName),
          phone: phone || null,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          gender: gender || null,
          financialLevel,
          language,
          currency,
          subscription: 'FREE',
          notifications: true,
          emailVerified: false
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          profileImage: true,
          financialLevel: true,
          subscription: true,
          language: true,
          currency: true,
          emailVerified: true,
          createdAt: true,
          lastLoginAt: true
        }
      });

      // Generate tokens
      const sessionId = SessionUtils.generateSessionId();
      const deviceInfo = SessionUtils.parseDeviceInfo(req.headers['user-agent']);
      
      const accessToken = JWTUtils.generateAccessToken({
        userId: user.id,
        email: user.email,
        financialLevel: user.financialLevel,
        subscription: user.subscription
      });

      const refreshToken = JWTUtils.generateRefreshToken({
        userId: user.id,
        sessionId
      });

      // Create user session
      const sessionExpiresAt = new Date();
      sessionExpiresAt.setDate(sessionExpiresAt.getDate() + 7); // 7 days

      await prisma.userSession.create({
        data: {
          userId: user.id,
          token: accessToken,
          refreshToken,
          deviceInfo: deviceInfo as any,
          ipAddress: req.ip || null,
          userAgent: req.headers['user-agent'] || null,
          isActive: true,
          expiresAt: sessionExpiresAt
        }
      });

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });

      // Prepare response
      const userProfile: UserProfile = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        ...(user.phone && { phone: user.phone }),
        ...(user.profileImage && { profileImage: user.profileImage }),
        financialLevel: user.financialLevel,
        subscription: user.subscription,
        language: user.language,
        currency: user.currency,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        ...(user.lastLoginAt && { lastLoginAt: user.lastLoginAt })
      };

      const tokens: AuthTokens = {
        accessToken,
        refreshToken,
        expiresIn: JWTUtils.getTokenExpirationTime(),
        tokenType: 'Bearer'
      };

      const response: AuthResponse = {
        success: true,
        message: 'User registered successfully',
        data: {
          user: userProfile,
          tokens
        }
      };

      res.status(201).json(response);

    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during registration',
        errors: [{ message: 'Please try again later' }]
      });
    }
  }

  /**
   * Login user
   * POST /api/v1/auth/login
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, rememberMe = false }: LoginRequest = req.body;

      // Input validation
      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Email and password are required',
          errors: [
            { field: 'email', message: 'Email is required' },
            { field: 'password', message: 'Password is required' }
          ]
        });
        return;
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        include: {
          userSessions: {
            where: { isActive: true }
          }
        }
      });

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Invalid credentials',
          errors: [{ message: 'Email or password is incorrect' }]
        });
        return;
      }

      // Verify password
      const isValidPassword = await PasswordUtils.verifyPassword(password, user.password);
      if (!isValidPassword) {
        res.status(401).json({
          success: false,
          message: 'Invalid credentials',
          errors: [{ message: 'Email or password is incorrect' }]
        });
        return;
      }

      // Generate new tokens
      const sessionId = SessionUtils.generateSessionId();
      const deviceInfo = SessionUtils.parseDeviceInfo(req.headers['user-agent']);
      
      const accessToken = JWTUtils.generateAccessToken({
        userId: user.id,
        email: user.email,
        financialLevel: user.financialLevel,
        subscription: user.subscription
      });

      const refreshToken = JWTUtils.generateRefreshToken({
        userId: user.id,
        sessionId
      });

      // Create new session
      const sessionExpiresAt = new Date();
      const expirationDays = rememberMe ? 30 : 7;
      sessionExpiresAt.setDate(sessionExpiresAt.getDate() + expirationDays);

      await prisma.userSession.create({
        data: {
          userId: user.id,
          token: accessToken,
          refreshToken,
          deviceInfo: deviceInfo as any,
          ipAddress: req.ip || null,
          userAgent: req.headers['user-agent'] || null,
          isActive: true,
          expiresAt: sessionExpiresAt
        }
      });

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });

      // Prepare response
      const userProfile: UserProfile = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        ...(user.phone && { phone: user.phone }),
        ...(user.profileImage && { profileImage: user.profileImage }),
        financialLevel: user.financialLevel,
        subscription: user.subscription,
        language: user.language,
        currency: user.currency,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        lastLoginAt: new Date()
      };

      const tokens: AuthTokens = {
        accessToken,
        refreshToken,
        expiresIn: JWTUtils.getTokenExpirationTime(),
        tokenType: 'Bearer'
      };

      const response: AuthResponse = {
        success: true,
        message: 'Login successful',
        data: {
          user: userProfile,
          tokens
        }
      };

      res.status(200).json(response);

    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during login',
        errors: [{ message: 'Please try again later' }]
      });
    }
  }

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh
   */
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: 'Refresh token is required',
          errors: [{ field: 'refreshToken', message: 'Refresh token is required' }]
        });
        return;
      }

      // Verify refresh token
      let payload;
      try {
        payload = JWTUtils.verifyRefreshToken(refreshToken);
          } catch (_error) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
        errors: [{ message: 'Please login again' }]
      });
      return;
    }

      // Find session
      const session = await prisma.userSession.findFirst({
        where: {
          userId: payload.userId,
          refreshToken,
          isActive: true
        },
        include: {
          user: true
        }
      });

      if (!session || SessionUtils.isSessionExpired(session.expiresAt)) {
        res.status(401).json({
          success: false,
          message: 'Session expired',
          errors: [{ message: 'Please login again' }]
        });
        return;
      }

      // Generate new access token
      const newAccessToken = JWTUtils.generateAccessToken({
        userId: session.user.id,
        email: session.user.email,
        financialLevel: session.user.financialLevel,
        subscription: session.user.subscription
      });

      // TOKEN ROTATION: Generate new refresh token
      const newSessionId = SessionUtils.generateSessionId();
      const newRefreshToken = JWTUtils.generateRefreshToken({
        userId: session.user.id,
        sessionId: newSessionId
      });

      // Update session with new tokens (ROTATION)
      await prisma.userSession.update({
        where: { id: session.id },
        data: { 
          token: newAccessToken,
          refreshToken: newRefreshToken, // NEW: Rotate refresh token
          updatedAt: new Date()
        }
      });

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken, // NEW: Return new refresh token
          expiresIn: JWTUtils.getTokenExpirationTime(),
          tokenType: 'Bearer'
        }
      });

    } catch (error) {
      logger.error('Token refresh error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during token refresh',
        errors: [{ message: 'Please try again later' }]
      });
    }
  }

  /**
   * Logout user
   * POST /api/v1/auth/logout
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedReq = req as any;
      const userId = authenticatedReq.user.id;
      const authHeader = (req.headers as any).authorization;
      const token = JWTUtils.extractTokenFromHeader(authHeader);

      if (token) {
        // Deactivate current session
        await prisma.userSession.updateMany({
          where: {
            userId,
            token,
            isActive: true
          },
          data: {
            isActive: false,
            updatedAt: new Date()
          }
        });
      }

      res.status(200).json({
        success: true,
        message: 'Logout successful'
      });

    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during logout',
        errors: [{ message: 'Please try again later' }]
      });
    }
  }

  /**
   * Logout from all devices
   * POST /api/v1/auth/logout-all
   */
  static async logoutAll(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedReq = req as any;
      const userId = authenticatedReq.user.id;

      // Deactivate all sessions for user
      await prisma.userSession.updateMany({
        where: {
          userId,
          isActive: true
        },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      });

      res.status(200).json({
        success: true,
        message: 'Logged out from all devices successfully'
      });

    } catch (error) {
      logger.error('Logout all error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during logout',
        errors: [{ message: 'Please try again later' }]
      });
    }
  }

  /**
   * Get current user profile
   * GET /api/v1/auth/me
   */
  static async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedReq = req as any;
      const userId = authenticatedReq.user.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          profileImage: true,
          financialLevel: true,
          subscription: true,
          language: true,
          currency: true,
          emailVerified: true,
          createdAt: true,
          lastLoginAt: true
        }
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
          errors: [{ message: 'User account may have been deleted' }]
        });
        return;
      }

      const userProfile: UserProfile = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        ...(user.phone && { phone: user.phone }),
        ...(user.profileImage && { profileImage: user.profileImage }),
        financialLevel: user.financialLevel,
        subscription: user.subscription,
        language: user.language,
        currency: user.currency,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        ...(user.lastLoginAt && { lastLoginAt: user.lastLoginAt })
      };

      res.status(200).json({
        success: true,
        message: 'User profile retrieved successfully',
        data: { user: userProfile }
      });

    } catch (error) {
      logger.error('Get current user error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        errors: [{ message: 'Please try again later' }]
      });
    }
  }
} 