const { Pool } = require('pg');
const runUserScript = require('../script/vm.runner');
const utils = require('../script/utils');

module.exports = async function executePostgresScript(request, instance, executionContext = {}) {
  const url = new URL(instance.baseUrl);
  url.pathname = `/${request.db_name}`;

  const pool = new Pool({
    connectionString: url.toString(),
    // CRITICAL: Set connection-level timeout to prevent hung connections
    statement_timeout: 25000,  // 25s - slightly less than worker timeout
    query_timeout: 25000,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 2,  // Limit to 2 connections per execution (reduced from 10 to prevent exhaustion)
    application_name: 'script_executor'  // For orphan cleanup
  });

  if (!request.script_text) {
    throw new Error('Script code missing for execution');
  }

  // Track backend PID for query cancellation
  let backendPid = null;
  let pidCaptured = false;

  const db = {
    query: async (text, params) => {
      // Capture backend PID on first query
      if (!pidCaptured && executionContext.onBackendPid) {
        try {
          const pidResult = await pool.query('SELECT pg_backend_pid()');
          backendPid = pidResult.rows[0].pg_backend_pid;
          executionContext.onBackendPid(backendPid);
          pidCaptured = true;
        } catch (err) {
          console.error('[executePostgresScript] Failed to capture backend PID:', err.message);
        }
      }

      const res = await pool.query(text, params);
      return {
        rowCount: res.rowCount,
        rows: res.rows
      };
    }
  };

  try {
    const result = await runUserScript({
      scriptCode: request.script_text,
      context: {
        db,
        utils
      },
      timeoutMs: 30000,  // 30 seconds - allows complex DB operations while preventing infinite loops
      executionContext  // Pass through for worker registration
    });
    
    return result;
  } finally {
    // CRITICAL: Always close pool, even if worker was terminated
    // This ensures connections are released back to the pool
    try {
      await pool.end();
    } catch (err) {
      console.error('[executePostgresScript] Error closing pool:', err.message);
      // Don't throw - we want to ensure cleanup continues
    }
  }
};