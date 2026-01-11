const jwt = require('jsonwebtoken');
const authMiddleware = require('../src/middlewares/auth.middleware');

jest.mock('jsonwebtoken');

describe('auth.middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    process.env.JWT_SECRET = 'test-secret';
  });

  test('401 if Authorization header is missing', () => {
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Missing Authorization header' });
  });

  test('401 if Authorization header does not start with Bearer', () => {
    req.headers.authorization = 'Basic 12345';
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('calls next() and sets req.user for valid token', () => {
    const mockUser = { id: 1, name: 'Test' };
    req.headers.authorization = 'Bearer valid-token';
    jwt.verify.mockReturnValue(mockUser);

    authMiddleware(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalled();
  });

  test('401 if token verification fails', () => {
    req.headers.authorization = 'Bearer expired-token';
    jwt.verify.mockImplementation(() => { throw new Error('expired'); });

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
  });
});