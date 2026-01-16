const { getORM } = require('../config/orm');

/**
 * Execution DAL - MikroORM version
 * Handles execution records with transaction support
 */

async function getClient() {
  // For MikroORM, we return an EntityManager that can be used for transactions
  const orm = await getORM();
  return orm.em.fork();
}

/* ================= REQUEST ================= */

async function lockApprovedRequest(em, requestId) {
  // Use knex for parameterized queries
  const result = await em.getKnex().raw(
    `
    SELECT id, request_type, db_instance, db_name
    FROM requests
    WHERE id = ? AND status = 'APPROVED'
    FOR UPDATE
    `,
    [requestId]
  );

  return result.rows && result.rows.length > 0 ? result.rows[0] : null;
}

async function loadQueryText(em, requestId) {
  const result = await em.getKnex().raw(
    `SELECT query_text FROM request_queries WHERE request_id = ?`,
    [requestId]
  );
  return result.rows && result.rows.length > 0 ? result.rows[0].query_text : null;
}

async function loadScriptPath(em, requestId) {
  const result = await em.getKnex().raw(
    `SELECT file_path FROM request_scripts WHERE request_id = ?`,
    [requestId]
  );
  return result.rows && result.rows.length > 0 ? result.rows[0].file_path : null;
}

/* ================= EXECUTION ================= */

async function createExecution(em, requestId) {
  const result = await em.getKnex().raw(
    `
    INSERT INTO executions (request_id, status, started_at)
    VALUES (?, 'RUNNING', NOW())
    RETURNING id
    `,
    [requestId]
  );

  return result.rows && result.rows.length > 0 ? result.rows[0].id : null;
}

async function markExecutionSuccess(executionId, durationMs, result) {
  const orm = await getORM();
  const em = orm.em.fork();
  
  await em.getKnex().raw(
    `
    UPDATE executions
    SET status='SUCCESS',
        finished_at=NOW(),
        duration_ms=?,
        result_json=?
    WHERE id=?
    `,
    [durationMs, JSON.stringify(result), executionId]
  );
}

async function markExecutionFailure(executionId, durationMs, message, stackTrace = null) {
  const orm = await getORM();
  const em = orm.em.fork();
  
  await em.getKnex().raw(
    `
    UPDATE executions
    SET status='FAILED',
        finished_at=NOW(),
        duration_ms=?,
        error_message=?,
        stack_trace=?
    WHERE id=?
    `,
    [durationMs, message, stackTrace, executionId]
  );
}

async function markRequestExecuted(requestId) {
  const orm = await getORM();
  const em = orm.em.fork();
  
  await em.getKnex().raw(
    `UPDATE requests SET status='EXECUTED' WHERE id=?`,
    [requestId]
  );
}

/* ================= RESULT RETRIEVAL ================= */

async function getExecutionById(executionId) {
  const orm = await getORM();
  const em = orm.em.fork();
  
  const result = await em.getKnex().raw(
    `
    SELECT id, request_id, status, result_json, result_file_path, is_truncated
    FROM executions
    WHERE id = ?
    `,
    [executionId]
  );
  
  return result.rows && result.rows.length > 0 ? result.rows[0] : null;
}

async function checkExecutionAccess(executionId, userId) {
  const orm = await getORM();
  const em = orm.em.fork();
  
  const result = await em.getKnex().raw(
    `
    SELECT 1
    FROM executions e
    JOIN requests r ON r.id = e.request_id
    LEFT JOIN pods p ON p.id = r.pod_id
    WHERE e.id = ?
      AND (r.requester_id = ? OR p.manager_user_id = ?)
    `,
    [executionId, userId, userId]
  );
  
  return result.rows && result.rows.length > 0;
}

async function beginTransaction(em) {
  await em.begin();
}

async function commitTransaction(em) {
  await em.commit();
}

async function rollbackTransaction(em) {
  await em.rollback();
}

async function updateExecutionWithFile(executionId, durationMs, resultJson, resultFilePath, isTruncated) {
  const orm = await getORM();
  const em = orm.em.fork();
  
  await em.getKnex().raw(
    `
    UPDATE executions
    SET status='SUCCESS',
        finished_at=NOW(),
        duration_ms=?,
        result_json=?,
        result_file_path=?,
        is_truncated=?
    WHERE id=?
    `,
    [durationMs, JSON.stringify(resultJson), resultFilePath, isTruncated, executionId]
  );
}

async function getRequestDetailsForNotification(requestId) {
  const orm = await getORM();
  const em = orm.em.fork();
  
  const result = await em.getKnex().raw(
    `
    SELECT 
      r.id,
      r.db_instance,
      r.db_name,
      u.email as requester_email
    FROM requests r
    JOIN users u ON r.requester_id = u.id
    WHERE r.id = ?
    `,
    [requestId]
  );
  
  return result.rows && result.rows.length > 0 ? result.rows[0] : null;
}

module.exports = {
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
  checkExecutionAccess,
  updateExecutionWithFile,
  getRequestDetailsForNotification
};
