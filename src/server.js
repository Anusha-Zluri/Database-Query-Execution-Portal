require('dotenv').config();
const cors = require("cors");
const app = require('./app');
const { testConnection } = require('./config/db');
const { initORM } = require('./config/orm');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Test existing pg pool connection
    await testConnection();
    console.log('PostgreSQL (pg pool) connected');

    // Initialize MikroORM (runs alongside pg pool)
    await initORM();
    console.log('MikroORM initialized');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Startup failed:', err.message);
    process.exit(1);
  }
};

startServer();
