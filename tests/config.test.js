/**
 * config.test.js
 *
 * Covers:
 * - src/config/db.js
 * - src/config/jwt.js
 */

jest.mock('pg', () => {
  const mPool = {
    query: jest.fn()
  };
  return {
    Pool: jest.fn(() => mPool)
  };
});

describe('config/db.js', () => {
  let pool;
  let testConnection;

  beforeEach(() => {
    jest.resetModules(); // reset require cache
    ({ pool, testConnection } = require('../src/config/db'));
  });

  test('creates pg Pool with correct defaults', () => {
    const { Pool } = require('pg');
    expect(Pool).toHaveBeenCalledTimes(1);
  });

  test('testConnection executes SELECT 1', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

    await testConnection();

    expect(pool.query).toHaveBeenCalledWith('SELECT 1');
  });

  test('testConnection throws if query fails', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB down'));

    await expect(testConnection()).rejects.toThrow('DB down');
  });
});

describe('config/jwt.js', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test('uses JWT_SECRET from environment', () => {
    process.env.JWT_SECRET = 'super-secret';

    const jwtConfig = require('../src/config/jwt');

    expect(jwtConfig.secret).toBe('super-secret');
  });

  test('defaults expiresIn to 1h', () => {
    delete process.env.JWT_EXPIRES_IN;

    const jwtConfig = require('../src/config/jwt');

    expect(jwtConfig.expiresIn).toBe('1h');
  });

  test('uses JWT_EXPIRES_IN when provided', () => {
    process.env.JWT_EXPIRES_IN = '2d';

    const jwtConfig = require('../src/config/jwt');

    expect(jwtConfig.expiresIn).toBe('2d');
  });
});
