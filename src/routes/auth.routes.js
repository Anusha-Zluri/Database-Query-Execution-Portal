const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { loginSchema } = require('../validations/auth.validation');

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and session management
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticate user with email and password to receive JWT token
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT authentication token
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ1c2VyQGV4YW1wbGUuY29tIiwicm9sZSI6IkRFVkVMT1BFUiIsImlhdCI6MTY0MjU4NzYwMCwiZXhwIjoxNjQyNjc0MDAwfQ.abc123
 *       400:
 *         description: Invalid credentials or validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Validation error or operation failed"
 *       401:
 *         description: Authentication failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Validation error or operation failed"
 */
router.post('/login', validate(loginSchema, 'body'), authController.login);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user
 *     description: Retrieve information about the currently authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: User ID (as string from JWT)
 *                   example: "2"
 *                 name:
 *                   type: string
 *                   nullable: true
 *                   example: Manager User
 *                 email:
 *                   type: string
 *                   format: email
 *                   example: manager@test.com
 *                 role:
 *                   type: string
 *                   enum: [DEVELOPER, MANAGER, ADMIN]
 *                   example: MANAGER
 *                 iat:
 *                   type: integer
 *                   description: JWT issued at timestamp
 *                   example: 1768665031
 *                 exp:
 *                   type: integer
 *                   description: JWT expiration timestamp
 *                   example: 1768668631
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
router.get('/me', authMiddleware, authController.me);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: User logout
 *     description: Invalidate the current JWT token and log out the user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Logged out successfully
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2024-01-15T16:30:00.000Z
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
router.post('/logout', authMiddleware, authController.logout);

/**
 * @swagger
 * /auth/cleanup-tokens:
 *   post:
 *     summary: Cleanup expired tokens
 *     description: Remove expired tokens from the blacklist (maintenance endpoint)
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Token cleanup completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Token cleanup completed
 *                 cleanedTokens:
 *                   type: integer
 *                   example: 5
 */
router.post('/cleanup-tokens', authController.cleanupTokens);

module.exports = router;