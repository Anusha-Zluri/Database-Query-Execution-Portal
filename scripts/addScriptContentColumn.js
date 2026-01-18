const { Pool } = require('pg');
require('dotenv').config();

async function addScriptContentColumn() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('Adding script_content column to request_scripts table...');
    
    // Add the column if it doesn't exist
    await pool.query(`
      ALTER TABLE request_scripts 
      ADD COLUMN IF NOT EXISTS script_content TEXT;
    `);
    
    console.log('✅ Successfully added script_content column');
    
    // Optional: Migrate existing file contents to database
    console.log('\nChecking for existing scripts to migrate...');
    const fs = require('fs');
    const path = require('path');
    
    const result = await pool.query(`
      SELECT request_id, file_path 
      FROM request_scripts 
      WHERE script_content IS NULL AND file_path IS NOT NULL
    `);
    
    console.log(`Found ${result.rows.length} scripts to migrate`);
    
    for (const row of result.rows) {
      try {
        const fullPath = path.join(__dirname, '..', row.file_path);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          await pool.query(
            'UPDATE request_scripts SET script_content = $1 WHERE request_id = $2',
            [content, row.request_id]
          );
          console.log(`  ✅ Migrated script for request ${row.request_id}`);
        } else {
          console.log(`  ⚠️  File not found for request ${row.request_id}: ${row.file_path}`);
        }
      } catch (err) {
        console.error(`  ❌ Error migrating request ${row.request_id}:`, err.message);
      }
    }
    
    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  addScriptContentColumn()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { addScriptContentColumn };
