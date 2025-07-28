// Global Jest teardown - runs once after all tests
export default async function globalTeardown() {
  // eslint-disable-next-line no-console
  console.log('🧹 Cleaning up test environment...');
  
  // Clean up test environment
  // For example:
  // - Stop test database containers
  // - Clean up test files
  // - Reset test data
  
  // eslint-disable-next-line no-console
  console.log('✅ Test cleanup complete');
} 