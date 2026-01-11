module.exports = {
  'pg-local': {
    engine: 'postgres',
    baseUrl: process.env.PG_BASE_URL,
    description: 'Neon PostgreSQL instance'
  },
  'mongo-local': {
    engine: 'mongodb',
    baseUrl: process.env.MONGO_BASE_URL
  }

};
