const errorMiddleware = require('../src/middlewares/error.middleware');

describe('error.middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('returns 500 with error message', () => {
    const err = new Error('Database connection failed');
    errorMiddleware(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Database connection failed' });
  });

  test('returns 500 with default message if err.message is missing', () => {
    const err = {};
    errorMiddleware(err, req, res, next);

    expect(res.json).toHaveBeenCalledWith({ error: 'Something went wrong' });
  });
});