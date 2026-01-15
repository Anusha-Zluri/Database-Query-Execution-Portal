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

router.get(
  '/submissions/:id/edit',
  authMiddleware,
  submissionsController.getSubmissionForEdit
);
router.patch(
  '/submissions/:id',
  authMiddleware,
  submissionsController.updateDraftSubmission
);

router.post(
  '/submissions/:id/submit',
  authMiddleware,
  submissionsController.submitDraft
);

module.exports = router;
