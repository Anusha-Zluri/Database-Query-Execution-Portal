const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');
const { executeRequest, downloadExecutionResults } = require('../controllers/execution.controller');

router.post(
  '/execute/:id',
  authMiddleware,
  executeRequest
);

router.get('/executions/:id/download', authMiddleware, downloadExecutionResults);

module.exports = router;
