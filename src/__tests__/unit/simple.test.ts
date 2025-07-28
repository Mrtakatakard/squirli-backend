// Simple test to verify Jest setup
describe('Simple Test Suite', () => {
  it('should run basic tests', () => {
    expect(true).toBe(true);
  });

  it('should handle basic math', () => {
    const sum = 2 + 2;
    expect(sum).toBe(4);
  });

  it('should work with async functions', async () => {
    const promise = Promise.resolve('success');
    const result = await promise;
    expect(result).toBe('success');
  });

  it('should handle TypeScript types', () => {
    interface TestInterface {
      name: string;
      value: number;
    }

    const testObject: TestInterface = {
      name: 'test',
      value: 42
    };

    expect(testObject.name).toBe('test');
    expect(testObject.value).toBe(42);
  });
}); 