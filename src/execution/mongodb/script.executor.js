const { MongoClient } = require('mongodb');
const runUserScript = require('../script/vm.runner');
const utils = require('../script/utils');

module.exports = async function executeMongoScript(request, instance, executionContext = {}) {
  if (!request.script_text) {
    throw new Error('Script code missing for execution');
  }

  if (!request.db_name) {
    throw new Error('Database name missing for Mongo execution');
  }

  const client = new MongoClient(instance.baseUrl, {
    maxPoolSize: 1,        // predictable resource usage
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 25000,  // CRITICAL: Socket timeout to prevent hung connections
    connectTimeoutMS: 5000,
    maxIdleTimeMS: 30000
  });

  let connected = false;

  try {
    await client.connect();
    connected = true;

    const db = client.db(request.db_name);

    /**
     * IMPORTANT:
     * We expose the REAL MongoDB API.
     * If Mongo supports it, the user script supports it.
     */
    const context = {
      db,
      utils
    };

    /**
     * User script MUST export an async function
     * returning { rowCount, rows }
     */
    const result = await runUserScript({
      scriptCode: request.script_text,
      context,
      timeoutMs: 30000,  // 30 seconds - allows complex DB operations while preventing infinite loops
      executionContext  // Pass through for worker registration
    });

    return result;
  } catch (err) {
    /**
     * Let the caller handle Slack notifications.
     * Preserve stack trace.
     */
    err.message = `Mongo execution failed: ${err.message}`;
    throw err;
  } finally {
    // CRITICAL: Always close client, even if worker was terminated
    if (connected) {
      try {
        await client.close();
      } catch (err) {
        console.error('[executeMongoScript] Error closing client:', err.message);
        // Don't throw - we want to ensure cleanup continues
      }
    }
  }
};