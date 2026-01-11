

const express = require('express');
const router = express.Router();


const authMiddleware = require('../middlewares/auth.middleware');
const approvalsController = require('../controllers/approvals.controller');

//GET pending approvals (without filtering)
router.get(
  '/pending',
  authMiddleware,
  approvalsController.getPendingApprovals
);





// Preview script content (manager only)
router.get(
  '/:id/script',
  authMiddleware,
  approvalsController.getApprovalScriptPreview
);



//approve 

router.post(
  '/:id/approve',
  authMiddleware,
  approvalsController.approveRequest
);


//reject
router.post(
  '/:id/reject',
  authMiddleware,
  approvalsController.rejectRequest
);




module.exports = router;

