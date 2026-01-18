const { pool } = require('../config/db');

/* ================= TRANSACTION ================= */

function getClient() {
  return pool.connect();
}

/* ================= REQUEST ================= */
//store into the requests table
async function insertRequest(
  client,
  {
    requesterId,
    podId,
    dbInstance,
    dbName,
    requestType,
    comment
  }
) {
  const { rows } = await client.query(
    `
    INSERT INTO requests (
      requester_id,
      pod_id,
      db_instance,
      db_name,
      request_type,
      comment,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
    RETURNING id
    `,
    [
      requesterId,
      podId,
      dbInstance,
      dbName,
      requestType,
      comment
    ]
  );

  return rows[0].id;
}



async function insertQueryRequest(client, requestId, queryText, analysis = {}) {
  await client.query(
    `
    INSERT INTO request_queries (
      request_id,
      query_text,
      detected_operation,
      is_safe
    )
    VALUES ($1, $2, $3, $4)
    `,
    [
      requestId, 
      queryText, 
      analysis.riskLevel || 'LOW',
      !analysis.hasDangerousOps
    ]
  );
}

async function insertScriptRequest(
  client,
  {
    requestId,
    filePath,
    scriptContent,
    lineCount,
    riskLevel,
    hasDangerousApis
  }
) {
  await client.query(
    `
    INSERT INTO request_scripts (
      request_id,
      file_path,
      script_content,
      line_count,
      risk_level,
      has_dangerous_apis
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      requestId,
      filePath,
      scriptContent,
      lineCount,
      riskLevel,
      hasDangerousApis
    ]
  );
}

/* ================= APPROVAL ================= */

async function approveRequest(requestId, managerUserId) {
  const { rowCount } = await pool.query(
    `
    UPDATE requests r
    SET status = 'APPROVED'
    FROM pods p
    WHERE r.id = $1
      AND r.status = 'PENDING'
      AND r.pod_id = p.id
      AND p.manager_user_id = $2
    `,
    [requestId, managerUserId]
  );

  return rowCount > 0;
}

async function rejectRequest(requestId, managerUserId) {
  const { rowCount } = await pool.query(
    `
    UPDATE requests r
    SET status = 'REJECTED'
    FROM pods p
    WHERE r.id = $1
      AND r.status = 'PENDING'
      AND r.pod_id = p.id
      AND p.manager_user_id = $2
    `,
    [requestId, managerUserId]
  );

  return rowCount > 0;
}

/* ================= SCRIPT REVIEW ================= */

async function getScriptForApproval(requestId, managerUserId) {
  const { rows } = await pool.query(
    `
    SELECT rs.file_path, rs.script_content
    FROM request_scripts rs
    JOIN requests r ON r.id = rs.request_id
    JOIN pods p ON p.id = r.pod_id
    WHERE rs.request_id = $1
      AND p.manager_user_id = $2
    `,
    [requestId, managerUserId]
  );

  return rows[0] || null;
}

// Keep old function for backward compatibility
async function getScriptPathForApproval(requestId, managerUserId) {
  const { rows } = await pool.query(
    `
    SELECT rs.file_path
    FROM request_scripts rs
    JOIN requests r ON r.id = rs.request_id
    JOIN pods p ON p.id = r.pod_id
    WHERE rs.request_id = $1
      AND p.manager_user_id = $2
    `,
    [requestId, managerUserId]
  );

  return rows[0]?.file_path || null;
}

module.exports = {
  getClient,
  insertRequest,
  insertQueryRequest,
  insertScriptRequest,
  approveRequest,
  rejectRequest,
  getScriptForApproval,
  getScriptPathForApproval
};