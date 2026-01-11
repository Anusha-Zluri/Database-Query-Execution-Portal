const { pool } = require('../config/db');

//my submission dashboard
exports.getMySubmissions = async (req, res) => {
  const userId = req.user.id;

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
    ORDER BY r.created_at DESC
    `,
    [userId]
  );

  res.json(rows);
};

//get submission details
exports.getSubmissionDetails = async (req, res) => {
  const submissionId = Number(req.params.id);
  const userId = req.user.id;

  const { rows } = await pool.query(
    `
    SELECT
      r.*,

      rq.query_text,
      rs.file_path,

      e.status        AS exec_status,
      e.started_at,
      e.finished_at,
      e.duration_ms,
      e.result_json,
      e.error_message

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

  if (!rows.length) {
    return res.status(404).json({ message: 'Submission not found' });
  }

  const row = rows[0];

  res.json({
    id: row.id,
    dbInstance: row.db_instance,
    dbName: row.db_name,
    requestType: row.request_type,
    status: row.status,
    comment: row.comment,
    createdAt: row.created_at,

    content: row.query_text || row.file_path,

    execution: row.exec_status
      ? {
          status: row.exec_status,
          startedAt: row.started_at,
          finishedAt: row.finished_at,
          durationMs: row.duration_ms,
          result: row.result_json,
          error: row.error_message
        }
      : null
  });
};

//clone a submission
exports.cloneSubmission = async (req, res) => {
  const userId = req.user.id;
  const sourceId = Number(req.params.id);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

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
        'PENDING',
        comment
      FROM requests
      WHERE id = $1 AND requester_id = $2
      RETURNING id
      `,
      [sourceId, userId]
    );

    if (!rows.length) {
      throw new Error('Submission not found');
    }

    const newRequestId = rows[0].id;

    // Clone query (if exists)
    await client.query(
      `
      INSERT INTO request_queries (request_id, query_text)
      SELECT $2, query_text
      FROM request_queries
      WHERE request_id = $1
      `,
      [sourceId, newRequestId]
    );

    // Clone script (if exists)
    await client.query(
      `
      INSERT INTO request_scripts (request_id, file_path, checksum)
      SELECT $2, file_path, checksum
      FROM request_scripts
      WHERE request_id = $1
      `,
      [sourceId, newRequestId]
    );

    await client.query('COMMIT');

    res.status(201).json({ id: newRequestId });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
};
