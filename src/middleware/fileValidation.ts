import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';

// Allowed file types for receipts
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'application/pdf'
];

// File size limits (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// File signature validation (magic numbers)
const FILE_SIGNATURES = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
  'image/bmp': [0x42, 0x4D],
  'application/pdf': [0x25, 0x50, 0x44, 0x46]
};

// Validate file signature
function validateFileSignature(buffer: Buffer, expectedMimeType: string): boolean {
  const signature = FILE_SIGNATURES[expectedMimeType as keyof typeof FILE_SIGNATURES];
  if (!signature) return true; // Skip validation if no signature defined
  
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) {
      return false;
    }
  }
  return true;
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/receipts';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `receipt-${uniqueSuffix}${ext}`);
  }
});

// File filter function
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error(`File type ${file.mimetype} is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`));
  }
  
  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.pdf'];
  
  if (!allowedExtensions.includes(ext)) {
    return cb(new Error(`File extension ${ext} is not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`));
  }
  
  cb(null, true);
};

// Configure multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1 // Only allow 1 file per request
  }
});

// Middleware to validate uploaded files
export const validateUploadedFile = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'No file uploaded',
      message: 'Please upload a receipt image or PDF file'
    });
  }

  const file = req.file;
  
  // Additional validation
  if (file.size > MAX_FILE_SIZE) {
    // Remove uploaded file
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    
    return res.status(400).json({
      error: 'File too large',
      message: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`
    });
  }

  // Validate file signature
  try {
    const buffer = fs.readFileSync(file.path);
    if (!validateFileSignature(buffer, file.mimetype)) {
      // Remove uploaded file
      fs.unlinkSync(file.path);
      
      return res.status(400).json({
        error: 'Invalid file signature',
        message: 'File content does not match the declared file type'
      });
    }
  } catch (error) {
    // Remove uploaded file
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    
    return res.status(500).json({
      error: 'File validation failed',
      message: 'Unable to validate uploaded file'
    });
  }

  // Add file info to request
  req.fileInfo = {
    originalName: file.originalname,
    filename: file.filename,
    path: file.path,
    size: file.size,
    mimetype: file.mimetype,
    uploadedAt: new Date()
  };

  next();
};

// Cleanup middleware to remove files on error
export const cleanupUploadedFile = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // If response is an error, cleanup the uploaded file
    if (res.statusCode >= 400 && req.file && req.file.path) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (error) {
        console.error('Error cleaning up uploaded file:', error);
      }
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

// Get file info for logging
export const getFileInfo = (file: Express.Multer.File) => {
  return {
    originalName: file.originalname,
    filename: file.filename,
    size: file.size,
    mimetype: file.mimetype,
    path: file.path
  };
}; 