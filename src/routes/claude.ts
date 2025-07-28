import { Router } from 'express';
import {
  testConnection,
  chat,
  getStats,
  getHistory,
  rateInteraction,
  getStatus,
  getConfig,
  getFullDisclaimer
} from '../controllers/claudeController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * @route   GET /api/v1/claude/test
 * @desc    Test Claude connection
 * @access  Public
 */
router.get('/test', testConnection);

/**
 * @route   GET /api/v1/claude/disclaimer
 * @desc    Get full disclaimer for first-time users
 * @access  Public
 */
router.get('/disclaimer', getFullDisclaimer);

/**
 * @route   POST /api/v1/claude/chat
 * @desc    Send a message to Claude (requires authentication)
 * @access  Private
 */
router.post('/chat', authenticateToken, chat);

/**
 * @route   GET /api/v1/claude/stats
 * @desc    Get AI interaction statistics
 * @access  Private
 */
router.get('/stats', authenticateToken, getStats);

/**
 * @route   GET /api/v1/claude/history
 * @desc    Get user interaction history
 * @access  Private
 */
router.get('/history', authenticateToken, getHistory);

/**
 * @route   POST /api/v1/claude/rate
 * @desc    Rate an AI interaction
 * @access  Private
 */
router.post('/rate', authenticateToken, rateInteraction);

/**
 * @route   GET /api/v1/claude/status
 * @desc    Get Claude service status
 * @access  Public
 */
router.get('/status', getStatus);

/**
 * @route   GET /api/v1/claude/config
 * @desc    Get Claude configuration (non-sensitive)
 * @access  Public
 */
router.get('/config', getConfig);

export default router; 