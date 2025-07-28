import crypto from 'crypto';
import logger from '../utils/logger';

export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 16; // 128 bits
  private static readonly TAG_LENGTH = 16; // 128 bits
  private static readonly SALT_LENGTH = 64; // 512 bits
  
  // Static key for tests to ensure consistency
  private static testKey: Buffer | null = null;

  // Get encryption key from environment or generate one
  private static getEncryptionKey(): Buffer {
    // For tests, use the key from environment if available, otherwise generate one
    if (process.env.NODE_ENV === 'test') {
      const envKey = process.env.ENCRYPTION_KEY;
      if (envKey) {
        try {
          const keyBuffer = Buffer.from(envKey, 'hex');
          if (keyBuffer.length === 32) {
            return keyBuffer;
          }
        } catch (error) {
          // Fall through to generate new key
        }
      }
      // Use static test key for consistency
      if (!this.testKey) {
        this.testKey = crypto.randomBytes(32);
      }
      return this.testKey;
    }

    const envKey = process.env.ENCRYPTION_KEY;
    if (envKey) {
      try {
        // Use existing key from environment
        const keyBuffer = Buffer.from(envKey, 'hex');
        if (keyBuffer.length !== 32) {
          throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes for AES-256-GCM)');
        }
        return keyBuffer;
      } catch (error) {
        throw new Error('ENCRYPTION_KEY is invalid hex or wrong length. It must be a 64-character hex string (32 bytes for AES-256-GCM)');
      }
    }

    // Generate a new key (for development only)
    const key = crypto.randomBytes(32);
    logger.warn('ENCRYPTION_KEY not found in environment. Generated new key for development.');
    logger.warn(`Please set ENCRYPTION_KEY=${key.toString('hex')} in your .env file (must be 64 hex chars)`);
    return key;
  }

  // Encrypt sensitive data
  static encrypt(data: string): string {
    try {
      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(this.IV_LENGTH);

      // Create cipher
      const cipher = crypto.createCipheriv(this.ALGORITHM, iv, key);

      // Encrypt data
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag
      const tag = cipher.getAuthTag();

      // Combine all components: iv + tag + encrypted
      const result = iv.toString('hex') + ':' + 
                    tag.toString('hex') + ':' + 
                    encrypted;

      return result;
    } catch (error) {
      logger.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  // Decrypt sensitive data
  static decrypt(encryptedData: string): string {
    try {
      const key = this.getEncryptionKey();
      
      // Split the encrypted data
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const [ivHex, tagHex, encrypted] = parts;
      
      // Convert hex strings back to buffers
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');

      // Create decipher
      const decipher = crypto.createDecipheriv(this.ALGORITHM, iv, key);
      decipher.setAuthTag(tag);

      // Decrypt data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  // Hash sensitive data (one-way encryption)
  static hash(data: string, salt?: string): { hash: string; salt: string } {
    try {
      const useSalt = salt || crypto.randomBytes(32).toString('hex');
      const hash = crypto.pbkdf2Sync(data, useSalt, 10000, 64, 'sha512').toString('hex');
      
      return {
        hash,
        salt: useSalt
      };
    } catch (error) {
      logger.error('Hashing failed:', error);
      throw new Error('Failed to hash data');
    }
  }

  // Verify hash
  static verifyHash(data: string, hash: string, salt: string): boolean {
    try {
      const { hash: computedHash } = this.hash(data, salt);
      return crypto.timingSafeEqual(
        Buffer.from(hash, 'hex'),
        Buffer.from(computedHash, 'hex')
      );
    } catch (error) {
      logger.error('Hash verification failed:', error);
      return false;
    }
  }

  // Generate secure random string
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Encrypt specific sensitive fields
  static encryptSensitiveFields(data: any, fieldsToEncrypt: string[]): any {
    const encrypted = { ...data };
    
    for (const field of fieldsToEncrypt) {
      if (encrypted[field] && typeof encrypted[field] === 'string') {
        encrypted[field] = this.encrypt(encrypted[field]);
      }
    }
    
    return encrypted;
  }

  // Decrypt specific sensitive fields
  static decryptSensitiveFields(data: any, fieldsToDecrypt: string[]): any {
    const decrypted = { ...data };
    
    for (const field of fieldsToDecrypt) {
      if (decrypted[field] && typeof decrypted[field] === 'string') {
        try {
          decrypted[field] = this.decrypt(decrypted[field]);
        } catch (error) {
          logger.warn(`Failed to decrypt field ${field}:`, error);
          // Keep original value if decryption fails
        }
      }
    }
    
    return decrypted;
  }

  // Check if data is encrypted
  static isEncrypted(data: string): boolean {
    if (!data || typeof data !== 'string') return false;
    
    const parts = data.split(':');
    return parts.length === 4 && 
           parts.every(part => /^[0-9a-f]+$/i.test(part));
  }

  // Generate encryption key for environment
  static generateEncryptionKey(): string {
    return crypto.randomBytes(this.KEY_LENGTH).toString('hex');
  }
} 