const request = require('supertest');
const express = require('express');

jest.unmock('express');

jest.mock('../src/middlewares/auth.middleware', () => (req, res, next) => next());
jest.mock('../src/controllers/auth.controller', () => ({
  login: (req, res) => res.status(200).json({ token: 'mock' }),
  me: (req, res) => res.status(200).json({ user: 'mock' })
}));

const router = require('../src/routes/auth.routes');

describe('Auth Routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/', router);

  test('POST /login calls login', async () => {
    const res = await request(app).post('/login').send({ user: 'test' });
    expect(res.status).toBe(200);
  });

  test('GET /me calls me', async () => {
    const res = await request(app).get('/me');
    expect(res.status).toBe(200);
  });
});