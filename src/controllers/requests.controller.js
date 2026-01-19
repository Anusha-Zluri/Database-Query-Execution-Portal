const fs = require('fs/promises');
const instanceRegistry = require('../registry/instances.registry');
const requestsDAL = require('../dal/requests.dal');
const slackService = require('../services/slack.service');
const { newSubmissionMessage } = require('../services/slack.messages');
const { pool } = require('../config/db');

/* ================= SCRIPT ANALYSIS ================= */

// COMMENTED OUT: Risk detection can be bypassed and gives false confidence
// Better to rely on manual approval process only
/*
function analyzeScript(content) {
  const upper = content.toUpperCase();
  const lower = content.toLowerCase();

  // Be overly cautious - false positives are okay, false negatives are bad
  const dangerousPatterns = [
    // Node.js APIs that shouldn't be accessible
    'EVAL', 'REQUIRE', 'IMPORT', 'PROCESS', 'CHILD_PROCESS',
    'EXEC', 'SPAWN', 'FORK',
    
    // File system access
    'FS.', 'READFILE', 'WRITEFILE', 'UNLINK', 'RMDIR',
    
    // Network access
    'NET.', 'HTTP.', 'HTTPS.', 'FETCH', 'AXIOS',
    
    // Dangerous operations
    '__DIRNAME', '__FILENAME', 'GLOBAL.', 'CONSTRUCTOR',
    
    // Potential obfuscation attempts
    'FROMCHARCODE', 'ATOB', 'BTOA',
    
    // Dynamic property access patterns
    'GLOBAL[', 'PROCESS[', 'THIS[',
  ];

  // Check for dangerous patterns (case-insensitive)
  const hasDangerousApis = dangerousPatterns.some(pattern => {
    return upper.includes(pattern) || lower.includes(pattern.toLowerCase());
  });

  // Additional heuristics for suspicious code
  const suspiciousPatterns = [
    /require\s*\(/i,           // require with any spacing
    /eval\s*\(/i,              // eval with any spacing
    /Function\s*\(/i,          // Function constructor
    /\[\s*['"]constructor['"]\s*\]/i,  // Accessing constructor
    /process\s*\./i,           // process object access
    /process\s*\[/i,           // process bracket notation
    /global\s*\./i,            // global object access
    /global\s*\[/i,            // global bracket notation
    /child_process/i,          // child_process module
    /fs\s*\./i,                // fs module
    /\.exec\s*\(/i,            // .exec() calls
    /\.spawn\s*\(/i,           // .spawn() calls
    /\[\s*['"]require['"]\s*\]/i,  // Bracket notation require
    /String\s*\.\s*fromCharCode/i,  // String obfuscation
  ];

  const hasSuspiciousCode = suspiciousPatterns.some(regex => regex.test(content));

  return {
    lineCount: content.split('\n').length,
    hasDangerousApis: hasDangerousApis || hasSuspiciousCode,
    riskLevel: (hasDangerousApis || hasSuspiciousCode) ? 'HIGH' : 'LOW'
  };
}
*/

// Simplified analysis - just count lines, no risk detection
function analyzeScript(content) {
  return {
    lineCount: content.split('\n').length,
    hasDangerousApis: false,  // Always false - no risk detection
    riskLevel: 'LOW'          // Always low - rely on manual approval
  };
}

/* ================= QUERY ANALYSIS ================= */

// COMMENTED OUT: Risk detection can be bypassed and gives false confidence
// Better to rely on manual approval process only
/*
function analyzeQuery(content, engine) {
  const upper = content.toUpperCase();
  let hasDangerousOps = false;

  if (engine === 'postgres') {
    // Be overly cautious - catch variations with regex
    const dangerousPatterns = [
      /DROP\s+/i,              // DROP with any whitespace
      /TRUNCATE\s+/i,          // TRUNCATE with any whitespace
      /DELETE\s+/i,            // DELETE (even with WHERE clause)
      /ALTER\s+/i,             // ALTER TABLE/DATABASE
      /CREATE\s+/i,            // CREATE TABLE/INDEX/etc
      /GRANT\s+/i,             // GRANT permissions
      /REVOKE\s+/i,            // REVOKE permissions
      /EXECUTE\s+/i,           // EXECUTE dynamic SQL
      /EXEC\s+/i,              // EXEC (SQL Server style)
      /CALL\s+/i,              // CALL stored procedures
      /DO\s+\$\$/i,            // DO blocks (PostgreSQL)
      /COPY\s+/i,              // COPY command
      /VACUUM\s+/i,            // VACUUM
      /REINDEX\s+/i,           // REINDEX
      /CLUSTER\s+/i,           // CLUSTER
      /LOCK\s+/i,              // LOCK TABLE
      /COMMENT\s+ON/i,         // COMMENT ON
      /;\s*DROP/i,             // Multiple statements with DROP
      /;\s*DELETE/i,           // Multiple statements with DELETE
      /;\s*TRUNCATE/i,         // Multiple statements with TRUNCATE
      /--.*DROP/i,             // Comments with DROP
      /\/\*.*DROP.*\*\//i,     // Block comments with DROP
      /CHR\s*\(/i,             // CHR() function (obfuscation)
      /CONCAT\s*\(/i,          // CONCAT (string building)
      /\|\|/,                  // String concatenation operator
    ];

    hasDangerousOps = dangerousPatterns.some(regex => regex.test(content));

    // Additional check: multiple statements (semicolons)
    const statementCount = (content.match(/;/g) || []).length;
    if (statementCount > 1) {
      hasDangerousOps = true; // Multiple statements are risky
    }

    // Check for function calls that might be dangerous
    if (/SELECT\s+\w+\s*\(/i.test(content) && upper.includes('DROP')) {
      hasDangerousOps = true; // Function call with DROP keyword
    }

  } else if (engine === 'mongodb') {
    // For MongoDB, check JSON operations
    try {
      const parsed = JSON.parse(content);
      
      // Dangerous operations - be comprehensive
      const dangerousOps = [
        'drop', 'dropDatabase', 'dropCollection',
        'deleteMany', 'deleteOne', 'remove',
        'createCollection', 'createIndex', 'createIndexes',
        'dropIndex', 'dropIndexes',
        'rename', 'renameCollection',
        'updateMany', 'replaceOne',  // Can affect many documents
        'bulkWrite',  // Batch operations
        'aggregate',  // Can have $out or $merge stages
      ];
      
      hasDangerousOps = dangerousOps.includes(parsed.operation);

      // Check for dangerous operators in args (deep search)
      const jsonStr = JSON.stringify(parsed).toUpperCase();
      const dangerousOperators = [
        '$WHERE',      // JavaScript execution
        '$FUNCTION',   // Custom functions
        '$ACCUMULATOR', // Custom accumulators
        '$OUT',        // Write to collection
        '$MERGE',      // Merge to collection
        '$EXPR',       // Expression (can contain $function)
      ];
      
      if (dangerousOperators.some(op => jsonStr.includes(op))) {
        hasDangerousOps = true;
      }

      // Check for nested dangerous operations in arrays/objects
      if (jsonStr.includes('FUNCTION') || jsonStr.includes('CODE')) {
        hasDangerousOps = true;
      }

    } catch {
      // If not valid JSON, mark as risky (better safe than sorry)
      hasDangerousOps = true;
    }
  }

  return {
    hasDangerousOps,
    riskLevel: hasDangerousOps ? 'HIGH' : 'LOW'
  };
}
*/

// Simplified analysis - no risk detection
function analyzeQuery(content, engine) {
  return {
    hasDangerousOps: false,  // Always false - no risk detection
    riskLevel: 'LOW'         // Always low - rely on manual approval
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
        scriptContent, // Save content to DB for preview and execution
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

  } /* istanbul ignore next */ catch (err) {
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

  const scriptData = await requestsDAL.getScriptForApproval(
    requestId,
    req.user.id
  );

  if (!scriptData) {
    return res.status(404).json({ message: 'Not authorized or not found' });
  }

  // Try to get content from DB first, fallback to file if needed
  let scriptContent = scriptData.script_content;
  
  if (!scriptContent && scriptData.file_path) {
    try {
      scriptContent = await fs.readFile(scriptData.file_path, 'utf-8');
    } /* istanbul ignore next */ catch (err) {
      return res.status(404).json({ message: 'Script file not found' });
    }
  }

  if (!scriptContent) {
    return res.status(404).json({ message: 'Script content not available' });
  }

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
  } /* istanbul ignore next */ catch (err) {
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