const { loginUser } = require('../src/services/auth.service');
const { pool } = require('../src/config/db');
const bcrypt = require('bcrypt');

// Mock dependencies
jest.mock('../src/config/db', () => ({
  pool: {
    query: jest.fn()
  }
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn()
}));

describe('auth.service - loginUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return user details on successful login', async () => {
    // Arrange
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      password_hash: 'hashed_pw',
      role: 'admin'
    };
    
    pool.query.mockResolvedValueOnce({ rows: [mockUser] });
    bcrypt.compare.mockResolvedValueOnce(true);

    // Act
    const result = await loginUser('test@example.com', 'password123');

    // Assert
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id, email'),
      ['test@example.com']
    );
    expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed_pw');
    expect(result).toEqual({
      id: 1,
      email: 'test@example.com',
      role: 'admin'
    });
  });

  test('should throw "Invalid credentials" if user is not found', async () => {
    // Arrange: Mock empty database result
    pool.query.mockResolvedValueOnce({ rows: [] });

    // Act & Assert
    await expect(loginUser('wrong@example.com', 'any'))
      .rejects.toThrow('Invalid credentials');
    
    // Ensure bcrypt is never called if user doesn't exist (Efficiency/Security branch)
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  test('should throw "Invalid credentials" if password does not match', async () => {
    // Arrange
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      password_hash: 'hashed_pw',
      role: 'user'
    };
    
    pool.query.mockResolvedValueOnce({ rows: [mockUser] });
    bcrypt.compare.mockResolvedValueOnce(false); // Password mismatch

    // Act & Assert
    await expect(loginUser('test@example.com', 'wrong_password'))
      .rejects.toThrow('Invalid credentials');
  });
});