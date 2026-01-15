const { pool } = require('../config/db');


function getClient() {
  return pool.connect();
}

/* ================= REQUEST ================= */

async function lockApprovedRequest(client, requestId) {
  const { rows } = await client.query(
    `
    SELECT id, request_type, db_instance, db_name
    FROM requests
    WHERE id = $1 AND status = 'APPROVED'
    FOR UPDATE
    `,
    [requestId]
  );

  return rows[0] || null;
}

async function loadQueryText(client, requestId) {
  const { rows } = await client.query(
    `SELECT query_text FROM request_queries WHERE request_id = $1`,
    [requestId]
  );
  return rows[0]?.query_text;
}

async function loadScriptPath(client, requestId) {
  const { rows } = await client.query(
    `SELECT file_path FROM request_scripts WHERE request_id = $1`,
    [requestId]
  );
  return rows[0]?.file_path;
}

/* ================= EXECUTION ================= */

async function createExecution(client, requestId) {
  const { rows } = await client.query(
    `
    INSERT INTO executions (request_id, status, started_at)
    VALUES ($1, 'RUNNING', NOW())
    RETURNING id
    `,
    [requestId]
  );

  return rows[0].id;
}

async function markExecutionSuccess(executionId, durationMs, result) {
  await pool.query(
    `
    UPDATE executions
    SET status='SUCCESS',
        finished_at=NOW(),
        duration_ms=$2,
        result_json=$3
    WHERE id=$1
    `,
    [executionId, durationMs, JSON.stringify(result)]
  );
}

async function markExecutionFailure(executionId, durationMs, message) {
  await pool.query(
    `
    UPDATE executions
    SET status='FAILED',
        finished_at=NOW(),
        duration_ms=$2,
        error_message=$3
    WHERE id=$1
    `,
    [executionId, durationMs, message]
  );
}

async function markRequestExecuted(requestId) {
  await pool.query(
    `UPDATE requests SET status='EXECUTED' WHERE id=$1`,
    [requestId]
  );
}

/* ================= RESULT RETRIEVAL ================= */

async function getExecutionById(executionId) {
  const { rows } = await pool.query(
    `
    SELECT id, request_id, status, result_json, result_file_path, is_truncated
    FROM executions
    WHERE id = $1
    `,
    [executionId]
  );
  return rows[0] || null;
}

async function checkExecutionAccess(executionId, userId) {
  const { rows } = await pool.query(
    `
    SELECT 1
    FROM executions e
    JOIN requests r ON r.id = e.request_id
    LEFT JOIN pods p ON p.id = r.pod_id
    WHERE e.id = $1
      AND (r.requester_id = $2 OR p.manager_user_id = $2)
    `,
    [executionId, userId]
  );
  return rows.length > 0;
}

async function beginTransaction(client) {
  await client.query('BEGIN');
}

async function commitTransaction(client) {
  await client.query('COMMIT');
}

async function rollbackTransaction(client) {
  await client.query('ROLLBACK');
}

module.exports = {
  pool,
  getClient,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  lockApprovedRequest,
  loadQueryText,
  loadScriptPath,
  createExecution,
  markExecutionSuccess,
  markExecutionFailure,
  markRequestExecuted,
  getExecutionById,
  checkExecutionAccess
};