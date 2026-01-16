const { EntitySchema } = require('@mikro-orm/core');

/**
 * Pod Entity - matches existing 'pods' table
 * NO FIELD NAME CHANGES - frontend depends on these exact names
 */
const Pod = new EntitySchema({
  class: class Pod {},
  tableName: 'pods',
  properties: {
    id: { type: 'bigint', primary: true },
    name: { type: 'text', unique: true },
    is_active: { type: 'boolean', default: true },
    manager_user_id: { type: 'bigint' }
  }
});

module.exports = { Pod };
