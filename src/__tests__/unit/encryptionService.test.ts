import { EncryptionService } from '../../services/encryptionService';

describe('EncryptionService', () => {
  beforeEach(() => {
    // Set a test encryption key
    process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt data correctly', () => {
      const originalData = 'sensitive information';
      
      const encrypted = EncryptionService.encrypt(originalData);
      const decrypted = EncryptionService.decrypt(encrypted);
      
      expect(encrypted).not.toBe(originalData);
      expect(decrypted).toBe(originalData);
    });

    it('should handle empty string', () => {
      const originalData = '';
      
      const encrypted = EncryptionService.encrypt(originalData);
      const decrypted = EncryptionService.decrypt(encrypted);
      
      expect(decrypted).toBe(originalData);
    });

    it('should handle special characters', () => {
      const originalData = 'sensitive@data#with$special%chars&';
      
      const encrypted = EncryptionService.encrypt(originalData);
      const decrypted = EncryptionService.decrypt(encrypted);
      
      expect(decrypted).toBe(originalData);
    });

    it('should throw error for invalid encrypted data', () => {
      expect(() => {
        EncryptionService.decrypt('invalid-encrypted-data');
      }).toThrow('Failed to decrypt data');
    });

    it('should throw error for corrupted encrypted data', () => {
      const encrypted = EncryptionService.encrypt('test data');
      const corrupted = encrypted.substring(0, encrypted.length - 10);
      
      expect(() => {
        EncryptionService.decrypt(corrupted);
      }).toThrow('Failed to decrypt data');
    });
  });

  describe('hash and verify', () => {
    it('should hash data correctly', () => {
      const data = 'password123';
      const { hash, salt } = EncryptionService.hash(data);
      
      expect(hash).toBeDefined();
      expect(salt).toBeDefined();
      expect(hash).not.toBe(data);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should verify hash correctly', () => {
      const data = 'password123';
      const { hash, salt } = EncryptionService.hash(data);
      
      const isValid = EncryptionService.verifyHash(data, hash, salt);
      expect(isValid).toBe(true);
    });

    it('should reject invalid hash', () => {
      const data = 'password123';
      const { hash, salt } = EncryptionService.hash(data);
      
      const isValid = EncryptionService.verifyHash('wrongpassword', hash, salt);
      expect(isValid).toBe(false);
    });

    it('should use provided salt', () => {
      const data = 'password123';
      const customSalt = 'custom-salt';
      
      const { hash, salt } = EncryptionService.hash(data, customSalt);
      
      expect(salt).toBe(customSalt);
      expect(EncryptionService.verifyHash(data, hash, salt)).toBe(true);
    });
  });

  describe('generateSecureToken', () => {
    it('should generate secure token', () => {
      const token = EncryptionService.generateSecureToken();
      
      expect(token).toBeDefined();
      expect(token.length).toBe(64); // 32 bytes = 64 hex characters
      expect(/^[0-9a-f]+$/.test(token)).toBe(true);
    });

    it('should generate token with custom length', () => {
      const token = EncryptionService.generateSecureToken(16);
      
      expect(token).toBeDefined();
      expect(token.length).toBe(32); // 16 bytes = 32 hex characters
    });
  });

  describe('encryptSensitiveFields', () => {
    it('should encrypt specific fields', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'secret123',
        phone: '1234567890'
      };
      
      const fieldsToEncrypt = ['password', 'phone'];
      const encrypted = EncryptionService.encryptSensitiveFields(data, fieldsToEncrypt);
      
      expect(encrypted.name).toBe(data.name);
      expect(encrypted.email).toBe(data.email);
      expect(encrypted.password).not.toBe(data.password);
      expect(encrypted.phone).not.toBe(data.phone);
      expect(EncryptionService.isEncrypted(encrypted.password)).toBe(true);
      expect(EncryptionService.isEncrypted(encrypted.phone)).toBe(true);
    });

    it('should handle missing fields', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com'
      };
      
      const fieldsToEncrypt = ['password', 'phone'];
      const encrypted = EncryptionService.encryptSensitiveFields(data, fieldsToEncrypt);
      
      expect(encrypted.name).toBe(data.name);
      expect(encrypted.email).toBe(data.email);
      expect(encrypted.password).toBeUndefined();
      expect(encrypted.phone).toBeUndefined();
    });
  });

  describe('decryptSensitiveFields', () => {
    it('should decrypt specific fields', () => {
      const originalData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'secret123',
        phone: '1234567890'
      };
      
      const fieldsToEncrypt = ['password', 'phone'];
      const encrypted = EncryptionService.encryptSensitiveFields(originalData, fieldsToEncrypt);
      const decrypted = EncryptionService.decryptSensitiveFields(encrypted, fieldsToEncrypt);
      
      expect(decrypted.name).toBe(originalData.name);
      expect(decrypted.email).toBe(originalData.email);
      expect(decrypted.password).toBe(originalData.password);
      expect(decrypted.phone).toBe(originalData.phone);
    });

    it('should handle decryption failures gracefully', () => {
      const data = {
        name: 'John Doe',
        password: 'invalid-encrypted-data'
      };
      
      const fieldsToDecrypt = ['password'];
      const decrypted = EncryptionService.decryptSensitiveFields(data, fieldsToDecrypt);
      
      expect(decrypted.name).toBe(data.name);
      expect(decrypted.password).toBe(data.password); // Should keep original value
    });
  });

  describe('isEncrypted', () => {
    it('should identify encrypted data', () => {
      const originalData = 'sensitive data';
      const encrypted = EncryptionService.encrypt(originalData);
      
      expect(EncryptionService.isEncrypted(encrypted)).toBe(true);
    });

    it('should identify non-encrypted data', () => {
      expect(EncryptionService.isEncrypted('plain text')).toBe(false);
      expect(EncryptionService.isEncrypted('')).toBe(false);
      expect(EncryptionService.isEncrypted(null as any)).toBe(false);
      expect(EncryptionService.isEncrypted(undefined as any)).toBe(false);
    });
  });

  describe('generateEncryptionKey', () => {
    it('should generate encryption key', () => {
      const key = EncryptionService.generateEncryptionKey();
      
      expect(key).toBeDefined();
      expect(key.length).toBe(64); // 32 bytes = 64 hex characters
      expect(/^[0-9a-f]+$/.test(key)).toBe(true);
    });
  });
}); 