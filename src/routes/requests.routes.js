const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');
const requestsController = require('../controllers/requests.controller');
const uploadScript = require('../middlewares/uploadScripts');
const { validate } = require('../middlewares/validate.middleware');
const { 
  submitRequestSchema,
  requestIdParamSchema,
  getInstancesQuerySchema,
  getDatabasesQuerySchema
} = require('../validations/requests.validation');

// Get database types
router.get(
  '/database-types',
  authMiddleware,
  requestsController.getDatabaseTypes
);

// Get instances (optionally filtered by type)
router.get(
  '/instances',
  authMiddleware,
  validate(getInstancesQuerySchema, 'query'),
  requestsController.getInstances
);

// Get databases from a specific instance
router.get(
  '/databases',
  authMiddleware,
  validate(getDatabasesQuerySchema, 'query'),
  requestsController.getDatabases
);

// Single endpoint for QUERY and SCRIPT
router.post(
  '/',
  authMiddleware,
  (req, res, next) => {
    uploadScript.single('script')(req, res, (err) => {
      if (err) {
        // Handle multer errors
        if (err.message.includes('JavaScript')) {
          return res.status(400).json({ 
            message: 'Invalid file type. Please upload a JavaScript (.js) file only.' 
          });
        }
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ 
            message: 'File too large. Maximum size is 16MB.' 
          });
        }
        return res.status(400).json({ 
          message: err.message || 'File upload failed' 
        });
      }
      next();
    });
  },
  validate(submitRequestSchema, 'body'),
  requestsController.submitRequest
);

// Endpoint to view the entire script
router.get(
  '/:id/script',
  authMiddleware,
  validate(requestIdParamSchema, 'params'),
  requestsController.getScriptForApproval
);

module.exports = router;
