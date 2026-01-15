const { pool } = require('../config/db');

/* ================= CONNECTION ================= */

function getClient() {
  return pool.connect();
}

/* ================= DASHBOARD ================= */

async function getMySubmissions(userId) {
  const { rows } = await pool.query(
    `
    SELECT
      r.id,
      r.db_instance,
      r.db_name,
      r.request_type,
      r.status,
      r.created_at,

      rq.query_text,
      rs.file_path,

      e.status      AS execution_status,
      e.finished_at AS executed_at

    FROM requests r
    LEFT JOIN request_queries rq ON rq.request_id = r.id
    LEFT JOIN request_scripts rs ON rs.request_id = r.id

    LEFT JOIN LATERAL (
      SELECT status, finished_at
      FROM executions
      WHERE request_id = r.id
      ORDER BY started_at DESC
      LIMIT 1
    ) e ON true

    WHERE r.requester_id = $1
      AND r.status != 'DRAFT'
    ORDER BY r.created_at DESC
    `,
    [userId]
  );

  return rows;
}

/* ================= DETAILS ================= */

async function getSubmissionDetails(submissionId, userId) {
  const { rows } = await pool.query(
    `
    SELECT
      r.id,
      r.requester_id,
      r.pod_id,
      r.request_type,
      r.db_instance,
      r.db_name,
      r.status,
      r.comment,
      r.created_at,

      rq.query_text,
      rs.file_path,

      e.id            AS exec_id,
      e.status        AS exec_status,
      e.started_at,
      e.finished_at,
      e.duration_ms,
      e.result_json,
      e.error_message,
      e.is_truncated,
      e.result_file_path

    FROM requests r
    LEFT JOIN request_queries rq ON rq.request_id = r.id
    LEFT JOIN request_scripts rs ON rs.request_id = r.id

    LEFT JOIN LATERAL (
      SELECT *
      FROM executions
      WHERE request_id = r.id
      ORDER BY started_at DESC
      LIMIT 1
    ) e ON true

    WHERE r.id = $1
      AND r.requester_id = $2
    `,
    [submissionId, userId]
  );

  return rows[0] || null;
}

/* ================= CLONE ================= */

async function cloneSubmission(client, sourceId, userId) {
  const { rows } = await client.query(
    `
    INSERT INTO requests (
      requester_id,
      pod_id,
      request_type,
      db_instance,
      db_name,
      status,
      comment
    )
    SELECT
      requester_id,
      pod_id,
      request_type,
      db_instance,
      db_name,
      'DRAFT',
      comment
    FROM requests
    WHERE id = $1 AND requester_id = $2
    RETURNING id
    `,
    [sourceId, userId]
  );

  return rows[0]?.id || null;
}

async function cloneQuery(client, sourceId, newRequestId) {
  await client.query(
    `
    INSERT INTO request_queries (request_id, query_text)
    SELECT $2, query_text
    FROM request_queries
    WHERE request_id = $1
    `,
    [sourceId, newRequestId]
  );
}

async function cloneScript(client, sourceId, newRequestId) {
  await client.query(
    `
    INSERT INTO request_scripts (request_id, file_path, checksum)
    SELECT $2, file_path, checksum
    FROM request_scripts
    WHERE request_id = $1
    `,
    [sourceId, newRequestId]
  );
}

/* ================= DRAFT ================= */

async function getDraftForEdit(submissionId, userId) {
  const { rows } = await pool.query(
    `
    SELECT
      r.id,
      r.pod_id,
      r.request_type,
      r.db_instance,
      r.db_name,
      r.comment,
      rq.query_text,
      rs.file_path
    FROM requests r
    LEFT JOIN request_queries rq ON rq.request_id = r.id
    LEFT JOIN request_scripts rs ON rs.request_id = r.id
    WHERE r.id = $1
      AND r.requester_id = $2
      AND r.status = 'DRAFT'
    `,
    [submissionId, userId]
  );

  return rows[0] || null;
}

async function updateDraft(
  client,
  {
    submissionId,
    userId,
    podId,
    dbInstance,
    dbName,
    comment,
    content
  }
) {
  const { rowCount } = await client.query(
    `
    UPDATE requests
    SET pod_id = $1,
        db_instance = $2,
        db_name = $3,
        comment = $4
    WHERE id = $5
      AND requester_id = $6
      AND status = 'DRAFT'
    `,
    [
      podId,
      dbInstance,
      dbName,
      comment,
      submissionId,
      userId
    ]
  );

  if (!rowCount) return false;

  await client.query(
    `
    UPDATE request_queries
    SET query_text = $2
    WHERE request_id = $1
    `,
    [submissionId, content]
  );

  return true;
}

async function submitDraft(submissionId, userId) {
  const { rowCount } = await pool.query(
    `
    UPDATE requests
    SET status = 'PENDING'
    WHERE id = $1
      AND requester_id = $2
      AND status = 'DRAFT'
    `,
    [submissionId, userId]
  );

  return rowCount > 0;
}

module.exports = {
  getClient,
  getMySubmissions,
  getSubmissionDetails,
  cloneSubmission,
  cloneQuery,
  cloneScript,
  getDraftForEdit,
  updateDraft,
  submitDraft
};