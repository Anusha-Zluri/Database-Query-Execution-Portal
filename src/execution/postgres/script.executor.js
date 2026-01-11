const fs = require('fs/promises');
const path = require('path');
const { Pool } = require('pg');
const runUserScript = require('../script/vm.runner');
const utils = require('../script/utils');

module.exports = async function executePostgresScript(request, instance) {
  const url = new URL(instance.baseUrl);
  url.pathname = `/${request.db_name}`;

  const pool = new Pool({
    connectionString: url.toString()
  });

  // Read script from file
  const scriptPath = path.resolve(request.file_path);
  const scriptCode = await fs.readFile(scriptPath, 'utf-8');

  const db = {
    query: async (text, params) => {
      const res = await pool.query(text, params);
      return {
        rowCount: res.rowCount,
        rows: res.rows
      };
    }
  };

  try {
    return await runUserScript({
      scriptCode,
      context: {
        db,
        utils
      },
      timeoutMs: 3000
    });
  } finally {
    await pool.end();
  }
};
