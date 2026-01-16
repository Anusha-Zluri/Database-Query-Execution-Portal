const { MikroORM } = require('@mikro-orm/postgresql');
const config = require('./mikro-orm.config');

/**
 * MikroORM Instance
 * 
 * This runs ALONGSIDE your existing pg pool (not replacing it yet)
 * - Existing code continues to use pg pool
 * - New code can gradually adopt MikroORM
 * - No breaking changes to existing functionality
 */

let orm = null;

async function initORM() {
  if (orm) {
    return orm;
  }

  try {
    console.log('Initializing MikroORM...');
    orm = await MikroORM.init(config);
    console.log('✓ MikroORM connected successfully');
    
    // Verify connection by running a simple query
    const em = orm.em.fork();
    await em.getConnection().execute('SELECT 1');
    console.log('✓ MikroORM database connection verified');
    
    return orm;
  } catch (error) {
    console.error('✗ MikroORM initialization failed:', error);
    throw error;
  }
}

async function getORM() {
  if (!orm) {
    await initORM();
  }
  return orm;
}

async function closeORM() {
  if (orm) {
    await orm.close();
    orm = null;
    console.log('✓ MikroORM connection closed');
  }
}

module.exports = {
  initORM,
  getORM,
  closeORM
};
