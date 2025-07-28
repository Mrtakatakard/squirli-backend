module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Root directory
  rootDir: './src',
  
  // Test match patterns
  testMatch: [
    '**/__tests__/**/*.test.ts'
  ],
  
  // File extensions to handle
  moduleFileExtensions: ['ts', 'js', 'json'],
  
  // Transform files with ts-jest
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json'
    }]
  },
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Timeout for tests
  testTimeout: 10000
}; 