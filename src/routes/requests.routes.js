const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');
const requestsController = require('../controllers/requests.controller');
const uploadScript = require('../middlewares/uploadScripts');
const { validate } = require('../middlewares/validate.middleware');
const { 
  submitRequestSchema,
  requestIdParamSchema,
  getInstancesQuerySchema,
  getDatabasesQuerySchema
} = require('../validations/requests.validation');

/**
 * @swagger
 * tags:
 *   name: Requests
 *   description: Database query and script request management
 */

/**
 * @swagger
 * /requests/database-types:
 *   get:
 *     summary: Get available database types
 *     description: Retrieve list of supported database engine types
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Database types retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 types:
 *                   type: array
 *                   items:
 *                     type: string
 *                     enum: [postgres, mongodb]
 *                   example: ["postgres", "mongodb"]
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
  '/database-types',
  authMiddleware,
  requestsController.getDatabaseTypes
);

/**
 * @swagger
 * /requests/instances:
 *   get:
 *     summary: Get database instances
 *     description: Retrieve list of available database instances, optionally filtered by type
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [postgres, mongodb]
 *         description: Filter instances by database type
 *     responses:
 *       200:
 *         description: Database instances retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 instances:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DatabaseInstance'
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
  '/instances',
  authMiddleware,
  validate(getInstancesQuerySchema, 'query'),
  requestsController.getInstances
);

/**
 * @swagger
 * /requests/databases:
 *   get:
 *     summary: Get databases from instance
 *     description: Retrieve list of databases available in a specific database instance
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: instance
 *         required: true
 *         schema:
 *           type: string
 *         description: Database instance name
 *         example: postgres-prod
 *     responses:
 *       200:
 *         description: Databases retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 databases:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["app_db", "analytics_db", "user_db"]
 *       400:
 *         description: Invalid instance name
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
 *         description: Instance not found
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
  '/databases',
  authMiddleware,
  validate(getDatabasesQuerySchema, 'query'),
  requestsController.getDatabases
);

/**
 * @swagger
 * /requests:
 *   post:
 *     summary: Submit a new request
 *     description: Submit a database query or script execution request
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - request_type
 *               - pod_id
 *               - db_instance
 *               - db_name
 *             properties:
 *               request_type:
 *                 type: string
 *                 enum: [QUERY, SCRIPT]
 *                 description: Type of request
 *               pod_id:
 *                 type: integer
 *                 description: POD ID
 *                 example: 1
 *               db_instance:
 *                 type: string
 *                 description: Database instance name
 *                 example: postgres-prod
 *               db_name:
 *                 type: string
 *                 description: Database name
 *                 example: app_db
 *               content:
 *                 type: string
 *                 description: Query content (required for QUERY type)
 *                 example: SELECT * FROM users WHERE active = true
 *               comment:
 *                 type: string
 *                 description: Optional comment explaining the request
 *                 example: Need to check active users for monthly report
 *               script:
 *                 type: string
 *                 format: binary
 *                 description: JavaScript file (required for SCRIPT type, max 16MB)
 *     responses:
 *       201:
 *         description: Request submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Request submitted successfully
 *                 request_id:
 *                   type: integer
 *                   example: 123
 *                 status:
 *                   type: string
 *                   example: PENDING
 *       400:
 *         description: Validation error or missing required fields
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
 */
router.post(
  '/',
  authMiddleware,
  (req, res, next) => {
    uploadScript.single('script')(req, res, (err) => {
      if (err) {
        // Handle multer errors
        if (err.message.includes('JavaScript')) {
          return res.status(400).json({ 
            message: 'Invalid file type. Please upload a JavaScript (.js) file only.' 
          });
        }
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ 
            message: 'File too large. Maximum size is 16MB.' 
          });
        }
        return res.status(400).json({ 
          message: err.message || 'File upload failed' 
        });
      }
      next();
    });
  },
  validate(submitRequestSchema, 'body'),
  requestsController.submitRequest
);

/**
 * @swagger
 * /requests/{id}/script:
 *   get:
 *     summary: Get script content for approval
 *     description: Retrieve the full script content for review during approval process
 *     tags: [Requests]
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
 *         description: Script content retrieved successfully
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: |
 *                 module.exports = async function ({ db, utils }) {
 *                   const result = await db.query('SELECT * FROM users');
 *                   return { rowCount: result.rowCount, rows: result.rows };
 *                 };
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
 *         description: Request not found or not authorized
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
  validate(requestIdParamSchema, 'params'),
  requestsController.getScriptForApproval
);

module.exports = router;
