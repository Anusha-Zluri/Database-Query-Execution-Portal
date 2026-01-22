const { pool } = require('../config/db');

/* ================= LIST PENDING ================= */

async function getPendingApprovals(managerId, filters = {}) {
  const conditions = [
    `p.manager_user_id = $1`
  ];

  const params = [managerId];
  let idx = 2;

  // Status filter - default to PENDING, but allow APPROVED/EXECUTED
  if (filters.status) {
    if (filters.status === 'APPROVED') {
      // Show both APPROVED and EXECUTED since approval triggers execution
      conditions.push(`r.status IN ('APPROVED', 'EXECUTED')`);
    } else {
      conditions.push(`r.status = $${idx++}`);
      params.push(filters.status);
    }
  } else {
    // Default: only show PENDING
    conditions.push(`r.status = 'PENDING'`);
  }

  if (filters.pod_id) {
    conditions.push(`r.pod_id = $${idx++}`);
    params.push(filters.pod_id);
  }

  if (filters.requester_id) {
    conditions.push(`r.requester_id = $${idx++}`);
    params.push(filters.requester_id);
  }

  if (filters.db_instance) {
    conditions.push(`r.db_instance = $${idx++}`);
    params.push(filters.db_instance);
  }

  if (filters.from) {
    conditions.push(`r.created_at >= $${idx++}::date`);
    params.push(filters.from);
  }

  if (filters.to) {
    conditions.push(`r.created_at < ($${idx++}::date + INTERVAL '1 day')`);
    params.push(filters.to);
  }

  // Search filter - search across multiple fields
  if (filters.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(`(
      r.db_instance ILIKE $${idx} OR
      r.db_name ILIKE $${idx} OR
      u.email ILIKE $${idx} OR
      p.name ILIKE $${idx} OR
      r.comment ILIKE $${idx} OR
      rq.query_text ILIKE $${idx}
    )`);
    params.push(searchTerm);
    idx++;
  }

  const whereClause = conditions.join(' AND ');

  // Get total count - need to join query table for search
  const countQuery = `
    SELECT COUNT(*) as total
    FROM requests r
    JOIN users u ON u.id = r.requester_id
    JOIN pods p ON p.id = r.pod_id
    LEFT JOIN request_queries rq ON rq.request_id = r.id
    WHERE ${whereClause}
  `;

  const { rows: countRows } = await pool.query(countQuery, params);
  const total = parseInt(countRows[0].total);

  // Pagination
  const limit = parseInt(filters.limit) || 10;
  const page = parseInt(filters.page) || 1;
  const offset = (page - 1) * limit;

  params.push(limit, offset);

  const query = `
    SELECT
      r.id AS request_id,
      r.request_type,
      r.db_name,
      r.comment,
      r.created_at,
      r.status,

      u.email AS requester_email,
      p.name AS pod_name,
      r.db_instance AS instance_name,

      CASE
        WHEN r.request_type = 'QUERY' THEN rq.query_text
        WHEN r.request_type = 'SCRIPT' THEN rs.file_path
      END AS content,
      
      CASE
        WHEN r.request_type = 'QUERY' THEN rq.detected_operation
        WHEN r.request_type = 'SCRIPT' THEN rs.risk_level
      END AS risk_level,
      
      CASE
        WHEN r.request_type = 'QUERY' THEN NOT rq.is_safe
        WHEN r.request_type = 'SCRIPT' THEN rs.has_dangerous_apis
      END AS has_dangerous_ops

    FROM requests r
    JOIN users u ON u.id = r.requester_id
    JOIN pods p ON p.id = r.pod_id
    LEFT JOIN request_queries rq ON rq.request_id = r.id
    LEFT JOIN request_scripts rs ON rs.request_id = r.id

    WHERE ${whereClause}

    ORDER BY r.created_at DESC
    LIMIT $${idx++} OFFSET $${idx++}
  `;

  const { rows } = await pool.query(query, params);
  
  return {
    rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

/* ================= SCRIPT PREVIEW ================= */

async function getScriptForApproval(requestId, managerId) {
  const { rows } = await pool.query(
    `
    SELECT rs.file_path, rs.script_content
    FROM requests r
    JOIN pods p ON p.id = r.pod_id
    JOIN request_scripts rs ON rs.request_id = r.id
    WHERE r.id = $1
      AND r.status = 'PENDING'
      AND p.manager_user_id = $2
    `,
    [requestId, managerId]
  );

  return rows[0] || null;
}

// Keep old function for backward compatibility
async function getScriptPathForApproval(requestId, managerId) {
  const { rows } = await pool.query(
    `
    SELECT rs.file_path
    FROM requests r
    JOIN pods p ON p.id = r.pod_id
    JOIN request_scripts rs ON rs.request_id = r.id
    WHERE r.id = $1
      AND r.status = 'PENDING'
      AND p.manager_user_id = $2
    `,
    [requestId, managerId]
  );

  return rows[0]?.file_path || null;
}

/* ================= APPROVE / REJECT ================= */

async function approveRequest(requestId, managerId) {
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

  return rowCount > 0;
}

async function rejectRequest(requestId, managerId, reason) {
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

  return rowCount > 0;
}

async function getRequestDetailsForRejection(requestId) {
  const { rows } = await pool.query(
    `
    SELECT 
      r.id,
      r.request_type,
      r.db_instance,
      r.db_name,
      u.email as requester_email,
      rq.query_text,
      rs.file_path
    FROM requests r
    JOIN users u ON r.requester_id = u.id
    LEFT JOIN request_queries rq ON rq.request_id = r.id
    LEFT JOIN request_scripts rs ON rs.request_id = r.id
    WHERE r.id = $1
    `,
    [requestId]
  );

  return rows[0] || null;
}

module.exports = {
  getPendingApprovals,
  getScriptForApproval,
  getScriptPathForApproval,
  approveRequest,
  rejectRequest,
  getRequestDetailsForRejection
};
