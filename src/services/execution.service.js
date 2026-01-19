const { pool } = require('../config/db');
const fs = require('fs/promises');
const path = require('path');
const instanceRegistry = require('../registry/instances.registry');

const { Pool } = require('pg');
const { MongoClient } = require('mongodb');

const executePostgresScript = require('../execution/postgres/script.executor');
const executeMongoScript = require('../execution/mongodb/script.executor');

// Constants
const MAX_ROWS_IN_DB = 100; // Store only preview in database
const MAX_ROWS_TOTAL = 100; // Maximum rows to store in file
const RESULTS_DIR = path.join(__dirname, '../../uploads/results');

/* =========================
   RESULT STORAGE HELPER
========================= */
async function storeExecutionResult(executionId, result) {
  const totalRows = result.rowCount || 0;
  const allRows = result.rows || [];
  
  const MAX_ROWS_TOTAL = 10000; // Only truncate if more than 10k rows
  const PREVIEW_ROWS = 100; // Preview size when truncated
  
  console.log(`[storeExecutionResult] Execution ${executionId}: totalRows=${totalRows}, MAX_ROWS_TOTAL=${MAX_ROWS_TOTAL}`);
  
  const needsTruncation = totalRows > MAX_ROWS_TOTAL;
  
  console.log(`[storeExecutionResult] needsTruncation=${needsTruncation}`);
  
  let resultFilePath = null;
  let resultToStore = result;
  let isTruncated = false;

  if (needsTruncation) {
    // Only truncate if we exceed the max limit
    isTruncated = true;
    
    console.log(`[storeExecutionResult] Setting isTruncated=true`);
    
    // Ensure results directory exists
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
    
    console.log(`[storeExecutionResult] Wrote ${rowsToStore.length} rows to ${resultFilePath}`);

    // Store only preview in database
    resultToStore = {
      rowCount: totalRows,
      rows: allRows.slice(0, PREVIEW_ROWS),
      preview: true,
      truncated: true,
      totalRowsInFile: MAX_ROWS_TOTAL
    };
  }

  console.log(`[storeExecutionResult] Returning: isTruncated=${isTruncated}, resultFilePath=${resultFilePath}`);

  return {
    resultJson: resultToStore,
    resultFilePath,
    isTruncated
  };
}

/* =========================
   DISPATCHER
========================= */
async function dispatchExecution(request, instance) {
  switch (instance.engine) {
    case 'postgres':
      return request.request_type === 'QUERY'
        ? executePostgresQuery(request, instance)
        : executePostgresScript(request, instance);

    case 'mongodb':
      return request.request_type === 'QUERY'
        ? executeMongoQuery(request, instance)
        : executeMongoScript(request, instance);

    default:
      throw new Error(`Unsupported engine: ${instance.engine}`);
  }
}

/* =========================
   POSTGRES QUERY
========================= */
async function executePostgresQuery(request, instance) {
  const url = new URL(instance.baseUrl);
  url.pathname = `/${request.db_name}`;

  const execPool = new Pool({ connectionString: url.toString() });

  try {
    const result = await execPool.query(request.query_text);
    return { rowCount: result.rowCount, rows: result.rows };
  } finally {
    await execPool.end();
  }
}

/* =========================
   MONGO QUERY
========================= */
async function executeMongoQuery(request, instance) {
  let payload;
  try {
    // Trim whitespace
    let queryText = request.query_text.trim();
    
    // Handle double-encoded JSON (when sent as string in Postman form-data)
    // If it starts and ends with quotes, it's likely double-encoded
    if (queryText.startsWith('"') && queryText.endsWith('"')) {
      // Remove outer quotes and unescape
      queryText = JSON.parse(queryText);
    }
    
    payload = JSON.parse(queryText);
  } catch (parseError) {
    throw new Error(`Mongo query must be valid JSON. Error: ${parseError.message}`);
  }

  const { collection, operation, args = {} } = payload;
  if (!collection || !operation) {
    throw new Error('Mongo query must include collection and operation');
  }

  const client = new MongoClient(instance.baseUrl);
  await client.connect();

  try {
    const db = client.db(request.db_name);
    const col = db.collection(collection);

    if (operation === 'find') {
      const cursor = col.find(args.filter || {});
      // Limit to 10,000 rows max (will be stored in file if > 100)
      if (args.limit) cursor.limit(Math.min(args.limit, 10000));
      else cursor.limit(10000);
      const docs = await cursor.toArray();
      return { rowCount: docs.length, rows: docs };
    }

    if (typeof col[operation] !== 'function') {
      throw new Error(`Unsupported Mongo operation: ${operation}`);
    }

    const result = await col[operation](...Object.values(args));
    return { rowCount: result?.modifiedCount ?? 0, rows: [] };

  } finally {
    await client.close();
  }
}

/* =========================
   MAIN EXECUTION ENTRY
========================= */
async function executeRequestInternal(requestId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    /* 🔒 STEP 1: Lock ONLY the request row */
    const { rows } = await client.query(
      `
      SELECT id, request_type, db_instance, db_name
      FROM requests
      WHERE id = $1
        AND status = 'APPROVED'
      FOR UPDATE
      `,
      [requestId]
    );

    if (!rows.length) {
      throw new Error('Approved request not found');
    }

    const request = rows[0];

    /* 📥 STEP 2: Fetch payload AFTER lock */
    if (request.request_type === 'QUERY') {
      const qr = await client.query(
        `SELECT query_text FROM request_queries WHERE request_id = $1`,
        [requestId]
      );

      if (!qr.rows.length) {
        throw new Error('Query payload not found');
      }

      request.query_text = qr.rows[0].query_text;
    }

    if (request.request_type === 'SCRIPT') {
      const sr = await client.query(
        `SELECT file_path FROM request_scripts WHERE request_id = $1`,
        [requestId]
      );

      if (!sr.rows.length) {
        throw new Error('Script payload not found');
      }

      request.script_text = await fs.readFile(sr.rows[0].file_path, 'utf-8');
    }

    /* 🔌 STEP 3: Resolve DB instance */
    const instance = instanceRegistry[request.db_instance];
    if (!instance) {
      throw new Error('Invalid database instance');
    }

    /* 📝 STEP 4: Log execution */
    const execInsert = await client.query(
      `
      INSERT INTO executions (request_id, status, started_at)
      VALUES ($1, 'RUNNING', NOW())
      RETURNING id
      `,
      [requestId]
    );

    const executionId = execInsert.rows[0].id;
    const start = Date.now();

    /* ▶️ STEP 5: Execute */
    const result = await dispatchExecution(request, instance);

    /* 💾 STEP 6: Store result (file if large, DB if small) */
    const { resultJson, resultFilePath, isTruncated } = await storeExecutionResult(executionId, result);

    /* ✅ STEP 7: Mark success */
    await client.query(
      `
      UPDATE executions
      SET status = 'SUCCESS',
          finished_at = NOW(),
          duration_ms = $2,
          result_json = $3,
          result_file_path = $4,
          is_truncated = $5
      WHERE id = $1
      `,
      [executionId, Date.now() - start, JSON.stringify(resultJson), resultFilePath, isTruncated]
    );

    await client.query(
      `UPDATE requests SET status = 'EXECUTED' WHERE id = $1`,
      [requestId]
    );

    await client.query('COMMIT');
    return result;

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { executeRequestInternal };