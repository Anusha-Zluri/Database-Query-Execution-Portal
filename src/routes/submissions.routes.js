const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');
const submissionsController = require('../controllers/submissions.controller');

router.get(
  '/submissions',
  authMiddleware,
  submissionsController.getMySubmissions
);

router.get(
  '/submissions/:id',
  authMiddleware,
  submissionsController.getSubmissionDetails
);

router.post(
  '/submissions/:id/clone',
  authMiddleware,
  submissionsController.cloneSubmission
);

module.exports = router;
