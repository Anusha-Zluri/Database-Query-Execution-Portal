const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');
const requestsController = require('../controllers/requests.controller');
const uploadScript = require('../middlewares/uploadScripts');

// Single endpoint for QUERY and SCRIPT
router.post(
  '/',
  authMiddleware,
  uploadScript.single('script'),
  requestsController.submitRequest
);

//endpoint to view the entire script
router.get(
  '/:id/script',
  authMiddleware,
  requestsController.getScriptForApproval
);


module.exports = router;
