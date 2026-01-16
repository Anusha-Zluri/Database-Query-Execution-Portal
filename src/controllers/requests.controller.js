const fs = require('fs/promises');
const instanceRegistry = require('../registry/instances.registry');
const requestsDAL = require('../dal/requests.dal');
const slackService = require('../services/slack.service');
const { newSubmissionMessage } = require('../services/slack.messages');
const { pool } = require('../config/db');

/* ================= SCRIPT ANALYSIS ================= */

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

/* ================= QUERY ANALYSIS ================= */

function analyzeQuery(content, engine) {
  const upper = content.toUpperCase();
  let dangerousPatterns = [];
  let hasDangerousOps = false;

  if (engine === 'postgres') {
    dangerousPatterns = [
      'DROP ',
      'TRUNCATE ',
      'DELETE ',
      'ALTER ',
      'CREATE ',
      'GRANT ',
      'REVOKE '
    ];
    hasDangerousOps = dangerousPatterns.some(p => upper.includes(p));
  } else if (engine === 'mongodb') {
    // For MongoDB, check JSON operations
    try {
      const parsed = JSON.parse(content);
      const dangerousOps = ['drop', 'dropDatabase', 'deleteMany', 'deleteOne', 'remove', 'createCollection', 'createIndex'];
      hasDangerousOps = dangerousOps.includes(parsed.operation);
    } catch {
      // If not valid JSON, mark as risky
      hasDangerousOps = true;
    }
  }

  return {
    hasDangerousOps,
    riskLevel: hasDangerousOps ? 'HIGH' : 'LOW'
  };
}

/* ================= SUBMIT REQUEST ================= */

exports.submitRequest = async (req, res) => {
  const userId = req.user.id;
  const {
    request_type,
    pod_id,
    db_instance,
    db_name,
    content,
    comment
  } = req.body;

  // basic validation
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
    return res.status(400).json({ message: 'Script file is required. Please upload a .js file.' });
  }

  // instance validation
  const instance = instanceRegistry[db_instance];
  if (!instance) {
    return res.status(400).json({
      message: `Unknown database instance: ${db_instance}`
    });
  }

  const client = await requestsDAL.getClient();

  try {
    await client.query('BEGIN');

    const requestId = await requestsDAL.insertRequest(client, {
      requesterId: userId,
      podId: pod_id,
      dbInstance: db_instance,
      dbName: db_name,
      requestType: request_type,
      comment
    });

    if (request_type === 'QUERY') {
      const analysis = analyzeQuery(content, instance.engine);
      await requestsDAL.insertQueryRequest(client, requestId, content, analysis);
    } else {
      const scriptContent = await fs.readFile(req.file.path, 'utf-8'); //script preview
      const analysis = analyzeScript(scriptContent);

      await requestsDAL.insertScriptRequest(client, {
        requestId,
        filePath: req.file.path,
        lineCount: analysis.lineCount,
        riskLevel: analysis.riskLevel,
        hasDangerousApis: analysis.hasDangerousApis
      });
    }

    await client.query('COMMIT');

    // Send Slack notification (non-blocking)
    sendNewSubmissionNotification(requestId, userId, {
      request_type,
      db_instance,
      db_name,
      pod_id,
      content,
      filePath: req.file?.path
    }).catch(err => {
      console.error('Failed to send Slack notification:', err.message);
    });

    res.status(201).json({
      message: 'Request submitted successfully',
      request_id: requestId,
      status: 'PENDING'
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Submit request error:', err);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
};

/* ================= APPROVAL ================= */

exports.approveRequest = async (req, res) => {
  const requestId = Number(req.params.id);
  if (Number.isNaN(requestId)) {
    return res.status(400).json({ message: 'Invalid request id' });
  }

  const ok = await requestsDAL.approveRequest(requestId, req.user.id);
  if (!ok) {
    return res
      .status(404)
      .json({ message: 'Request not found or not authorized' });
  }

  res.json({ message: 'Request approved' });
};

exports.rejectRequest = async (req, res) => {
  const requestId = Number(req.params.id);
  if (Number.isNaN(requestId)) {
    return res.status(400).json({ message: 'Invalid request id' });
  }

  const ok = await requestsDAL.rejectRequest(requestId, req.user.id);
  if (!ok) {
    return res
      .status(404)
      .json({ message: 'Request not found or not authorized' });
  }

  res.json({ message: 'Request rejected' });
};

/* ================= SCRIPT REVIEW ================= */

exports.getScriptForApproval = async (req, res) => {
  const requestId = Number(req.params.id);
  if (Number.isNaN(requestId)) {
    return res.status(400).json({ message: 'Invalid request id' });
  }

  const filePath = await requestsDAL.getScriptPathForApproval(
    requestId,
    req.user.id
  );

  if (!filePath) {
    return res.status(404).json({ message: 'Not authorized or not found' });
  }

  const scriptContent = await fs.readFile(filePath, 'utf-8');
  res.type('text/plain').send(scriptContent);
};

/* ================= GET INSTANCES ================= */

exports.getInstances = async (req, res) => {
  const { type } = req.query;

  try {
    const instances = Object.entries(instanceRegistry).map(([name, config]) => ({
      name,
      engine: config.engine,
      description: config.description || ''
    }));

    // Filter by type if provided
    if (type) {
      const filtered = instances.filter(inst => inst.engine === type);
      return res.json({ instances: filtered });
    }

    res.json({ instances });
  } catch (err) {
    console.error('Get instances error:', err);
    res.status(500).json({ message: 'Failed to fetch instances' });
  }
};

/* ================= GET DATABASE TYPES ================= */

exports.getDatabaseTypes = async (req, res) => {
  try {
    // Extract unique database types from registry
    const types = [...new Set(
      Object.values(instanceRegistry).map(inst => inst.engine)
    )];

    res.json({ types });
  } catch (err) {
    console.error('Get database types error:', err);
    res.status(500).json({ message: 'Failed to fetch database types' });
  }
};

/* ================= GET DATABASES FROM INSTANCE ================= */

exports.getDatabases = async (req, res) => {
  const { instance } = req.query;

  if (!instance) {
    return res.status(400).json({ message: 'Instance name is required' });
  }

  const instanceConfig = instanceRegistry[instance];
  if (!instanceConfig) {
    return res.status(404).json({ message: 'Instance not found' });
  }

  try {
    let databases = [];

    if (instanceConfig.engine === 'postgres') {
      const { Client } = require('pg');
      const client = new Client({
        connectionString: instanceConfig.baseUrl
      });

      await client.connect();
      const result = await client.query(
        `SELECT datname FROM pg_database 
         WHERE datistemplate = false 
         AND datname NOT IN ('postgres', 'template0', 'template1', 'neon')
         ORDER BY datname`
      );
      databases = result.rows.map(row => row.datname);
      await client.end();

    } else if (instanceConfig.engine === 'mongodb') {
      const { MongoClient } = require('mongodb');
      const client = new MongoClient(instanceConfig.baseUrl);

      await client.connect();
      const adminDb = client.db().admin();
      const result = await adminDb.listDatabases();
      databases = result.databases
        .filter(db => !['admin', 'local', 'config'].includes(db.name))
        .map(db => db.name);
      await client.close();
    }

    res.json({ databases });
  } catch (err) {
    console.error('Get databases error:', err);
    res.status(500).json({ 
      message: 'Failed to fetch databases from instance',
      error: err.message 
    });
  }
};

/* ================= SLACK NOTIFICATION HELPER ================= */

async function sendNewSubmissionNotification(requestId, userId, data) {
  try {
    // Fetch user and pod details
    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    const podResult = await pool.query('SELECT name FROM pods WHERE id = $1', [data.pod_id]);
    
    if (!userResult.rows[0] || !podResult.rows[0]) {
      console.warn('Could not fetch user or pod details for Slack notification');
      return;
    }

    const requesterEmail = userResult.rows[0].email;
    const podName = podResult.rows[0].name;
    
    // Get script preview if it's a script request
    let scriptPreview = '';
    if (data.request_type === 'SCRIPT' && data.filePath) {
      try {
        const scriptContent = await fs.readFile(data.filePath, 'utf-8');
        // Show first 500 characters as preview
        scriptPreview = scriptContent.length > 500 
          ? scriptContent.substring(0, 500) + '...' 
          : scriptContent;
      } catch (error) {
        console.error('Failed to read script file for Slack preview:', error.message);
        scriptPreview = '[Script file could not be read]';
      }
    }
    
    // Prepare notification data
    const notificationData = {
      requestId,
      requesterEmail,
      database: data.db_instance,
      dbName: data.db_name,
      requestType: data.request_type,
      pod: podName,
      queryPreview: data.content || scriptPreview,
      scriptPath: data.filePath ? data.filePath.split('/').pop() : '' // Just filename, not full path
    };

    // Create message
    const message = newSubmissionMessage(notificationData);
    
    // Send to common channel (non-blocking)
    await slackService.sendToCommonChannel(message.blocks, message.text);
    
    console.log(`Slack notification sent for request #${requestId}`);
  } catch (error) {
    console.error('Error sending new submission notification:', error.message);
    // Don't throw - we don't want to break the request submission
  }
}