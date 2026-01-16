const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');
const submissionsController = require('../controllers/submissions.controller');
const { validate } = require('../middlewares/validate.middleware');
const { 
  submissionIdParamSchema,
  paginationQuerySchema,
  updateDraftSchema
} = require('../validations/submissions.validation');

router.get(
  '/submissions/counts',
  authMiddleware,
  submissionsController.getSubmissionStatusCounts
);

router.get(
  '/submissions',
  authMiddleware,
  validate(paginationQuerySchema, 'query'),
  submissionsController.getMySubmissions
);

router.get(
  '/submissions/:id',
  authMiddleware,
  validate(submissionIdParamSchema, 'params'),
  submissionsController.getSubmissionDetails
);

router.post(
  '/submissions/:id/clone',
  authMiddleware,
  validate(submissionIdParamSchema, 'params'),
  submissionsController.cloneSubmission
);

router.get(
  '/submissions/:id/edit',
  authMiddleware,
  validate(submissionIdParamSchema, 'params'),
  submissionsController.getSubmissionForEdit
);

router.patch(
  '/submissions/:id',
  authMiddleware,
  validate(submissionIdParamSchema, 'params'),
  validate(updateDraftSchema, 'body'),
  submissionsController.updateDraftSubmission
);

router.post(
  '/submissions/:id/submit',
  authMiddleware,
  validate(submissionIdParamSchema, 'params'),
  submissionsController.submitDraft
);

module.exports = router;
