const { getORM } = require('../config/orm');
const { pool } = require('../config/db');

/**
 * Submissions DAL - MikroORM version
 * Returns exact same data structure as pg pool version
 */

/* ================= CONNECTION ================= */

async function getClient() {
  return pool.connect();
}

/* ================= DASHBOARD ================= */

async function getMySubmissions(userId, filters = {}) {
  const orm = await getORM();
  const em = orm.em.fork();
  
  // Build WHERE conditions
  const conditions = ['r.requester_id = ?', "r.status != 'DRAFT'"];
  const params = [userId];
  
  // Add status filter if provided
  if (filters.status && filters.status !== 'ALL') {
    if (filters.status === 'FAILED') {
      // For FAILED, check execution status
      conditions.push("e.status = 'FAILED'");
    } else {
      // For other statuses, check request status AND execution is not failed
      conditions.push('r.status = ?');
      conditions.push("(e.status IS NULL OR e.status != 'FAILED')");
      params.push(filters.status);
    }
  }
  
  const whereClause = conditions.join(' AND ');
  
  // Get total count with filters - need to include execution join for FAILED filter
  const countResult = await em.getKnex().raw(
    `
    SELECT COUNT(*) as total
    FROM requests r
    LEFT JOIN LATERAL (
      SELECT status
      FROM executions
      WHERE request_id = r.id
      ORDER BY started_at DESC
      LIMIT 1
    ) e ON true
    WHERE ${whereClause}
    `,
    params
  );
  
  const total = parseInt(countResult.rows[0].total);
  
  // Pagination
  const limit = parseInt(filters.limit) || 10;
  const page = parseInt(filters.page) || 1;
  const offset = (page - 1) * limit;
  
  // Add pagination params
  params.push(limit, offset);
  
  // Use knex query builder for parameterized queries
  const result = await em.getKnex().raw(
    `
    SELECT
      r.id,
      r.db_instance,
      r.db_name,
      r.request_type,
      r.status,
      r.created_at,
      r.rejection_reason,

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

    WHERE ${whereClause}
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
    `,
    params
  );

  return {
    rows: result.rows || [],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

/* ================= STATUS COUNTS ================= */

async function getSubmissionStatusCounts(userId) {
  const orm = await getORM();
  const em = orm.em.fork();
  
  const result = await em.getKnex().raw(
    `
    SELECT 
      CASE
        -- If execution exists and failed, count as FAILED
        WHEN e.status = 'FAILED' THEN 'FAILED'
        -- Otherwise use request status
        ELSE r.status
      END as status,
      COUNT(*) as count
    FROM requests r
    LEFT JOIN LATERAL (
      SELECT status
      FROM executions
      WHERE request_id = r.id
      ORDER BY started_at DESC
      LIMIT 1
    ) e ON true
    WHERE r.requester_id = ? 
      AND r.status != 'DRAFT'
    GROUP BY 
      CASE
        WHEN e.status = 'FAILED' THEN 'FAILED'
        ELSE r.status
      END
    `,
    [userId]
  );

  // Convert to object with default 0 values
  const counts = {
    ALL: 0,
    PENDING: 0,
    EXECUTED: 0,
    REJECTED: 0,
    FAILED: 0
  };

  let total = 0;
  (result.rows || []).forEach(row => {
    const count = parseInt(row.count);
    counts[row.status] = count;
    total += count;
  });
  
  counts.ALL = total;
  return counts;
}

async function getSubmissionDetails(submissionId, userId) {
  const orm = await getORM();
  const em = orm.em.fork();
  
  const result = await em.getKnex().raw(
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
      r.rejection_reason,

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

    WHERE r.id = ?
      AND r.requester_id = ?
    `,
    [submissionId, userId]
  );

  return result.rows && result.rows.length > 0 ? result.rows[0] : null;
}

/* ================= CLONE ================= */

async function cloneSubmission(em, sourceId, userId) {
  const result = await em.getKnex().raw(
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
    WHERE id = ? AND requester_id = ?
    RETURNING id
    `,
    [sourceId, userId]
  );

  return result.rows && result.rows.length > 0 ? result.rows[0].id : null;
}

async function cloneQuery(em, sourceId, newRequestId) {
  await em.getKnex().raw(
    `
    INSERT INTO request_queries (request_id, query_text)
    SELECT ?, query_text
    FROM request_queries
    WHERE request_id = ?
    `,
    [newRequestId, sourceId]
  );
}

async function cloneScript(em, sourceId, newRequestId) {
  await em.getKnex().raw(
    `
    INSERT INTO request_scripts (request_id, file_path, checksum)
    SELECT ?, file_path, checksum
    FROM request_scripts
    WHERE request_id = ?
    `,
    [newRequestId, sourceId]
  );
}

/* ================= DRAFT ================= */

async function getDraftForEdit(submissionId, userId) {
  const orm = await getORM();
  const em = orm.em.fork();
  
  const result = await em.getKnex().raw(
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
    WHERE r.id = ?
      AND r.requester_id = ?
      AND r.status = 'DRAFT'
    `,
    [submissionId, userId]
  );

  return result.rows && result.rows.length > 0 ? result.rows[0] : null;
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
  const result = await client.query(
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

  if (result.rowCount === 0) return false;

  await client.query(
    `
    UPDATE request_queries
    SET query_text = $1
    WHERE request_id = $2
    `,
    [content, submissionId]
  );

  return true;
}

async function submitDraft(submissionId, userId) {
  const orm = await getORM();
  const em = orm.em.fork();
  
  const result = await em.getKnex().raw(
    `
    UPDATE requests
    SET status = 'PENDING'
    WHERE id = ?
      AND requester_id = ?
      AND status = 'DRAFT'
    `,
    [submissionId, userId]
  );

  return result.rowCount > 0;
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

module.exports = {
  getClient,
  getMySubmissions,
  getSubmissionStatusCounts,
  getSubmissionDetails,
  cloneSubmission,
  cloneQuery,
  cloneScript,
  getDraftForEdit,
  updateDraft,
  submitDraft,
  beginTransaction,
  commitTransaction,
  rollbackTransaction
};
