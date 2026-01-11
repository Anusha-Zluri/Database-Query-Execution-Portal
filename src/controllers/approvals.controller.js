const { pool } = require('../config/db');



exports.getPendingApprovals = async (req, res) => {
  try {
    const managerId = Number(req.user.id);

    if (Number.isNaN(managerId)) {
      return res.status(400).json({ message: 'Invalid manager id' });
    }

    /*const query = `
      
    
    

      //the newer query:
      SELECT
        r.id,
        r.request_type,
        r.db_name,
        r.comment,
        r.created_at AS submitted_at,

        u.name AS requester,
        p.name AS pod,

        -- QUERY
        rq.query_text,

        -- SCRIPT
        rs.file_path,
        rs.line_count,
        rs.risk_level,
        rs.has_dangerous_apis

      FROM requests r
      JOIN pods p ON p.id = r.pod_id
      JOIN users u ON u.id = r.requester_id

      LEFT JOIN request_queries rq
        ON rq.request_id = r.id

      LEFT JOIN request_scripts rs
        ON rs.request_id = r.id

      WHERE r.status = 'PENDING'
        AND p.manager_user_id = $1

      ORDER BY r.created_at DESC
    `;
     */
    const query = `
  SELECT
    r.id AS request_id,
    r.request_type,
    r.db_name,
    r.comment,
    r.created_at,

    u.name AS requester_name,
    p.name AS pod_name,

    r.db_instance AS instance_name,

    CASE
      WHEN r.request_type = 'QUERY' THEN rq.query_text
      WHEN r.request_type = 'SCRIPT' THEN rs.file_path
    END AS content

  FROM requests r
  JOIN users u ON u.id = r.requester_id
  JOIN pods p ON p.id = r.pod_id

  -- TEXT → TEXT join
  
  LEFT JOIN db_instances i ON i.name = r.db_instance


  LEFT JOIN request_queries rq ON rq.request_id = r.id
  LEFT JOIN request_scripts rs ON rs.request_id = r.id

  WHERE
    r.status = 'PENDING'
    AND r.pod_id IN (
      SELECT id
      FROM pods
      WHERE manager_user_id = $1
    )

  ORDER BY r.created_at DESC
`;

    const { rows } = await pool.query(query, [managerId]);

    res.json({
      count: rows.length,
      requests: rows.map(r => ({
        id: r.request_id,
        type: r.request_type,
        database: `${r.instance_name} / ${r.db_name}`,
        content: r.content,
        requester: r.requester_name,
        pod: r.pod_name,
        approver: r.approver_name,
        comments: r.comment,
        submitted_at: r.created_at
      }))
    });
  } catch (err) {
    console.error('Get pending approvals error:', err);
    res.status(500).json({ message: 'Failed to fetch pending approvals' });
  }
};  


// get pending approvals with filter
exports.getPendingApprovals = async (req, res) => {
  try {
    const managerId = Number(req.user.id);

    const {
      pod_id,
      requester_id,
      db_instance,
      from,
      to
    } = req.query;

    const conditions = [
      'r.status = \'PENDING\'',
      'p.manager_user_id = $1'
    ];

    const params = [managerId];
    let idx = 2;

    if (pod_id) {
      conditions.push(`r.pod_id = $${idx++}`);
      params.push(pod_id);
    }

    if (requester_id) {
      conditions.push(`r.requester_id = $${idx++}`);
      params.push(requester_id);
    }

    if (db_instance) {
      conditions.push(`r.db_instance = $${idx++}`);
      params.push(db_instance);
    }

    if (from) {
      conditions.push(`r.created_at >= $${idx++}`);
      params.push(from);
    }

    if (to) {
      conditions.push(`r.created_at <= $${idx++}`);
      params.push(to);
    }

    const query = `
      SELECT
        r.id AS request_id,
        r.request_type,
        r.db_name,
        r.comment,
        r.created_at,

        u.name AS requester_name,
        p.name AS pod_name,
        r.db_instance AS instance_name,

        CASE
          WHEN r.request_type = 'QUERY' THEN rq.query_text
          WHEN r.request_type = 'SCRIPT' THEN rs.file_path
        END AS content

      FROM requests r
      JOIN users u ON u.id = r.requester_id
      JOIN pods p ON p.id = r.pod_id
      LEFT JOIN request_queries rq ON rq.request_id = r.id
      LEFT JOIN request_scripts rs ON rs.request_id = r.id

      WHERE ${conditions.join(' AND ')}

      ORDER BY r.created_at DESC
    `;

    const { rows } = await pool.query(query, params);

    res.json({
      count: rows.length,
      requests: rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch pending approvals' });
  }
};

const fs = require('fs/promises');
const path = require('path');

exports.getApprovalScriptPreview = async (req, res) => {
  try {
    const managerId = Number(req.user.id);
    const requestId = Number(req.params.id);

    if (Number.isNaN(requestId)) {
      return res.status(400).json({ message: 'Invalid request id' });
    }

    // 1️⃣ Fetch script metadata & authorization
    const { rows } = await pool.query(
      `
      SELECT
        rs.file_path
      FROM requests r
      JOIN pods p ON p.id = r.pod_id
      JOIN request_scripts rs ON rs.request_id = r.id
      WHERE r.id = $1
        AND r.status = 'PENDING'
        AND p.manager_user_id = $2
      `,
      [requestId, managerId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: 'Script not found or not authorized'
      });
    }

    const scriptPath = rows[0].file_path;

    // 2️⃣ Read script file
    const absolutePath = path.resolve(scriptPath);
    const content = await fs.readFile(absolutePath, 'utf-8');

    // 3️⃣ Return preview (read-only)
    res.json({
      requestId,
      preview: content
    });
  } catch (err) {
    console.error('Script preview error:', err);
    res.status(500).json({ message: 'Failed to load script preview' });
  }
};




exports.approveRequest = async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const managerId = Number(req.user.id);

    if (Number.isNaN(requestId)) {
      return res.status(400).json({ message: 'Invalid request id' });
    }

    const { rowCount } = await pool.query(
      `
      UPDATE requests r
      SET status = 'APPROVED',
          decided_at = NOW()
      FROM pods p
      WHERE r.id = $1
        AND r.status = 'PENDING'
        AND r.pod_id = p.id
        AND p.manager_user_id = $2
      `,
      [requestId, managerId]
    );

    if (rowCount === 0) {
      return res
        .status(404)
        .json({ message: 'Request not found or not authorized' });
    }

    res.json({ message: 'Request approved' });
  } catch (err) {
    console.error('Approve request error:', err);
    res.status(500).json({ message: 'Failed to approve request' });
  }
};

exports.rejectRequest = async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const managerId = Number(req.user.id);
    const { reason } = req.body;

    if (Number.isNaN(requestId)) {
      return res.status(400).json({ message: 'Invalid request id' });
    }

    const { rowCount } = await pool.query(
      `
      UPDATE requests r
      SET status = 'REJECTED',
          rejection_reason = $3,
          decided_at = NOW()
      FROM pods p
      WHERE r.id = $1
        AND r.status = 'PENDING'
        AND r.pod_id = p.id
        AND p.manager_user_id = $2
      `,
      [requestId, managerId, reason || null]
    );

    if (rowCount === 0) {
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
