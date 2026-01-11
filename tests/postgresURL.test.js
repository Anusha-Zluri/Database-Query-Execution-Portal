const { buildDbUrl } = require('../src/utils/postgresUrl');

describe('postgresURL utility', () => {
  
  test('should correctly append dbName to the baseUrl', () => {
    const baseUrl = 'postgres://user:pass@localhost:5432';
    const dbName = 'my_database';
    
    const result = buildDbUrl(baseUrl, dbName);
    
    expect(result).toBe('postgres://user:pass@localhost:5432/my_database');
  });

  test('should throw error if dbName is "template0"', () => {
    const baseUrl = 'postgres://localhost:5432';
    const dbName = 'template0';
    
    expect(() => {
      buildDbUrl(baseUrl, dbName);
    }).toThrow('System database access denied');
  });

  test('should throw error if dbName is "template1"', () => {
    const baseUrl = 'postgres://localhost:5432';
    const dbName = 'template1';
    
    expect(() => {
      buildDbUrl(baseUrl, dbName);
    }).toThrow('System database access denied');
  });

  test('should throw error if baseUrl is invalid', () => {
    const baseUrl = 'not-a-url';
    const dbName = 'testdb';
    
    // Testing the built-in URL constructor's error handling
    expect(() => {
      buildDbUrl(baseUrl, dbName);
    }).toThrow();
  });

  test('should handle baseUrl with existing trailing slash', () => {
    const baseUrl = 'postgres://localhost:5432/';
    const dbName = 'testdb';
    
    const result = buildDbUrl(baseUrl, dbName);
    
    expect(result).toBe('postgres://localhost:5432/testdb');
  });
});