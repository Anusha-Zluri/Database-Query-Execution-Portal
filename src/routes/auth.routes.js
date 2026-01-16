const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { loginSchema } = require('../validations/auth.validation');

// Login endpoint (public)
router.post('/login', validate(loginSchema, 'body'), authController.login);

// Get current user (requires authentication)
router.get('/me', authMiddleware, authController.me);

// Logout endpoint (requires authentication)
router.post('/logout', authMiddleware, authController.logout);

// Token cleanup endpoint (for maintenance - you might want to protect this)
router.post('/cleanup-tokens', authController.cleanupTokens);

module.exports = router;