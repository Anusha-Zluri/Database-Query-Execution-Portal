const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');
const { executeRequest, downloadExecutionResults } = require('../controllers/execution.controller');
const { validate } = require('../middlewares/validate.middleware');
const { executionIdParamSchema } = require('../validations/execution.validation');

/**
 * @swagger
 * tags:
 *   name: Execution
 *   description: Database query and script execution
 */

/**
 * @swagger
 * /execute/{id}:
 *   post:
 *     summary: Execute an approved request
 *     description: Execute an approved database query or script request
 *     tags: [Execution]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Request ID to execute
 *         example: 123
 *     responses:
 *       200:
 *         description: Request executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Request executed successfully
 *                 executionId:
 *                   type: integer
 *                   description: Execution record ID
 *                   example: 456
 *                 result:
 *                   $ref: '#/components/schemas/ExecutionResult'
 *       400:
 *         description: Request not approved or invalid
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
 *       500:
 *         description: Execution failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Execution failed
 *                 error:
 *                   type: string
 *                   example: Database connection timeout
 *                 executionId:
 *                   type: integer
 *                   description: Execution record ID (even for failed executions)
 *                   example: 456
 */
router.post(
  '/execute/:id',
  authMiddleware,
  validate(executionIdParamSchema, 'params'),
  executeRequest
);

/**
 * @swagger
 * /executions/{id}/download:
 *   get:
 *     summary: Download execution results
 *     description: Download execution results as CSV file
 *     tags: [Execution]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Execution ID
 *         example: 456
 *     responses:
 *       200:
 *         description: CSV file with execution results
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               example: |
 *                 id,name,email,created_at
 *                 1,John Doe,john@example.com,2024-01-01T00:00:00Z
 *                 2,Jane Smith,jane@example.com,2024-01-02T00:00:00Z
 *         headers:
 *           Content-Disposition:
 *             description: Attachment filename
 *             schema:
 *               type: string
 *               example: attachment; filename="execution_456_results.csv"
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
 *       404:
 *         description: Execution not found or no access
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
  '/executions/:id/download',
  authMiddleware,
  validate(executionIdParamSchema, 'params'),
  downloadExecutionResults
);

module.exports = router;
