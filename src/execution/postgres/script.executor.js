const { Pool } = require('pg');
const runUserScript = require('../script/vm.runner');
const utils = require('../script/utils');

module.exports = async function executePostgresScript(request, instance) {
  const url = new URL(instance.baseUrl);
  url.pathname = `/${request.db_name}`;

  const pool = new Pool({
    connectionString: url.toString()
  });

  if (!request.script_text) {
    throw new Error('Script code missing for execution');
  }

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
      scriptCode: request.script_text,
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