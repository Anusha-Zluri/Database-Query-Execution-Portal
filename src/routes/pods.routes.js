const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const podsController = require('../controllers/pods.controller');

/**
 * @swagger
 * tags:
 *   name: PODs
 *   description: POD (Project/Organization/Department) management
 */

/**
 * @swagger
 * /pods:
 *   get:
 *     summary: Get all PODs
 *     description: Retrieve list of all available PODs for request categorization
 *     tags: [PODs]
 *     responses:
 *       200:
 *         description: PODs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     description: POD ID (as string)
 *                     example: "1"
 *                   name:
 *                     type: string
 *                     description: POD name
 *                     example: Pod1
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
router.get('/', authMiddleware, podsController.getPods);

module.exports = router;
