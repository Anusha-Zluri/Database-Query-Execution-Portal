const { EntitySchema } = require('@mikro-orm/core');

/**
 * Request Entity - matches existing 'requests' table
 * NO FIELD NAME CHANGES - frontend depends on these exact names
 */
const Request = new EntitySchema({
  class: class Request {},
  tableName: 'requests',
  properties: {
    id: { type: 'bigint', primary: true },
    requester_id: { type: 'bigint', nullable: true },
    pod_id: { type: 'bigint', nullable: true },
    request_type: { type: 'string', enum: true, items: ['QUERY', 'SCRIPT'] },
    db_instance: { type: 'text', nullable: true },
    db_name: { type: 'text', nullable: true },
    status: { type: 'text' },
    comment: { type: 'text', nullable: true },
    created_at: { type: 'timestamptz', onCreate: () => new Date() },
    decided_at: { type: 'timestamp', nullable: true },
    decided_by: { type: 'integer', nullable: true },
    rejection_reason: { type: 'text', nullable: true }
  }
});

module.exports = { Request };
