const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'anushathalivarathil',
  password: '',
  database: 'unified_query_portal',
});

const testConnection = async () => {
  await pool.query('SELECT 1');
};

module.exports = {
  pool,
  testConnection,
};


