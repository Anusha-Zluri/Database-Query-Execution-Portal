const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const podsController = require('../controllers/pods.controller');

router.get('/', authMiddleware, podsController.getPods);

module.exports = router;
