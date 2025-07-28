// Authentication request interfaces
export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: Date;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
  financialLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  language?: 'SPANISH' | 'ENGLISH' | 'FRENCH';
  currency?: 'DOP' | 'USD' | 'EUR' | 'MXN' | 'COP';
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

// Authentication response interfaces
export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: UserProfile;
    tokens: AuthTokens;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  profileImage?: string;
  financialLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  subscription: 'FREE' | 'PERSONAL' | 'ADVANCED' | 'FAMILY' | 'BUSINESS';
  language: 'SPANISH' | 'ENGLISH' | 'FRENCH';
  currency: 'DOP' | 'USD' | 'EUR' | 'MXN' | 'COP';
  emailVerified: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
  tokenType: 'Bearer';
}

// JWT payload interfaces
export interface JWTPayload {
  userId: string;
  email: string;
  financialLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  subscription: 'FREE' | 'PERSONAL' | 'ADVANCED' | 'FAMILY' | 'BUSINESS';
  type: 'access' | 'refresh';
  iat: number; // issued at
  exp: number; // expires at
}

export interface RefreshTokenPayload {
  userId: string;
  sessionId: string;
  type: 'refresh';
  iat: number;
  exp: number;
}

// Session management
export interface UserSession {
  id: string;
  userId: string;
  refreshToken: string;
  deviceInfo?: {
    userAgent?: string;
    platform?: string;
    version?: string;
  };
  ipAddress?: string;
  isActive: boolean;
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt: Date;
}

// Password validation
export interface PasswordStrength {
  score: number; // 0-4 (weak to strong)
  feedback: {
    warning?: string | undefined;
    suggestions: string[];
  };
  isValid: boolean;
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
  };
}

// Error types
export interface AuthError {
  code: string;
  message: string;
  field?: string;
}

export type AuthErrorCode = 
  | 'INVALID_CREDENTIALS'
  | 'USER_NOT_FOUND'
  | 'EMAIL_ALREADY_EXISTS'
  | 'WEAK_PASSWORD'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'SESSION_EXPIRED'
  | 'ACCOUNT_LOCKED'
  | 'EMAIL_NOT_VERIFIED'
  | 'RATE_LIMIT_EXCEEDED';

// Validation schemas (to be used with Joi)
export interface ValidationResult {
  isValid: boolean;
  errors: AuthError[];
}

// Middleware types
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    financialLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    subscription: 'FREE' | 'PERSONAL' | 'ADVANCED' | 'FAMILY' | 'BUSINESS';
  };
}

// Rate limiting
export interface RateLimitConfig {
  windowMs: number; // time window in milliseconds
  maxRequests: number; // max requests per window
  message: string;
  skipSuccessfulRequests?: boolean;
}

// Dominican Republic specific
export interface DominicanUserData {
  cedula?: string; // Dominican ID number
  phoneCountryCode: '+1'; // Dominican Republic code
  preferredLanguage: 'SPANISH';
  defaultCurrency: 'DOP';
  timezone: 'America/Santo_Domingo';
} 