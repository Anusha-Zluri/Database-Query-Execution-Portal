const submissionsDAL = require('../dal/submissions.dal');

/* ================= DASHBOARD ================= */

exports.getMySubmissions = async (req, res) => {
  const rows = await submissionsDAL.getMySubmissions(req.user.id);
  res.json(rows);
};

/* ================= DETAILS ================= */

exports.getSubmissionDetails = async (req, res) => {
  const submissionId = Number(req.params.id);

  const row = await submissionsDAL.getSubmissionDetails(
    submissionId,
    req.user.id
  );

  if (!row) {
    return res.status(404).json({ message: 'Submission not found' });
  }

  console.log('Row from DB:', {
    id: row.id,
    request_type: row.request_type,
    query_text: row.query_text,
    file_path: row.file_path
  });

  // For scripts, read the file content
  let content = row.query_text || '';
  if (row.request_type === 'SCRIPT' && row.file_path) {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const fullPath = path.resolve(row.file_path);
      console.log('Reading script from:', fullPath);
      content = await fs.readFile(fullPath, 'utf-8');
      console.log('Script content length:', content.length);
    } catch (err) {
      console.error('Failed to read script file:', err);
      content = `[Error reading script file: ${row.file_path}]`;
    }
  }

  console.log('Final content length:', content.length);

  res.json({
    id: row.id,
    dbInstance: row.db_instance,
    dbName: row.db_name,
    requestType: row.request_type,
    status: row.status,
    comment: row.comment,
    createdAt: row.created_at,

    content: content,

    execution: row.exec_status
      ? {
          id: row.exec_id,
          status: row.exec_status,
          startedAt: row.started_at,
          finishedAt: row.finished_at,
          durationMs: row.duration_ms,
          result: row.result_json,
          error: row.error_message,
          isTruncated: row.is_truncated,
          hasFullResultFile: !!row.result_file_path
        }
      : null
  });
};

/* ================= CLONE ================= */

exports.cloneSubmission = async (req, res) => {
  const sourceId = Number(req.params.id);
  const userId = req.user.id;

  const client = await submissionsDAL.getClient();

  try {
    await client.query('BEGIN');

    const newRequestId = await submissionsDAL.cloneSubmission(
      client,
      sourceId,
      userId
    );

    if (!newRequestId) {
      throw new Error('Submission not found');
    }

    await submissionsDAL.cloneQuery(client, sourceId, newRequestId);
    await submissionsDAL.cloneScript(client, sourceId, newRequestId);

    await client.query('COMMIT');

    res.status(201).json({ id: newRequestId });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
};

/* ================= DRAFT ================= */

exports.getSubmissionForEdit = async (req, res) => {
  const submissionId = Number(req.params.id);

  const row = await submissionsDAL.getDraftForEdit(
    submissionId,
    req.user.id
  );

  if (!row) {
    return res.status(404).json({ message: 'Draft not found' });
  }

  res.json(row);
};

exports.updateDraftSubmission = async (req, res) => {
  const submissionId = Number(req.params.id);
  const userId = req.user.id;

  const {
    pod_id,
    db_instance,
    db_name,
    comment,
    content
  } = req.body;

  const client = await submissionsDAL.getClient();

  try {
    await client.query('BEGIN');

    const ok = await submissionsDAL.updateDraft(client, {
      submissionId,
      userId,
      podId: pod_id,
      dbInstance: db_instance,
      dbName: db_name,
      comment,
      content
    });

    if (!ok) {
      throw new Error('Draft not found or locked');
    }

    await client.query('COMMIT');
    res.json({ message: 'Draft updated' });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
};

exports.submitDraft = async (req, res) => {
  const submissionId = Number(req.params.id);

  const ok = await submissionsDAL.submitDraft(
    submissionId,
    req.user.id
  );

  if (!ok) {
    return res.status(400).json({ message: 'Draft cannot be submitted' });
  }

  res.json({ message: 'Submitted for approval' });
};