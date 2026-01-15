const { MongoClient } = require('mongodb');
const runUserScript = require('../script/vm.runner');
const utils = require('../script/utils');

module.exports = async function executeMongoScript(request, instance) {
  if (!request.script_text) {
    throw new Error('Script code missing for execution');
  }

  const client = new MongoClient(instance.baseUrl);
  await client.connect();

  try {
    // Force DB name from request (no guessing inside executor)
    const dbName = request.db_name;
    if (!dbName) {
      throw new Error('Database name missing for Mongo execution');
    }

    const db = client.db(dbName);

    if (typeof db.collection !== 'function') {
      throw new Error(`Failed to initialize Mongo database "${dbName}"`);
    }

    /**
     * mongo.find('users', { age: { $gt: 18 } })
     * mongo.insertOne('users', { name: 'A' })
     */
    const mongo = new Proxy({}, {
      get: (_, operation) => {
        return async (collectionName, ...args) => {
          const col = db.collection(collectionName);

          if (typeof col[operation] !== 'function') {
            throw new Error(`Unsupported Mongo operation: ${operation}`);
          }

          if (operation === 'find') {
            return col.find(...args).toArray();
          }

          return col[operation](...args);
        };
      }
    });

    return await runUserScript({
      scriptCode: request.script_text,
      context: {
        db,
        mongo,
        utils
      },
      timeoutMs: 3000
    });

  } finally {
    await client.close();
  }
};