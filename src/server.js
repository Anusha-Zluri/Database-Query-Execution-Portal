require('dotenv').config();
const cors = require("cors");
const app = require('./app');
const { testConnection } = require('./config/db');


const PORT = process.env.PORT || 3000;



const startServer = async () => {
  try {
    await testConnection();
    console.log('PostgreSQL connected');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Startup failed:', err.message);
    process.exit(1);
  }
};


startServer();
