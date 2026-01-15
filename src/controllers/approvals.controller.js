const fs = require('fs/promises');
const path = require('path');

const approvalsDAL = require('../dal/approvals.dal');
const { executeRequestInternal } = require('./execution.controller');

/* ================= GET PENDING ================= */

exports.getPendingApprovals = async (req, res) => {
  try {
    const managerId = Number(req.user.id);
    if (Number.isNaN(managerId)) {
      return res.status(400).json({ message: 'Invalid manager id' });
    }

    const result = await approvalsDAL.getPendingApprovals(
      managerId,
      req.query
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
  } catch (err) {
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

    const scriptPath =
      await approvalsDAL.getScriptPathForApproval(requestId, managerId);

    if (!scriptPath) {
      return res.status(404).json({
        message: 'Script not found or not authorized'
      });
    }

    const content = await fs.readFile(
      path.resolve(scriptPath),
      'utf-8'
    );

    res.json({ requestId, preview: content });
  } catch (err) {
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
  } catch (err) {
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

    res.json({ message: 'Request rejected' });
  } catch (err) {
    console.error('Reject request error:', err);
    res.status(500).json({ message: 'Failed to reject request' });
  }
};