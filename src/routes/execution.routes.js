const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');
const { executeRequest, downloadExecutionResults } = require('../controllers/execution.controller');
const { validate } = require('../middlewares/validate.middleware');
const { executionIdParamSchema } = require('../validations/execution.validation');

router.post(
  '/execute/:id',
  authMiddleware,
  validate(executionIdParamSchema, 'params'),
  executeRequest
);

router.get(
  '/executions/:id/download',
  authMiddleware,
  validate(executionIdParamSchema, 'params'),
  downloadExecutionResults
);

module.exports = router;
