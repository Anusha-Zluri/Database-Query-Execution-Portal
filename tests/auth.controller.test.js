jest.mock('jsonwebtoken', () => ({
  sign: jest.fn()
}));

jest.mock('../src/services/auth.service', () => ({
  loginUser: jest.fn()
}));

const jwt = require('jsonwebtoken');
const { loginUser } = require('../src/services/auth.service');
const auth = require('../src/controllers/auth.controller');
const { mockReq, mockRes } = require('./__mocks__/express');

describe('auth.controller', () => {
  beforeEach(() => jest.clearAllMocks());

  test('login success returns token', async () => {
    loginUser.mockResolvedValueOnce({ id: 1 });
    jwt.sign.mockReturnValueOnce('token');

    const req = mockReq({ body: { email: 'a', password: 'b' } });
    const res = mockRes();

    await auth.login(req, res);
    expect(res.json).toHaveBeenCalledWith({ token: 'token' });
  });

  test('login failure returns 401', async () => {
    loginUser.mockRejectedValueOnce(new Error('bad creds'));

    const req = mockReq({ body: {} });
    const res = mockRes();

    await auth.login(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('me returns user info', async () => {
    const req = mockReq();
    const res = mockRes();

    await auth.me(req, res);

    expect(res.json).toHaveBeenCalledWith({
      id: 1,
      email: 'a@b.com',
      role: 'USER'
    });
  });
});
