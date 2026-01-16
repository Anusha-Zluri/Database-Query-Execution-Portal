const { EntitySchema } = require('@mikro-orm/core');

/**
 * DbInstance Entity - matches existing 'db_instances' table
 * NO FIELD NAME CHANGES - frontend depends on these exact names
 */
const DbInstance = new EntitySchema({
  class: class DbInstance {},
  tableName: 'db_instances',
  properties: {
    id: { type: 'bigint', primary: true },
    name: { type: 'text', unique: true },
    db_type: { type: 'string', enum: true, items: ['POSTGRES', 'MONGODB'] },
    host: { type: 'text' },
    port: { type: 'integer' },
    username: { type: 'text' },
    password: { type: 'text' },
    is_active: { type: 'boolean', default: true },
    created_at: { type: 'timestamptz', onCreate: () => new Date() }
  }
});

module.exports = { DbInstance };
