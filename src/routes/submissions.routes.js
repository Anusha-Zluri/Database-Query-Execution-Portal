const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');
const submissionsController = require('../controllers/submissions.controller');
const { validate } = require('../middlewares/validate.middleware');
const { 
  submissionIdParamSchema,
  paginationQuerySchema,
  updateDraftSchema
} = require('../validations/submissions.validation');

/**
 * @swagger
 * tags:
 *   name: Submissions
 *   description: User submission management and tracking
 */

/**
 * @swagger
 * /submissions/counts:
 *   get:
 *     summary: Get submission status counts
 *     description: Retrieve count of submissions by status for the current user
 *     tags: [Submissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Submission counts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ALL:
 *                   type: integer
 *                   description: Total submissions by user
 *                   example: 155
 *                 PENDING:
 *                   type: integer
 *                   description: Submissions awaiting approval
 *                   example: 27
 *                 EXECUTED:
 *                   type: integer
 *                   description: Successfully executed submissions
 *                   example: 49
 *                 REJECTED:
 *                   type: integer
 *                   description: Rejected submissions
 *                   example: 8
 *                 FAILED:
 *                   type: integer
 *                   description: Failed execution submissions
 *                   example: 39
 *                 APPROVED:
 *                   type: integer
 *                   description: Approved but not yet executed submissions
 *                   example: 32
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
 */
router.get(
  '/submissions/counts',
  authMiddleware,
  submissionsController.getSubmissionStatusCounts
);

/**
 * @swagger
 * /submissions:
 *   get:
 *     summary: Get user submissions
 *     description: Retrieve paginated list of submissions for the current user
 *     tags: [Submissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Submissions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 submissions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Request'
 *                 total:
 *                   type: integer
 *                   description: Total number of submissions
 *                   example: 15
 *                 totalPages:
 *                   type: integer
 *                   description: Total number of pages
 *                   example: 2
 *                 currentPage:
 *                   type: integer
 *                   description: Current page number
 *                   example: 1
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
 */
router.get(
  '/submissions',
  authMiddleware,
  validate(paginationQuerySchema, 'query'),
  submissionsController.getMySubmissions
);

/**
 * @swagger
 * /submissions/{id}:
 *   get:
 *     summary: Get submission details
 *     description: Retrieve detailed information about a specific submission
 *     tags: [Submissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Submission ID
 *         example: 123
 *     responses:
 *       200:
 *         description: Submission details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Request'
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
 *         description: Submission not found or not owned by user
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
  '/submissions/:id',
  authMiddleware,
  validate(submissionIdParamSchema, 'params'),
  submissionsController.getSubmissionDetails
);

/**
 * @swagger
 * /submissions/{id}/clone:
 *   post:
 *     summary: Clone a submission
 *     description: Create a new draft submission based on an existing submission
 *     tags: [Submissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Submission ID to clone
 *         example: 123
 *     responses:
 *       201:
 *         description: Submission cloned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Submission cloned successfully
 *                 newSubmissionId:
 *                   type: integer
 *                   description: ID of the new cloned submission
 *                   example: 456
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
 *         description: Original submission not found or not owned by user
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
  '/submissions/:id/clone',
  authMiddleware,
  validate(submissionIdParamSchema, 'params'),
  submissionsController.cloneSubmission
);

/**
 * @swagger
 * /submissions/{id}/edit:
 *   get:
 *     summary: Get submission for editing
 *     description: Retrieve submission data formatted for editing (draft submissions only)
 *     tags: [Submissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Submission ID
 *         example: 123
 *     responses:
 *       200:
 *         description: Submission data for editing retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Request'
 *       400:
 *         description: Submission is not in draft status
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
 *         description: Submission not found or not owned by user
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
  '/submissions/:id/edit',
  authMiddleware,
  validate(submissionIdParamSchema, 'params'),
  submissionsController.getSubmissionForEdit
);

/**
 * @swagger
 * /submissions/{id}:
 *   patch:
 *     summary: Update draft submission
 *     description: Update a draft submission with new content or metadata
 *     tags: [Submissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Submission ID
 *         example: 123
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: Updated query content
 *                 example: SELECT * FROM users WHERE active = true AND created_at > '2024-01-01'
 *               comment:
 *                 type: string
 *                 description: Updated comment
 *                 example: Updated query to include date filter
 *     responses:
 *       200:
 *         description: Draft submission updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Draft updated successfully
 *       400:
 *         description: Submission is not in draft status or validation error
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
 *         description: Submission not found or not owned by user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Validation error or operation failed"
 */
router.patch(
  '/submissions/:id',
  authMiddleware,
  validate(submissionIdParamSchema, 'params'),
  validate(updateDraftSchema, 'body'),
  submissionsController.updateDraftSubmission
);

/**
 * @swagger
 * /submissions/{id}/submit:
 *   post:
 *     summary: Submit draft for approval
 *     description: Convert a draft submission to pending status for approval
 *     tags: [Submissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Draft submission ID
 *         example: 123
 *     responses:
 *       200:
 *         description: Draft submitted for approval successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Draft submitted for approval
 *       400:
 *         description: Submission is not in draft status
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
 *         description: Submission not found or not owned by user
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
  '/submissions/:id/submit',
  authMiddleware,
  validate(submissionIdParamSchema, 'params'),
  submissionsController.submitDraft
);

module.exports = router;
