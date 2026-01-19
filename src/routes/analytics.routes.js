const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const { getApprovalAnalytics } = require('../controllers/analytics.controller');

/**
 * @swagger
 * /analytics/approvals:
 *   get:
 *     summary: Get approval analytics
 *     description: Get analytics data for manager's PODs (top submitters, request types, status breakdown)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics data
 *       403:
 *         description: Not a manager
 */
router.get('/approvals', authMiddleware, getApprovalAnalytics);

module.exports = router;
