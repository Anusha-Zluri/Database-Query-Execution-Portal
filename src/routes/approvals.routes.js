const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');
const approvalsController = require('../controllers/approvals.controller');
const { validate } = require('../middlewares/validate.middleware');
const { 
  getApprovalsQuerySchema, 
  approvalIdParamSchema,
  rejectRequestSchema 
} = require('../validations/approvals.validation');

/**
 * @swagger
 * tags:
 *   name: Approvals
 *   description: Request approval and rejection management
 */

/**
 * @swagger
 * /approvals/pending:
 *   get:
 *     summary: Get pending approvals
 *     description: Retrieve list of requests pending approval with filtering and pagination
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         description: Filter by request status
 *         example: PENDING
 *       - in: query
 *         name: pod_id
 *         schema:
 *           type: integer
 *         description: Filter by POD ID
 *         example: 1
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter requests from this date
 *         example: 2024-01-01
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter requests to this date
 *         example: 2024-12-31
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in request content and comments
 *         example: SELECT users
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Approvals retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   description: Number of requests in current page
 *                   example: 10
 *                 total:
 *                   type: integer
 *                   description: Total number of requests across all pages
 *                   example: 156
 *                 page:
 *                   type: integer
 *                   description: Current page number
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   description: Items per page
 *                   example: 10
 *                 totalPages:
 *                   type: integer
 *                   description: Total number of pages
 *                   example: 16
 *                 requests:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 123
 *                       type:
 *                         type: string
 *                         enum: [QUERY, SCRIPT]
 *                         example: QUERY
 *                       database:
 *                         type: string
 *                         description: Combined instance and database name
 *                         example: postgres-prod / analytics_db
 *                       content:
 *                         type: string
 *                         nullable: true
 *                         description: Query content or script preview
 *                         example: SELECT COUNT(*) FROM users WHERE active = true
 *                       requester:
 *                         type: string
 *                         format: email
 *                         example: analyst@company.com
 *                       pod:
 *                         type: string
 *                         example: Data Analytics Team
 *                       comments:
 *                         type: string
 *                         nullable: true
 *                         example: Monthly report for stakeholders
 *                       status:
 *                         type: string
 *                         enum: [PENDING, APPROVED, REJECTED]
 *                         example: PENDING
 *                       submitted_at:
 *                         type: string
 *                         format: date-time
 *                         example: 2024-01-15T14:30:00Z
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Validation error or operation failed"
 *       403:
 *         description: Not authorized (requires APPROVER role)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Validation error or operation failed"
 */
router.get(
  '/pending',
  authMiddleware,
  validate(getApprovalsQuerySchema, 'query'),
  approvalsController.getPendingApprovals
);

/**
 * @swagger
 * /approvals/{id}/script:
 *   get:
 *     summary: Get script preview for approval
 *     description: Retrieve script content preview for approval review
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Request ID
 *         example: 123
 *     responses:
 *       200:
 *         description: Script preview retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 preview:
 *                   type: string
 *                   description: Script content
 *                   example: |
 *                     module.exports = async function ({ db, utils }) {
 *                       const result = await db.query('SELECT * FROM users');
 *                       return { rowCount: result.rowCount, rows: result.rows };
 *                     };
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Validation error or operation failed"
 *       403:
 *         description: Not authorized (requires APPROVER role)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Validation error or operation failed"
 *       404:
 *         description: Request not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Validation error or operation failed"
 */
router.get(
  '/:id/script',
  authMiddleware,
  validate(approvalIdParamSchema, 'params'),
  approvalsController.getApprovalScriptPreview
);

/**
 * @swagger
 * /approvals/{id}/approve:
 *   post:
 *     summary: Approve a request
 *     description: Approve a pending request for execution
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Request ID to approve
 *         example: 123
 *     responses:
 *       200:
 *         description: Request approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Request approved successfully
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Validation error or operation failed"
 *       403:
 *         description: Not authorized (requires APPROVER role)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Validation error or operation failed"
 *       404:
 *         description: Request not found or already processed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Validation error or operation failed"
 */
router.post(
  '/:id/approve',
  authMiddleware,
  validate(approvalIdParamSchema, 'params'),
  approvalsController.approveRequest
);

/**
 * @swagger
 * /approvals/{id}/reject:
 *   post:
 *     summary: Reject a request
 *     description: Reject a pending request with a reason
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Request ID to reject
 *         example: 123
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for rejection
 *                 example: Query contains potentially dangerous operations that need clarification
 *     responses:
 *       200:
 *         description: Request rejected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Request rejected successfully
 *       400:
 *         description: Missing or invalid rejection reason
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Validation error or operation failed"
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Validation error or operation failed"
 *       403:
 *         description: Not authorized (requires APPROVER role)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Validation error or operation failed"
 *       404:
 *         description: Request not found or already processed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Validation error or operation failed"
 */
router.post(
  '/:id/reject',
  authMiddleware,
  validate(approvalIdParamSchema, 'params'),
  validate(rejectRequestSchema, 'body'),
  approvalsController.rejectRequest
);

module.exports = router;