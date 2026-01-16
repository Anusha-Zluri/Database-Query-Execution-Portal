const { EntitySchema } = require('@mikro-orm/core');

/**
 * User Entity - matches existing 'users' table
 * NO FIELD NAME CHANGES - frontend depends on these exact names
 */
const User = new EntitySchema({
  class: class User {},
  tableName: 'users',
  properties: {
    id: { type: 'bigint', primary: true },
    username: { type: 'text', unique: true },
    email: { type: 'text', unique: true },
    name: { type: 'text', nullable: true },
    password_hash: { type: 'text' },
    role: { type: 'string', enum: true, items: ['DEVELOPER', 'MANAGER', 'ADMIN'] },
    is_active: { type: 'boolean', default: true },
    created_at: { type: 'timestamptz', onCreate: () => new Date() }
  }
});

module.exports = { User };
