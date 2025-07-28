import express from 'express';
import { ReceiptController } from '../controllers/receiptController';
import { authenticateToken } from '../middleware/auth';
import { uploadLimiter, ocrLimiter } from '../middleware/rateLimit';
import { 
  validateReceiptUpload, 
  validateReceiptUpdate, 
  validateReceiptId, 
  validatePagination,
  validateCategorySuggestion 
} from '../middleware/validation';

const router = express.Router();

// Apply rate limiting and validation to upload endpoint
router.post('/upload', uploadLimiter, authenticateToken, validateReceiptUpload, ReceiptController.uploadReceipt);

// Apply rate limiting and validation to OCR endpoint
router.post('/:id/ocr', ocrLimiter, authenticateToken, validateReceiptId, ReceiptController.processOCR);

// Regular endpoints with validation
router.get('/', authenticateToken, validatePagination, ReceiptController.getReceipts);
router.get('/stats', authenticateToken, ReceiptController.getReceiptStats);
router.get('/options', authenticateToken, ReceiptController.getReceiptOptions);
router.get('/insights', authenticateToken, ReceiptController.getReceiptInsights);
router.get('/analytics', authenticateToken, ReceiptController.getReceiptAnalytics);
router.post('/suggest-category', authenticateToken, validateCategorySuggestion, ReceiptController.suggestCategory);
router.get('/:id', authenticateToken, validateReceiptId, ReceiptController.getReceiptById);
router.put('/:id', authenticateToken, validateReceiptUpdate, ReceiptController.updateReceipt);
router.delete('/:id', authenticateToken, validateReceiptId, ReceiptController.deleteReceipt);

export default router; 