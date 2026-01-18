const { MongoClient } = require('mongodb');
const runUserScript = require('../script/vm.runner');
const utils = require('../script/utils');

module.exports = async function executeMongoScript(request, instance) {
  if (!request.script_text) {
    throw new Error('Script code missing for execution');
  }

  if (!request.db_name) {
    throw new Error('Database name missing for Mongo execution');
  }

  const client = new MongoClient(instance.baseUrl, {
    maxPoolSize: 1,        // predictable resource usage
    serverSelectionTimeoutMS: 5000,
  });

  await client.connect();

  try {
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
      timeoutMs: 10000,  // Increased to 10 seconds for database operations
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
    await client.close();
  }
};