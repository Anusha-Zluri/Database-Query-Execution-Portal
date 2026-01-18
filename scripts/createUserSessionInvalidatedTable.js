const { pool } = require('../src/config/db');

async function createUserSessionInvalidatedTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.user_session_invalidated (
        user_id INTEGER PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
        invalidated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('✅ user_session_invalidated table created successfully');
  } catch (error) {
    console.error('❌ Error creating user_session_invalidated table:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createUserSessionInvalidatedTable()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = createUserSessionInvalidatedTable;