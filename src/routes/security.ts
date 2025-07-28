import { Router } from 'express';
import { SecurityController } from '../controllers/securityController';
import { authenticateToken } from '../middleware/auth';
import { ValidationService } from '../services/validationService';

const router = Router();

// Apply authentication to all security routes
router.use(authenticateToken);

// 2FA Routes
router.get('/2fa/setup', SecurityController.get2FASetup);
router.post('/2fa/enable', SecurityController.enable2FA);
router.post('/2fa/disable', SecurityController.disable2FA);
router.post('/2fa/verify', SecurityController.verify2FA);
router.post('/2fa/backup-codes/regenerate', SecurityController.regenerateBackupCodes);

// Security Settings Routes
router.get('/settings', SecurityController.getSecuritySettings);
router.put('/settings', SecurityController.updateSecuritySettings);

// Security Activity Routes
router.get('/activity', SecurityController.getSecurityActivity);

export default router; 