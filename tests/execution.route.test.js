const request = require('supertest');
const express = require('express');

jest.unmock('express');

jest.mock('../src/middlewares/auth.middleware', () => (req, res, next) => next());
jest.mock('../src/controllers/execution.controller', () => ({
  executeRequest: (req, res) => res.status(200).json({ ok: true })
}));

const executionRouter = require('../src/routes/execution.routes');
const podsRouter = require('../src/routes/pods.routes');

describe('Execution Routes', () => {
  test('POST /execute/:id calls executeRequest', async () => {
    const app = express();
    app.use('/', executionRouter);
    const res = await request(app).post('/execute/1');
    expect(res.status).toBe(200);
  });

  test('GET / (pods list)', async () => {
    const app = express();
    app.use('/', podsRouter);
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('pods list placeholder');
  });
});