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
    
    // For DDL statements (CREATE, DROP, ALTER) that return no rows
    if (result.rows.length === 0 && result.command) {
      return {
        rowCount: 1,
        rows: [{
          command: result.command,
          message: `${result.command} command executed successfully`,
          rowCount: result.rowCount || 0
        }]
      };
    }
    
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
  const { collection, operation, args = {}, data } = payload;

  const client = new MongoClient(instance.baseUrl);
  await client.connect();

  try {
    const col = client.db(request.db_name).collection(collection);

    // Handle find operation
    if (operation === 'find') {
      const docs = await col.find(args.filter || {}).toArray();
      return {
        rowCount: docs.length,
        rows: docs
      };
    }

    // Handle findOne
    if (operation === 'findOne') {
      const doc = await col.findOne(args.filter || {});
      return {
        rowCount: doc ? 1 : 0,
        rows: doc ? [doc] : []
      };
    }

    // Handle countDocuments
    if (operation === 'countDocuments') {
      const count = await col.countDocuments(args.filter || {});
      return {
        rowCount: 1,
        rows: [{ count }]
      };
    }

    // Handle estimatedDocumentCount
    if (operation === 'estimatedDocumentCount') {
      const count = await col.estimatedDocumentCount();
      return {
        rowCount: 1,
        rows: [{ count }]
      };
    }

    // Handle distinct
    if (operation === 'distinct') {
      const field = args.field || args.key;
      const filter = args.filter || {};
      const values = await col.distinct(field, filter);
      return {
        rowCount: values.length,
        rows: values.map(v => ({ value: v }))
      };
    }

    // Handle insertOne - accepts either "data" or "args.document"
    if (operation === 'insertOne') {
      const document = data || args.document || args;
      const result = await col.insertOne(document);
      return {
        rowCount: result.acknowledged ? 1 : 0,
        rows: [{ insertedId: result.insertedId, acknowledged: result.acknowledged }]
      };
    }

    // Handle insertMany - accepts either "data" or "args.documents"
    if (operation === 'insertMany') {
      const documents = data || args.documents || args;
      const result = await col.insertMany(documents);
      return {
        rowCount: result.insertedCount || 0,
        rows: [{ insertedIds: result.insertedIds, insertedCount: result.insertedCount }]
      };
    }

    // Handle updateOne
    if (operation === 'updateOne') {
      const filter = args.filter || {};
      const update = args.update || {};
      const options = args.options || {};
      const result = await col.updateOne(filter, update, options);
      return {
        rowCount: result.modifiedCount || 0,
        rows: [{ 
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          upsertedId: result.upsertedId,
          upsertedCount: result.upsertedCount,
          acknowledged: result.acknowledged
        }]
      };
    }

    // Handle updateMany
    if (operation === 'updateMany') {
      const filter = args.filter || {};
      const update = args.update || {};
      const options = args.options || {};
      const result = await col.updateMany(filter, update, options);
      return {
        rowCount: result.modifiedCount || 0,
        rows: [{ 
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          upsertedId: result.upsertedId,
          upsertedCount: result.upsertedCount,
          acknowledged: result.acknowledged
        }]
      };
    }

    // Handle replaceOne
    if (operation === 'replaceOne') {
      const filter = args.filter || {};
      const replacement = args.replacement || data || {};
      const options = args.options || {};
      const result = await col.replaceOne(filter, replacement, options);
      return {
        rowCount: result.modifiedCount || 0,
        rows: [{ 
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          upsertedId: result.upsertedId,
          acknowledged: result.acknowledged
        }]
      };
    }

    // Handle deleteOne
    if (operation === 'deleteOne') {
      const filter = args.filter || args || {};
      const result = await col.deleteOne(filter);
      return {
        rowCount: result.deletedCount || 0,
        rows: [{ deletedCount: result.deletedCount, acknowledged: result.acknowledged }]
      };
    }

    // Handle deleteMany
    if (operation === 'deleteMany') {
      const filter = args.filter || args || {};
      const result = await col.deleteMany(filter);
      return {
        rowCount: result.deletedCount || 0,
        rows: [{ deletedCount: result.deletedCount, acknowledged: result.acknowledged }]
      };
    }

    // Handle findOneAndUpdate
    if (operation === 'findOneAndUpdate') {
      const filter = args.filter || {};
      const update = args.update || {};
      const options = args.options || { returnDocument: 'after' };
      const result = await col.findOneAndUpdate(filter, update, options);
      return {
        rowCount: result.value ? 1 : 0,
        rows: result.value ? [result.value] : []
      };
    }

    // Handle findOneAndReplace
    if (operation === 'findOneAndReplace') {
      const filter = args.filter || {};
      const replacement = args.replacement || data || {};
      const options = args.options || { returnDocument: 'after' };
      const result = await col.findOneAndReplace(filter, replacement, options);
      return {
        rowCount: result.value ? 1 : 0,
        rows: result.value ? [result.value] : []
      };
    }

    // Handle findOneAndDelete
    if (operation === 'findOneAndDelete') {
      const filter = args.filter || args || {};
      const options = args.options || {};
      const result = await col.findOneAndDelete(filter, options);
      return {
        rowCount: result.value ? 1 : 0,
        rows: result.value ? [result.value] : []
      };
    }

    // Handle bulkWrite
    if (operation === 'bulkWrite') {
      const operations = args.operations || args || [];
      const options = args.options || {};
      const result = await col.bulkWrite(operations, options);
      return {
        rowCount: result.modifiedCount + result.insertedCount + result.deletedCount,
        rows: [{
          insertedCount: result.insertedCount,
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          deletedCount: result.deletedCount,
          upsertedCount: result.upsertedCount,
          insertedIds: result.insertedIds,
          upsertedIds: result.upsertedIds
        }]
      };
    }

    // Handle aggregate
    if (operation === 'aggregate') {
      const pipeline = args.pipeline || args || [];
      const options = args.options || {};
      const docs = await col.aggregate(pipeline, options).toArray();
      return {
        rowCount: docs.length,
        rows: docs
      };
    }

    // Handle createIndex
    if (operation === 'createIndex') {
      const keys = args.keys || args.index || args;
      const options = args.options || {};
      const indexName = await col.createIndex(keys, options);
      return {
        rowCount: 1,
        rows: [{ indexName, created: true }]
      };
    }

    // Handle createIndexes
    if (operation === 'createIndexes') {
      const indexes = args.indexes || args || [];
      const result = await col.createIndexes(indexes);
      return {
        rowCount: result.length || 0,
        rows: [{ indexNames: result, created: true }]
      };
    }

    // Handle dropIndex
    if (operation === 'dropIndex') {
      const indexName = args.indexName || args.name || args;
      await col.dropIndex(indexName);
      return {
        rowCount: 1,
        rows: [{ indexName, dropped: true }]
      };
    }

    // Handle dropIndexes
    if (operation === 'dropIndexes') {
      await col.dropIndexes();
      return {
        rowCount: 1,
        rows: [{ dropped: 'all indexes' }]
      };
    }

    // Handle listIndexes
    if (operation === 'listIndexes') {
      const indexes = await col.listIndexes().toArray();
      return {
        rowCount: indexes.length,
        rows: indexes
      };
    }

    // Handle rename
    if (operation === 'rename') {
      const newName = args.newName || args.name || args;
      const options = args.options || {};
      const result = await col.rename(newName, options);
      return {
        rowCount: 1,
        rows: [{ renamed: true, newName }]
      };
    }

    // Handle drop
    if (operation === 'drop') {
      const result = await col.drop();
      return {
        rowCount: 1,
        rows: [{ dropped: true }]
      };
    }

    // Handle watch (change streams) - limited support
    if (operation === 'watch') {
      throw new Error('Change streams (watch) are not supported in query mode. Use scripts instead.');
    }

    // Generic fallback for other operations
    const result = await col[operation](...Object.values(args));
    return {
      rowCount: result?.modifiedCount ?? result?.deletedCount ?? 0,
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
      // Load script content from DB (survives Render restarts)
      const scriptData = await executionDAL.loadScriptContent(client, requestId);
      
      /* istanbul ignore else */
      if (scriptData?.script_content) {
        // Use content from DB
        request.script_text = scriptData.script_content;
      } /* istanbul ignore next */ else if (scriptData?.file_path) {
        // Fallback to file if DB content is missing
        try {
          request.script_text = await fs.readFile(scriptData.file_path, 'utf-8');
        } catch (err) {
          throw new Error('Script file not found and no database backup available');
        }
      } else {
        throw new Error('Script content not available');
      }
    }

    const instance = instanceRegistry[request.db_instance];
    if (!instance) {
      throw new Error('Invalid database instance');
    }

    executionId = await executionDAL.createExecution(client, requestId);
    startTime = Date.now();

    // Locks Make execution row durable
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
      /* istanbul ignore next */
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
      /* istanbul ignore next */
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
    
    console.log(`[downloadExecutionResults] Execution ID from params: ${executionId}`);
    
    // Get execution record
    const execution = await executionDAL.getExecutionById(executionId);
    
    console.log(`[downloadExecutionResults] Execution found: ${execution ? 'yes' : 'no'}, result_file_path: ${execution?.result_file_path}`);
    
    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    // Check if user has access (must be requester or manager)
    const hasAccess = await executionDAL.checkExecutionAccess(executionId, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let rows = [];
    
    // If result is in file, read from file
    if (execution.result_file_path) {
      const fileContent = await fs.readFile(execution.result_file_path, 'utf-8');
      const result = JSON.parse(fileContent);
      rows = result.rows || [];
    } else {
      // Otherwise, get result from database
      rows = execution.result_json?.rows || [];
    }

    // Convert to CSV
    if (rows.length === 0) {
      // Generate filename: username_timestamp.csv
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const username = execution.username || 'user';
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${username}_${timestamp}.csv"`);
      return res.send('No results');
    }

    // Get all unique keys from all rows (in case rows have different structures)
    const allKeys = new Set();
    rows.forEach(row => {
      Object.keys(row).forEach(key => allKeys.add(key));
    });
    const headers = Array.from(allKeys);

    // Helper function to escape CSV values
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      // If value contains comma, quote, or newline, wrap in quotes and escape quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Build CSV content
    const csvLines = [];
    
    // Add header row
    csvLines.push(headers.map(escapeCSV).join(','));
    
    // Add data rows
    rows.forEach(row => {
      const values = headers.map(header => escapeCSV(row[header]));
      csvLines.push(values.join(','));
    });

    const csvContent = csvLines.join('\n');

    // Generate filename: username_timestamp.csv (no request ID for security)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const username = execution.username || 'user';
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${username}_${timestamp}.csv"`);
    res.send(csvContent);
  } catch (err) {
    console.error('Download results error:', err);
    res.status(500).json({ error: 'Failed to download results' });
  }
};

module.exports = {
  executeRequest,
  executeRequestInternal,
  downloadExecutionResults,
  sendExecutionSuccessNotification,
  sendExecutionFailureNotification
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