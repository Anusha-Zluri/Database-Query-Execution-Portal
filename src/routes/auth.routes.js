const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');
const authController = require('../controllers/auth.controller');



console.log('authMiddleware type:', typeof authMiddleware);
console.log('authController.me type:', typeof authController.me);

router.post('/login', authController.login);

router.get('/me', authMiddleware, authController.me);

module.exports = router;
