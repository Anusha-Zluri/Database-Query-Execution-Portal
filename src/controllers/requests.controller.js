const { pool } = require('../config/db');
const fs = require('fs/promises');
const instanceRegistry = require('../registry/instances.registry');

/**
 * Simple static risk analysis for scripts
 */
function analyzeScript(content) {
  const upper = content.toUpperCase();

  const dangerousPatterns = [
    'EVAL(',
    'CHILD_PROCESS',
    'PROCESS.',
    'REQUIRE(',
    'FS.',
    'NET.',
    'SPAWN(',
    'EXEC('
  ];

  const hasDangerousApis = dangerousPatterns.some(p =>
    upper.includes(p)
  );

  return {
    lineCount: content.split('\n').length,
    hasDangerousApis,
    riskLevel: hasDangerousApis ? 'HIGH' : 'LOW'
  };
}


 //Submit QUERY or SCRIPT request
 
exports.submitRequest = async (req, res) => {
  const userId = req.user.id;

  const {
    request_type,
    pod_id,
    db_instance, // e.g. 'pg-local'
    db_name,     // e.g. 'analytics_db'
    content,
    comment
  } = req.body;

  console.log('BODY:', req.body);
  console.log('FILE:', req.file);

  
//basic validation
  if (!request_type || !pod_id || !db_instance || !db_name) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  if (!['QUERY', 'SCRIPT'].includes(request_type)) {
    return res.status(400).json({ message: 'Invalid request type' });
  }

  if (request_type === 'QUERY' && !content) {
    return res.status(400).json({ message: 'Query content is required' });
  }

  if (request_type === 'SCRIPT' && !req.file) {
    return res.status(400).json({ message: 'Script file is required' });
  }

 
//instance validation
  const instance = instanceRegistry[db_instance];
  if (!instance) {
    return res.status(400).json({
      message: `Unknown database instance: ${db_instance}`
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

  
    //insert into requests table
    const requestResult = await client.query(
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
        userId,
        pod_id,
        db_instance,
        db_name,
        request_type,
        comment
      ]
    );

    const requestId = requestResult.rows[0].id;

   

    if (request_type === 'QUERY') {
      await client.query(
        `
        INSERT INTO request_queries (
          request_id,
          query_text,
          detected_operation,
          is_safe
        )
        VALUES ($1, $2, NULL, NULL)
        `,
        [requestId, content]
      );
    } else {
      const scriptContent = await fs.readFile(req.file.path, 'utf-8');
      const analysis = analyzeScript(scriptContent);

      await client.query(
        `
        INSERT INTO request_scripts (
          request_id,
          file_path,
          line_count,
          risk_level,
          has_dangerous_apis
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          requestId,
          req.file.path,
          analysis.lineCount,
          analysis.riskLevel,
          analysis.hasDangerousApis
        ]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Request submitted successfully',
      request_id: requestId,
      status: 'PENDING'
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Submit request error:', err);
    res.status(400).json({ message: err.message });
  } finally {
    client.release();
  }
};


//approve request
exports.approveRequest = async (req, res) => {
  const requestId = Number(req.params.id);

  if (Number.isNaN(requestId)) {
    return res.status(400).json({ message: 'Invalid request id' });
  }

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
    [requestId, req.user.id]
  );

  if (rowCount === 0) {
    return res
      .status(404)
      .json({ message: 'Request not found or not authorized' });
  }

  res.json({ message: 'Request approved' });
};

//reject request
exports.rejectRequest = async (req, res) => {
  const requestId = Number(req.params.id);

  if (Number.isNaN(requestId)) {
    return res.status(400).json({ message: 'Invalid request id' });
  }

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
    [requestId, req.user.id]
  );

  if (rowCount === 0) {
    return res
      .status(404)
      .json({ message: 'Request not found or not authorized' });
  }

  res.json({ message: 'Request rejected' });
};

//show script content to manager for approval
exports.getScriptForApproval = async (req, res) => {
  const requestId = Number(req.params.id);

  if (Number.isNaN(requestId)) {
    return res.status(400).json({ message: 'Invalid request id' });
  }

  const { rows } = await pool.query(
    `
    SELECT rs.file_path
    FROM request_scripts rs
    JOIN requests r ON r.id = rs.request_id
    JOIN pods p ON p.id = r.pod_id
    WHERE rs.request_id = $1
      AND p.manager_user_id = $2
    `,
    [requestId, req.user.id]
  );

  if (!rows.length) {
    return res.status(404).json({ message: 'Not authorized or not found' });
  }

  const scriptContent = await fs.readFile(rows[0].file_path, 'utf-8');

  res.type('text/plain').send(scriptContent);
};
