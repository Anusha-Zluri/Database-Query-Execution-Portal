const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');
const executionController = require('../controllers/execution.controller');

router.post(
  '/execute/:id',
  authMiddleware,
  executionController.executeRequest
);

module.exports = router;
