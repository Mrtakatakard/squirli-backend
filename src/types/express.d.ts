import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        [key: string]: any;
      };
      clientIP?: string;
      file?: {
        originalname: string;
        filename: string;
        path: string;
        size: number;
        mimetype: string;
      };
      fileInfo?: {
        originalName: string;
        filename: string;
        path: string;
        size: number;
        mimetype: string;
        uploadedAt: Date;
      };
    }
  }
} 