const fs = require('fs/promises');
const instanceRegistry = require('../registry/instances.registry');

const executionDAL = require('../dal/execution.dal');

const executePostgresScript = require('../execution/postgres/script.executor');
const executeMongoScript = require('../execution/mongodb/script.executor');

const { Pool } = require('pg');
const { MongoClient } = require('mongodb');

// Slack integration
const slackService = require('../services/slack.service');
const { approvalSuccessMessage, approvalFailureMessage } = require('../services/slack.messages');

/* ============================================================
   DISPATCH EXECUTION
============================================================ */
async function dispatchExecution(request, instance) {
  if (instance.engine === 'postgres') {
    return request.request_type === 'QUERY'
      ? executePostgresQuery(request, instance)
      : executePostgresScript(request, instance);
  }

  if (instance.engine === 'mongodb') {
    return request.request_type === 'QUERY'
      ? executeMongoQuery(request, instance)
      : executeMongoScript(request, instance);
  }

  throw new Error(`Unsupported engine: ${instance.engine}`);
}

/* ============================================================
   POSTGRES QUERY
============================================================ */
async function executePostgresQuery(request, instance) {
  const url = new URL(instance.baseUrl);
  url.pathname = `/${request.db_name}`;

  const execPool = new Pool({
    connectionString: url.toString()
  });

  try {
    const result = await execPool.query(request.query_text);
    return {
      rowCount: result.rowCount,
      rows: result.rows
    };
  } finally {
    await execPool.end();
  }
}

/* ============================================================
   MONGO QUERY
============================================================ */
async function executeMongoQuery(request, instance) {
  const payload = JSON.parse(request.query_text);
  const { collection, operation, args = {} } = payload;

  const client = new MongoClient(instance.baseUrl);
  await client.connect();

  try {
    const col = client.db(request.db_name).collection(collection);

    if (operation === 'find') {
      const docs = await col.find(args.filter || {}).toArray();
      return {
        rowCount: docs.length,
        rows: docs
      };
    }

    const result = await col[operation](...Object.values(args));
    return {
      rowCount: result?.modifiedCount ?? 0,
      rows: []
    };
  } finally {
    await client.close();
  }
}

/* ============================================================
   INTERNAL EXECUTION (ORCHESTRATION ONLY)
============================================================ */
async function executeRequestInternal(requestId) {
  const client = await executionDAL.getClient();
  let executionId = null;
  let startTime;

  try {
    /* ===============================
       1️⃣ METADATA TRANSACTION
    =============================== */
    await executionDAL.beginTransaction(client);

    const request = await executionDAL.lockApprovedRequest(client, requestId);
    if (!request) {
      throw new Error('Approved request not found');
    }

    if (request.request_type === 'QUERY') {
      request.query_text = await executionDAL.loadQueryText(client, requestId);
    } else {
      const filePath = await executionDAL.loadScriptPath(client, requestId);
      request.script_text = await fs.readFile(filePath, 'utf-8');
    }

    const instance = instanceRegistry[request.db_instance];
    if (!instance) {
      throw new Error('Invalid database instance');
    }

    executionId = await executionDAL.createExecution(client, requestId);
    startTime = Date.now();

    // 🔓 Make execution row durable
    await executionDAL.commitTransaction(client);

    /* ===============================
       2️⃣ ACTUAL EXECUTION
    =============================== */
    try {
      const result = await dispatchExecution(request, instance);

      // Store result with file handling for very large results
      const fs = require('fs').promises;
      const path = require('path');
      const RESULTS_DIR = path.join(__dirname, '../../uploads/results');
      const MAX_ROWS_TOTAL = 10000; // Only truncate if more than 10k rows
      const PREVIEW_ROWS = 100; // Preview size when truncated

      const totalRows = result.rowCount || 0;
      const allRows = result.rows || [];
      
      console.log(`[executeRequest] Execution ${executionId}: totalRows=${totalRows}`);
      
      const needsTruncation = totalRows > MAX_ROWS_TOTAL;
      let resultFilePath = null;
      let resultToStore = result;
      let isTruncated = false;

      if (needsTruncation) {
        // Only truncate if we exceed the max limit
        isTruncated = true;
        console.log(`[executeRequest] Truncating execution ${executionId} (${totalRows} rows > ${MAX_ROWS_TOTAL})`);
        
        await fs.mkdir(RESULTS_DIR, { recursive: true });
        
        // Store first 10k rows in file
        const rowsToStore = allRows.slice(0, MAX_ROWS_TOTAL);
        resultFilePath = path.join(RESULTS_DIR, `${executionId}.json`);
        await fs.writeFile(
          resultFilePath,
          JSON.stringify({
            rowCount: totalRows,
            rows: rowsToStore,
            truncated: true,
            truncatedAt: MAX_ROWS_TOTAL,
            storedAt: new Date().toISOString()
          }, null, 2)
        );
        
        console.log(`[executeRequest] Wrote ${rowsToStore.length} rows to ${resultFilePath}`);

        // Store only preview in database
        resultToStore = {
          rowCount: totalRows,
          rows: allRows.slice(0, PREVIEW_ROWS),
          preview: true,
          truncated: true,
          totalRowsInFile: MAX_ROWS_TOTAL
        };
      }

      // Update execution
      await executionDAL.updateExecutionWithFile(
        executionId,
        Date.now() - startTime,
        resultToStore,
        resultFilePath,
        isTruncated
      );
      
      console.log(`[executeRequest] Updated execution ${executionId}: isTruncated=${isTruncated}, resultFilePath=${resultFilePath}`);
      
      // Send success notification (non-blocking)
      sendExecutionSuccessNotification(requestId, Date.now() - startTime, result)
        .catch(err => console.error('Failed to send success notification:', err.message));
        
    } catch (execErr) {
      await executionDAL.markExecutionFailure(
        executionId,
        Date.now() - startTime,
        execErr.message,
        execErr.stack || null
      );
      
      // Send failure notification (non-blocking)
      sendExecutionFailureNotification(requestId, Date.now() - startTime, execErr.message, execErr.stack || null)
        .catch(err => console.error('Failed to send failure notification:', err.message));
    }

    /* ===============================
       3️⃣ ALWAYS MARK REQUEST EXECUTED
    =============================== */
    await executionDAL.markRequestExecuted(requestId);

  } catch (err) {
    // Rollback only if execution row was never created
    if (!executionId) {
      await executionDAL.rollbackTransaction(client);
    }
    throw err;
  } finally {
    client.release();
  }
}
/* ============================================================
   HTTP HANDLER (OPTIONAL / DEBUG)
============================================================ */
const executeRequest = async (req, res) => {
  try {
    await executeRequestInternal(Number(req.params.id));
    res.json({ message: 'Execution triggered' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ============================================================
   DOWNLOAD FULL RESULTS
============================================================ */
const downloadExecutionResults = async (req, res) => {
  try {
    const executionId = Number(req.params.id);
    
    // Get execution record
    const execution = await executionDAL.getExecutionById(executionId);
    
    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    // Check if user has access (must be requester or manager)
    const hasAccess = await executionDAL.checkExecutionAccess(executionId, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // If result is in file, serve the file
    if (execution.result_file_path) {
      const fileContent = await fs.readFile(execution.result_file_path, 'utf-8');
      const result = JSON.parse(fileContent);
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="execution-${executionId}-results.json"`);
      return res.json(result);
    }

    // Otherwise, return result from database
    res.json(execution.result_json);
  } catch (err) {
    console.error('Download results error:', err);
    res.status(500).json({ error: 'Failed to download results' });
  }
};

module.exports = {
  executeRequest,
  executeRequestInternal,
  downloadExecutionResults
};

/* ================= SLACK NOTIFICATION HELPERS ================= */

async function sendExecutionSuccessNotification(requestId, executionTime, result) {
  try {
    // Fetch request details from DAL
    const request = await executionDAL.getRequestDetailsForNotification(requestId);

    if (!request) {
      console.warn('Could not fetch request details for success notification');
      return;
    }
    
    // Prepare result preview (first 5 rows)
    const rowCount = result.rowCount || 0;
    const previewRows = (result.rows || []).slice(0, 5);
    const resultPreview = previewRows.length > 0 
      ? JSON.stringify(previewRows, null, 2)
      : 'No rows returned';

    const notificationData = {
      requestId,
      requesterEmail: request.requester_email,
      database: `${request.db_instance} / ${request.db_name}`,
      executionTime,
      rowCount,
      resultPreview
    };

    const message = approvalSuccessMessage(notificationData);
    
    // Send to common channel + requester DM
    await slackService.sendToChannelAndDM(
      request.requester_email,
      message.blocks,
      message.text
    );
    
    console.log(`Slack success notification sent for request #${requestId}`);
  } catch (error) {
    console.error('Error sending execution success notification:', error.message);
  }
}

async function sendExecutionFailureNotification(requestId, executionTime, errorMessage, stackTrace = null) {
  try {
    // Fetch request details from DAL
    const request = await executionDAL.getRequestDetailsForNotification(requestId);

    if (!request) {
      console.warn('Could not fetch request details for failure notification');
      return;
    }

    const notificationData = {
      requestId,
      requesterEmail: request.requester_email,
      database: `${request.db_instance} / ${request.db_name}`,
      errorMessage,
      stackTrace
    };

    const message = approvalFailureMessage(notificationData);
    
    // Send to common channel + requester DM
    await slackService.sendToChannelAndDM(
      request.requester_email,
      message.blocks,
      message.text
    );
    
    console.log(`Slack failure notification sent for request #${requestId}`);
  } catch (error) {
    console.error('Error sending execution failure notification:', error.message);
  }
}