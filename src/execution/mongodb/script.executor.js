const fs = require('fs/promises');
const path = require('path');
const { MongoClient } = require('mongodb');
const runUserScript = require('../script/vm.runner');
const utils = require('../script/utils');

module.exports = async function executeMongoScript(request, instance) {
  const scriptPath = path.resolve(request.file_path);
  const scriptCode = await fs.readFile(scriptPath, 'utf-8');

  const client = new MongoClient(instance.baseUrl);
  await client.connect();

  try {
    // FORCE the database name if it's missing in the request
    const dbName = request.db_name || 'sample_mflix';
    const db = client.db(dbName);

    // Verify the object has the collection method
    if (typeof db.collection !== 'function') {
      throw new Error(`Connection to database "${dbName}" failed to initialize collection driver.`);
    }

    const mongoHelper = new Proxy({}, {
      get: (target, operation) => {
        return (collectionName, ...args) => {
          const col = db.collection(collectionName);
          if (operation === 'find') return col.find(...args).toArray();
          return col[operation](...args);
        };
      }
    });

    return await runUserScript({
      scriptCode,
      context: {
        db, 
        mongo: mongoHelper,
        utils
      },
      timeoutMs: 3000
    });
  } finally {
    await client.close();
  }
};