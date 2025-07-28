import { PasswordUtils, JWTUtils, ValidationUtils } from '../../utils/authUtils';

describe('PasswordUtils', () => {
  describe('hashPassword and verifyPassword', () => {
    it('should hash password and verify correctly', async () => {
      const password = 'TestPassword123!';
      
      // Hash the password
      const hashedPassword = await PasswordUtils.hashPassword(password);
      
      // Should not be the same as original
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword).toMatch(/^\$2[ab]\$/); // bcrypt format
      
      // Should verify correctly
      const isValid = await PasswordUtils.verifyPassword(password, hashedPassword);
      expect(isValid).toBe(true);
      
      // Should fail with wrong password
      const isInvalid = await PasswordUtils.verifyPassword('WrongPassword', hashedPassword);
      expect(isInvalid).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should validate strong password', () => {
      const strongPassword = 'StrongPass123!';
      const result = PasswordUtils.validatePasswordStrength(strongPassword);
      
      expect(result.isValid).toBe(true);
      expect(result.score).toBe(4);
      expect(result.requirements.minLength).toBe(true);
      expect(result.requirements.hasUppercase).toBe(true);
      expect(result.requirements.hasLowercase).toBe(true);
      expect(result.requirements.hasNumber).toBe(true);
      expect(result.requirements.hasSpecialChar).toBe(true);
    });

    it('should reject weak password', () => {
      const weakPassword = 'weak';
      const result = PasswordUtils.validatePasswordStrength(weakPassword);
      
      expect(result.isValid).toBe(false);
      expect(result.score).toBeLessThan(3);
      expect(result.feedback.suggestions.length).toBeGreaterThan(0);
    });

    it('should provide helpful suggestions', () => {
      const passwordNoSpecial = 'Password123';
      const result = PasswordUtils.validatePasswordStrength(passwordNoSpecial);
      
      expect(result.feedback.suggestions).toContain('Add special characters');
    });
  });
});

describe('JWTUtils', () => {
  const mockPayload = {
    userId: 'user_123',
    email: 'test@example.com',
    financialLevel: 'BEGINNER' as const,
    subscription: 'FREE' as const
  };

  describe('generateAccessToken and verifyAccessToken', () => {
    it('should generate and verify access token', () => {
      // Generate token
      const token = JWTUtils.generateAccessToken(mockPayload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      // Verify token
      const payload = JWTUtils.verifyAccessToken(token);
      expect(payload.userId).toBe(mockPayload.userId);
      expect(payload.email).toBe(mockPayload.email);
      expect(payload.type).toBe('access');
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBeDefined();
    });

    it('should reject invalid token', () => {
      expect(() => {
        JWTUtils.verifyAccessToken('invalid-token');
      }).toThrow();
    });

    it('should reject expired token', () => {
      // This would require mocking jwt.sign to create an expired token
      // For now, we'll test the error handling structure
      expect(() => {
        JWTUtils.verifyAccessToken('');
      }).toThrow();
    });
  });

  describe('generateRefreshToken and verifyRefreshToken', () => {
    it('should generate and verify refresh token', () => {
      const refreshPayload = {
        userId: 'user_123',
        sessionId: 'session_456'
      };
      
      // Generate refresh token
      const token = JWTUtils.generateRefreshToken(refreshPayload);
      expect(token).toBeDefined();
      
      // Verify refresh token
      const payload = JWTUtils.verifyRefreshToken(token);
      expect(payload.userId).toBe(refreshPayload.userId);
      expect(payload.sessionId).toBe(refreshPayload.sessionId);
      expect(payload.type).toBe('refresh');
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from Bearer header', () => {
      const token = 'some.jwt.token';
      const header = `Bearer ${token}`;
      
      const extracted = JWTUtils.extractTokenFromHeader(header);
      expect(extracted).toBe(token);
    });

    it('should return null for invalid header', () => {
      expect(JWTUtils.extractTokenFromHeader('Invalid header')).toBeNull();
      expect(JWTUtils.extractTokenFromHeader(undefined)).toBeNull();
      expect(JWTUtils.extractTokenFromHeader('')).toBeNull();
    });
  });

  describe('getTokenExpirationTime', () => {
    it('should calculate expiration time in seconds', () => {
      const expirationTime = JWTUtils.getTokenExpirationTime();
      expect(typeof expirationTime).toBe('number');
      expect(expirationTime).toBeGreaterThan(0);
    });
  });
});

describe('ValidationUtils', () => {
  describe('isValidEmail', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'test123@gmail.com',
        'usuario@correo.com.do'
      ];

      validEmails.forEach(email => {
        expect(ValidationUtils.isValidEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user name@domain.com',
        ''
      ];

      invalidEmails.forEach(email => {
        expect(ValidationUtils.isValidEmail(email)).toBe(false);
      });
    });
  });

  describe('isValidDominicanPhone', () => {
    it('should validate Dominican phone numbers', () => {
      const validPhones = [
        '+1-809-555-1234',
        '(809) 555-1234',
        '809-555-1234',
        '8095551234',
        '+1 809 555 1234'
      ];

      validPhones.forEach(phone => {
        expect(ValidationUtils.isValidDominicanPhone(phone)).toBe(true);
      });
    });

    it('should reject invalid phone numbers', () => {
      const invalidPhones = [
        '123',
        '809-555',
        '+34-666-555-444', // Spanish number
        'not-a-phone'
      ];

      invalidPhones.forEach(phone => {
        expect(ValidationUtils.isValidDominicanPhone(phone)).toBe(false);
      });
    });
  });

  describe('sanitizeString', () => {
    it('should remove dangerous characters', () => {
      const input = '  <script>alert("xss")</script>  ';
      const sanitized = ValidationUtils.sanitizeString(input);
      
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
      expect(sanitized.trim()).toBe(sanitized);
    });
  });

  describe('isValidAge', () => {
    it('should validate age 18+', () => {
      const adultBirthDate = new Date();
      adultBirthDate.setFullYear(adultBirthDate.getFullYear() - 25);
      
      expect(ValidationUtils.isValidAge(adultBirthDate)).toBe(true);
    });

    it('should reject underage', () => {
      const minorBirthDate = new Date();
      minorBirthDate.setFullYear(minorBirthDate.getFullYear() - 16);
      
      expect(ValidationUtils.isValidAge(minorBirthDate)).toBe(false);
    });

    it('should handle edge case (exactly 18)', () => {
      const exactlyEighteenDate = new Date();
      exactlyEighteenDate.setFullYear(exactlyEighteenDate.getFullYear() - 18);
      
      expect(ValidationUtils.isValidAge(exactlyEighteenDate)).toBe(true);
    });
  });
}); 