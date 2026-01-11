const request = require('supertest');
const express = require('express');

// Ensure express is not mocked globally
jest.unmock('express');

jest.mock('../src/middlewares/auth.middleware', () => (req, res, next) => next());
jest.mock('../src/controllers/approvals.controller', () => ({
  getPendingApprovals: (req, res) => res.status(200).json({ ok: true }),
  getApprovalScriptPreview: (req, res) => res.status(200).json({ ok: true }),
  approveRequest: (req, res) => res.status(200).json({ ok: true }),
  rejectRequest: (req, res) => res.status(200).json({ ok: true })
}));

// Use plural 'routes' to match your file system
const router = require('../src/routes/approvals.routes');

describe('Approvals Routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/', router);

  test('GET /pending calls getPendingApprovals', async () => {
    const res = await request(app).get('/pending');
    expect(res.status).toBe(200);
  });

  test('GET /:id/script calls getApprovalScriptPreview', async () => {
    const res = await request(app).get('/1/script');
    expect(res.status).toBe(200);
  });

  test('POST /:id/approve calls approveRequest', async () => {
    const res = await request(app).post('/1/approve');
    expect(res.status).toBe(200);
  });

  test('POST /:id/reject calls rejectRequest', async () => {
    const res = await request(app).post('/1/reject');
    expect(res.status).toBe(200);
  });
});