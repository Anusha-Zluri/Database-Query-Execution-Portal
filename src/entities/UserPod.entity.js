const { EntitySchema } = require('@mikro-orm/core');

/**
 * UserPod Entity - matches existing 'user_pods' table
 * Composite primary key: (user_id, pod_id)
 * NO FIELD NAME CHANGES - frontend depends on these exact names
 */
const UserPod = new EntitySchema({
  class: class UserPod {},
  tableName: 'user_pods',
  properties: {
    user_id: { type: 'bigint', primary: true },
    pod_id: { type: 'bigint', primary: true },
    role: { type: 'string', enum: true, items: ['DEVELOPER', 'MANAGER'] },
    is_active: { type: 'boolean', default: true },
    created_at: { type: 'timestamptz', onCreate: () => new Date() }
  }
});

module.exports = { UserPod };
