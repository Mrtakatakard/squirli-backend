import request from 'supertest';
import express from 'express';
import healthRoutes from '../../routes/health';

// Create test app
const app = express();
app.use('/health', healthRoutes);

describe('Health Endpoints Integration Tests', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/);

      // Should return either 200 (healthy) or 503 (unhealthy)
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('version');
      
      // Status should be either 'healthy' or 'unhealthy'
      expect(['healthy', 'unhealthy']).toContain(response.body.status);
    });

    it('should include service status', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.body.services).toHaveProperty('database');
      expect(response.body.services).toHaveProperty('redis');
      
      // Services should be either 'connected' or 'error'
      expect(['connected', 'error']).toContain(response.body.services.database);
      expect(['connected', 'error']).toContain(response.body.services.redis);
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed health information', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .expect('Content-Type', /json/);

      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('checks');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('uptime');
    });

    it('should include memory usage information', async () => {
      const response = await request(app)
        .get('/health/detailed');

      expect(response.body.memory).toHaveProperty('used');
      expect(response.body.memory).toHaveProperty('total');
      expect(response.body.memory).toHaveProperty('usage');
      
      // Memory usage should be a string ending with 'MB'
      expect(response.body.memory.used).toMatch(/\d+MB/);
      expect(response.body.memory.total).toMatch(/\d+MB/);
      expect(response.body.memory.usage).toMatch(/\d+%/);
    });

    it('should include uptime information', async () => {
      const response = await request(app)
        .get('/health/detailed');

      expect(response.body.uptime).toHaveProperty('seconds');
      expect(response.body.uptime).toHaveProperty('human');
      
      expect(typeof response.body.uptime.seconds).toBe('number');
      expect(response.body.uptime.human).toMatch(/\d+ minutes/);
    });

    it('should include service checks', async () => {
      const response = await request(app)
        .get('/health/detailed');

      expect(response.body.checks).toHaveProperty('database');
      expect(response.body.checks).toHaveProperty('redis');
      expect(response.body.checks).toHaveProperty('memory');
      expect(response.body.checks).toHaveProperty('uptime');
      
      // Checks should be boolean values
      expect(typeof response.body.checks.database).toBe('boolean');
      expect(typeof response.body.checks.redis).toBe('boolean');
      expect(typeof response.body.checks.memory).toBe('boolean');
      expect(typeof response.body.checks.uptime).toBe('number');
    });
  });

  describe('Error handling', () => {
    it('should handle invalid routes gracefully', async () => {
      await request(app)
        .get('/health/invalid')
        .expect(404);

      // Since we're only mounting /health routes, anything else should 404
      // This tests that our route structure is properly isolated
    });
  });
}); 