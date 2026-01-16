const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.APP_DATABASE_URL || 'postgresql://anushathalivarathil@localhost:5432/unified_query_portal',
  ssl: process.env.APP_DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// Set search_path after connection for cloud databases
if (process.env.APP_DATABASE_URL) {
  pool.on('connect', (client) => {
    client.query('SET search_path TO public', (err) => {
      if (err) {
        console.error('Error setting search_path:', err);
      }
    });
  });
}

const testConnection = async () => {
  await pool.query('SELECT 1');
};

module.exports = {
  pool,
  testConnection,
};


