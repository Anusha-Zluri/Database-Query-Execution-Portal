const { pool } = require('../config/db');
const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const fs = require('fs/promises');
const instanceRegistry = require('../registry/instances.registry');

const executePostgresScript = require('../execution/postgres/script.executor');
const executeMongoScript = require('../execution/mongodb/script.executor');



//dispatcher
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

//query executor
async function executePostgresQuery(request, instance) {
  const url = new URL(instance.baseUrl);
  url.pathname = `/${request.db_name}`;

  const execPool = new Pool({
    connectionString: url.toString()
  });

  try {
    const result = await execPool.query(request.query_text);
    return { rowCount: result.rowCount, rows: result.rows };
  } finally {
    await execPool.end();
  }
}

//mongodb query executor
async function executeMongoQuery(request, instance) {
  let payload;
  try {
    payload = JSON.parse(request.query_text);
  } catch {
    throw new Error('Mongo query must be valid JSON');
  }

  const { collection, operation, args = {} } = payload;
  if (!collection || !operation) {
    throw new Error('Mongo query must include collection and operation');
  }

  const client = new MongoClient(instance.baseUrl, {
    serverSelectionTimeoutMS: 5000
  });

  await client.connect();

  try {
    const db = client.db(request.db_name);
    const col = db.collection(collection);

    if (operation === 'find') {
      const cursor = col.find(args.filter || {});
      if (args.limit) cursor.limit(Math.min(args.limit, 500));
      const docs = await cursor.toArray();
      return { rowCount: docs.length, rows: docs };
    }

    if (typeof col[operation] !== 'function') {
      throw new Error(`Unsupported Mongo operation: ${operation}`);
    }

    const result = await col[operation](...normalizeMongoArgs(operation, args));
    return normalizeMongoResult(result);

  } finally {
    await client.close();
  }
}

//mongo helpers
function normalizeMongoArgs(operation, args) {
  switch (operation) {
    case 'insertOne': return [args.document];
    case 'insertMany': return [args.documents];
    case 'updateOne':
    case 'updateMany': return [args.filter, args.update, args.options || {}];
    case 'deleteOne':
    case 'deleteMany': return [args.filter];
    case 'aggregate': return [args.pipeline || []];
    default: return Array.isArray(args) ? args : [args];
  }
}

function normalizeMongoResult(result) {
  if (result?.insertedCount !== undefined) return { rowCount: result.insertedCount, rows: [] };
  if (result?.modifiedCount !== undefined) return { rowCount: result.modifiedCount, rows: [] };
  if (result?.deletedCount !== undefined) return { rowCount: result.deletedCount, rows: [] };
  return { rowCount: 0, rows: [], raw: result };
}

//controller
exports.executeRequest = async (req, res) => {
  const requestId = Number(req.params.id);
  if (Number.isNaN(requestId)) {
    return res.status(400).json({ message: 'Invalid request id' });
  }
//fetch
  const { rows } = await pool.query(
    `
    SELECT
      r.id,
      r.status,
      r.request_type,
      r.db_instance,
      r.db_name,
      rq.query_text,
      rs.file_path
    FROM requests r
    LEFT JOIN request_queries rq ON rq.request_id = r.id
    LEFT JOIN request_scripts rs ON rs.request_id = r.id
    WHERE r.id = $1
    `,
    [requestId]
  );

  if (!rows.length) {
    return res.status(404).json({ message: 'Request not found' });
  }

  const request = rows[0];

  if (request.status !== 'APPROVED') {
    return res.status(400).json({ message: 'Request is not approved yet' });
  }

  //load script
  if (request.request_type === 'SCRIPT') {
    request.script_text = await fs.readFile(request.file_path, 'utf-8');
  }

  //resolve instance
  const instance = instanceRegistry[request.db_instance];
  if (!instance?.engine || !instance?.baseUrl) {
    return res.status(500).json({ message: 'Invalid database instance config' });
  }

 
  //log into executions table
  const startTime = Date.now();
  const execInsert = await pool.query(
    `
    INSERT INTO executions (request_id, status, started_at)
    VALUES ($1, 'RUNNING', NOW())
    RETURNING id
    `,
    [requestId]
  );

  const executionId = execInsert.rows[0].id;

  try {
    //run
    const result = await dispatchExecution(request, instance);
    const durationMs = Date.now() - startTime;

    await pool.query(
      `
      UPDATE executions
      SET status = 'SUCCESS',
          finished_at = NOW(),
          duration_ms = $2,
          result_json = $3
      WHERE id = $1
      `,
      [executionId, durationMs, JSON.stringify(result)]
    );

    res.json({
      status: 'SUCCESS',
      execution_id: executionId,
      ...result
    });

  } catch (err) {
    const durationMs = Date.now() - startTime;

    await pool.query(
      `
      UPDATE executions
      SET status = 'FAILED',
          finished_at = NOW(),
          duration_ms = $2,
          error_message = $3
      WHERE id = $1
      `,
      [executionId, durationMs, err.message]
    );

    res.status(400).json({
      status: 'FAILED',
      execution_id: executionId,
      error: err.message
    });
  }
};
