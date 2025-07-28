import { Router } from 'express';
import { UserController } from '../controllers/userController';

const router = Router();

// GET /api/v1/users/stats - Get user statistics
router.get('/stats', UserController.getUserStats);

// GET /api/v1/users/:id - Get user by ID
router.get('/:id', UserController.getUserById);

// Development/Testing endpoints
if (process.env['NODE_ENV'] !== 'production') {
  // POST /api/v1/users/test - Create test user
  router.post('/test', UserController.createTestUser);
  
  // DELETE /api/v1/users/test - Delete all test users
  router.delete('/test', UserController.deleteTestUsers);
}

export default router; 