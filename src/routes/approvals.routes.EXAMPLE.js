// EXAMPLE: How to add validation to approvals routes
// Copy the validation middleware usage to your actual approvals.routes.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  getApprovalsQuerySchema,
  approvalIdParamSchema,
  rejectRequestSchema
} = require('../validations/approvals.validation');
const approvalsController = require('../controllers/approvals.controller');

// GET /approvals - with query validation
router.get(
  '/',
  authMiddleware,
  validate(getApprovalsQuerySchema, 'query'),
  approvalsController.getPendingApprovals
);

// GET /approvals/:id/script - with param validation
router.get(
  '/:id/script',
  authMiddleware,
  validate(approvalIdParamSchema, 'params'),
  approvalsController.getApprovalScriptPreview
);

// POST /approvals/:id/approve - with param validation
router.post(
  '/:id/approve',
  authMiddleware,
  validate(approvalIdParamSchema, 'params'),
  approvalsController.approveRequest
);

// POST /approvals/:id/reject - with par