const fs = require('fs/promises');
const path = require('path');

const approvalsDAL = require('../dal/approvals.dal');
const podsDAL = require('../dal/pods.dal');
const { executeRequestInternal } = require('./execution.controller');

// Slack integration
const slackService = require('../services/slack.service');
const { rejectionMessage } = require('../services/slack.messages');

/* ================= GET PENDING ================= */

exports.getPendingApprovals = async (req, res) => {
  try {
    const managerId = Number(req.user.id);
    if (Number.isNaN(managerId)) {
      return res.status(400).json({ message: 'Invalid manager id' });
    }

    // Build filters object (exclude 'pod' - we'll handle it separately)
    const { pod, pod_id, ...filters } = req.query;

    // If POD filter is provided (either by name or ID), validate manager has access
    if (pod || pod_id) {
      const managerPods = await podsDAL.getManagerPods(managerId);
      
      let finalPodId;
      
      if (pod) {
        // POD filter by name - find matching POD
        const podMatch = managerPods.find(p => p.name === pod);
        
        if (!podMatch) {
          // Check if POD exists at all
          const allPods = await podsDAL.getActivePods();
          const podExistsGlobally = allPods.some(p => p.name === pod);
          
          if (!podExistsGlobally) {
            return res.status(404).json({ 
              message: `POD '${pod}' does not exist` 
            });
          } else {
            return res.status(403).json({ 
              message: `You can only approve requests from PODs you manage.` 
            });
          }
        }
        
        finalPodId = Number(podMatch.id);
      } else {
        // POD filter by ID - check if manager manages this POD
        const podMatch = managerPods.find(p => String(p.id) === String(pod_id));
        
        if (!podMatch) {
          // Check if POD exists at all
          const allPods = await podsDAL.getActivePods();
          const podExistsGlobally = allPods.find(p => String(p.id) === String(pod_id));
          
          if (!podExistsGlobally) {
            return res.status(404).json({ 
              message: `POD with ID ${pod_id} does not exist` 
            });
          } else {
            return res.status(403).json({ 
              message: `You can only approve requests from PODs you manage.` 
            });
          }
        }
        
        finalPodId = pod_id;
      }
      
      // Set the validated POD ID in filters
      filters.pod_id = finalPodId;
    }

    const result = await approvalsDAL.getPendingApprovals(
      managerId,
      filters
    );

    res.json({
      count: result.rows.length,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      requests: result.rows.map(r => ({
        id: r.request_id,
        type: r.request_type,
        database: `${r.instance_name} / ${r.db_name}`,
        content: r.content,
        requester: r.requester_email,
        pod: r.pod_name,
        comments: r.comment,
        status: r.status,
        submitted_at: r.created_at,
        risk_level: r.risk_level,
        has_dangerous_ops: r.has_dangerous_ops
      }))
    });
  } /* istanbul ignore next */ catch (err) {
    console.error('Get pending approvals error:', err);
    res.status(500).json({ message: 'Failed to fetch pending approvals' });
  }
};

/* ================= SCRIPT PREVIEW ================= */

exports.getApprovalScriptPreview = async (req, res) => {
  try {
    const managerId = Number(req.user.id);
    const requestId = Number(req.params.id);

    if (Number.isNaN(requestId)) {
      return res.status(400).json({ message: 'Invalid request id' });
    }

    const scriptData =
      await approvalsDAL.getScriptForApproval(requestId, managerId);

    if (!scriptData) {
      return res.status(404).json({
        message: 'Script not found or not authorized'
      });
    }

    // Try to get content from DB first, fallback to file if needed
    let content = scriptData.script_content;
    
    if (!content && scriptData.file_path) {
      /* istanbul ignore next */
      try {
        content = await fs.readFile(
          path.resolve(scriptData.file_path),
          'utf-8'
        );
      } catch (err) {
        return res.status(404).json({ message: 'Script file not available on this server' });
      }
    }

    if (!content) {
      return res.status(404).json({ message: 'Script content not available' });
    }

    res.json({ requestId, preview: content });
  } /* istanbul ignore next */ catch (err) {
    console.error('Script preview error:', err);
    res.status(500).json({ message: 'Failed to load script preview' });
  }
};

/* ================= APPROVE ================= */

exports.approveRequest = async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const managerId = Number(req.user.id);

    if (Number.isNaN(requestId)) {
      return res.status(400).json({ message: 'Invalid request id' });
    }

    const approved =
      await approvalsDAL.approveRequest(requestId, managerId);

    if (!approved) {
      return res
        .status(404)
        .json({ message: 'Request not found or not authorized' });
    }

    // fire-and-forget execution
    executeRequestInternal(requestId).catch(() => {});

    res.json({ message: 'Request approved' });
  } /* istanbul ignore next */ catch (err) {
    console.error('Approve request error:', err);
    res.status(500).json({ message: 'Failed to approve request' });
  }
};

/* ================= REJECT ================= */

exports.rejectRequest = async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const managerId = Number(req.user.id);
    const { reason } = req.body;

    if (Number.isNaN(requestId)) {
      return res.status(400).json({ message: 'Invalid request id' });
    }

    const rejected =
      await approvalsDAL.rejectRequest(requestId, managerId, reason);

    if (!rejected) {
      return res
        .status(404)
        .json({ message: 'Request not found or not authorized' });
    }

    // Send rejection notification (non-blocking, DM only)
    sendRejectionNotification(requestId, reason)
      .catch(err => console.error('Failed to send rejection notification:', err.message));

    res.json({ message: 'Request rejected' });
  } /* istanbul ignore next */ catch (err) {
    console.error('Reject request error:', err);
    res.status(500).json({ message: 'Failed to reject request' });
  }
};

/* ================= SLACK NOTIFICATION HELPER ================= */

async function sendRejectionNotification(requestId, rejectionReason) {
  try {
    // Fetch request details
    const request = await approvalsDAL.getRequestDetailsForRejection(requestId);

    if (!request) {
      console.warn('Could not fetch request details for rejection notification');
      return;
    }

    // Get script preview if it's a script request
    let scriptPreview = '';
    if (request.request_type === 'SCRIPT' && request.file_path) {
      try {
        const scriptContent = await fs.readFile(request.file_path, 'utf-8');
        scriptPreview = scriptContent.length > 500 
          ? scriptContent.substring(0, 500) + '...' 
          : scriptContent;
      } catch (error) {
        console.error('Failed to read script file for rejection notification:', error.message);
        scriptPreview = '[Script file could not be read]';
      }
    }

    const notificationData = {
      requestId,
      requesterEmail: request.requester_email,
      database: `${request.db_instance} / ${request.db_name}`,
      requestType: request.request_type,
      queryPreview: request.query_text || scriptPreview,
      scriptPath: request.file_path ? request.file_path.split('/').pop() : '',
      rejectionReason
    };

    const message = rejectionMessage(notificationData);
    
    // Send DM only (not to common channel)
    await slackService.sendDM(
      request.requester_email,
      message.blocks,
      message.text
    );
    
    console.log(`Slack rejection notification sent for request #${requestId}`);
  } catch (error) {
    console.error('Error sending rejection notification:', error.message);
  }
}
