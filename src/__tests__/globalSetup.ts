// Global Jest setup - runs once before all tests
export default async function globalSetup() {
  // eslint-disable-next-line no-console
  console.log('🧪 Setting up test environment...');
  
  // Set test environment variables
  process.env['NODE_ENV'] = 'test';
  process.env['DATABASE_URL'] = process.env['TEST_DATABASE_URL'] || 'postgresql://test_user:test_password@localhost:5433/test_db';
  process.env['REDIS_URL'] = process.env['TEST_REDIS_URL'] || 'redis://localhost:6380';
  
  // You can add database setup, test containers, etc. here
  // For example:
  // - Start test database containers
  // - Run database migrations
  // - Seed test data
  
  // eslint-disable-next-line no-console
  console.log('✅ Test environment ready');
} 