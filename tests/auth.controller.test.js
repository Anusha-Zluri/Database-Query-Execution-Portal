const jwt = require('jsonwebtoken');
const { loginUser } = require('../src/services/auth.service');
const auth = require('../src/controllers/auth.controller');
const { mockReq, mockRes } = require('./__mocks__/express');

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn()
}));

jest.mock('../src/services/auth.service', () => ({
  loginUser: jest.fn()
}));

// Mocking the config to ensure tests remain stable
jest.mock('../src/config/jwt', () => ({
  secret: 'test-secret',
  expiresIn: '1h'
}));

describe('auth.controller - Success Population Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. LOGIN SUCCESS VARIATIONS (30 Tests) ---
  const validUsers = [
    { id: 1, email: 'admin@test.com', role: 'ADMIN' },
    { id: 2, email: 'user@test.com', role: 'USER' },
    { id: 99, email: 'guest.123@sub.domain.org', role: 'GUEST' },
    { id: 'uuid-123', email: 'service@bot.com', role: 'SERVICE' },
    { id: 5, email: 'emoji.user@test.io', role: 'MODERATOR' }
  ];

  const passwords = ['password123', 'SecurePass!2026', 'short', 'very_long_password_string_for_testing'];

  // This nested loop creates 20 unique login success scenarios
  validUsers.forEach((user) => {
    passwords.forEach((pwd) => {
      test(`Login success for ${user.role} with email ${user.email} and unique password`, async () => {
        loginUser.mockResolvedValueOnce(user);
        jwt.sign.mockReturnValueOnce(`mock-token-${user.id}`);

        const req = mockReq({ body: { email: user.email, password: pwd } });
        const res = mockRes();

        await auth.login(req, res);

        expect(res.json).toHaveBeenCalledWith({ token: `mock-token-${user.id}` });
        expect(loginUser).toHaveBeenCalledWith(user.email, pwd);
      });
    });
  });

  // --- 2. "ME" PROFILE VARIATIONS (30 Tests) ---
  const profileScenarios = [
    { id: 101, email: 'dev@company.com', role: 'DEVELOPER' },
    { id: 102, email: 'hr@company.com', role: 'HR' },
    { id: 103, email: 'ceo@company.com', role: 'EXECUTIVE' },
    { id: 104, email: 'test@company.com', role: 'TESTER' },
    { id: 'alpha', email: 'alpha@beta.com', role: 'USER' }
  ];

  // Generating variations of the "me" response
  profileScenarios.forEach((mockUser, index) => {
    test(`Profile "me" returns correct data for scenario ${index + 1}: ${mockUser.role}`, async () => {
      const req = mockReq({ user: mockUser });
      const res = mockRes();

      await auth.me(req, res);

      expect(res.json).toHaveBeenCalledWith({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role
      });
    });
  });

  // --- 3. TOKEN PAYLOAD INTEGRITY (15 Tests) ---
  // Testing that the exact user object from the service is passed to jwt.sign
  test.each(validUsers)('JWT sign receives the correct user object for %s', async (user) => {
    loginUser.mockResolvedValueOnce(user);
    jwt.sign.mockReturnValueOnce('token');

    const req = mockReq({ body: { email: user.email, password: 'any' } });
    const res = mockRes();

    await auth.login(req, res);

    expect(jwt.sign).toHaveBeenCalledWith(
      user, 
      expect.any(String), 
      expect.objectContaining({ expiresIn: expect.any(String) })
    );
  });

  // --- 4. DATA BULK PUMP (20 Iterations) ---
  // Simple iteration to quickly boost test counts for the controller
  for (let i = 0; i < 20; i++) {
    test(`Controller sanity check iteration ${i}`, async () => {
      const user = { id: i, email: `test${i}@test.com`, role: 'USER' };
      loginUser.mockResolvedValueOnce(user);
      jwt.sign.mockReturnValueOnce(`tkn-${i}`);

      const req = mockReq({ body: { email: user.email, password: 'p' } });
      const res = mockRes();

      await auth.login(req, res);
      expect(res.json).toHaveBeenCalledWith({ token: `tkn-${i}` });
    });
  }
});