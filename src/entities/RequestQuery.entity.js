const { EntitySchema } = require('@mikro-orm/core');

/**
 * RequestQuery Entity - matches existing 'request_queries' table
 * NO FIELD NAME CHANGES - frontend depends on these exact names
 */
const RequestQuery = new EntitySchema({
  class: class RequestQuery {},
  tableName: 'request_queries',
  properties: {
    id: { type: 'integer', primary: true },
    request_id: { type: 'integer' },
    query_text: { type: 'text' },
    detected_operation: { type: 'text', nullable: true },
    is_safe: { type: 'boolean', nullable: true },
    created_at: { type: 'timestamp', onCreate: () => new Date() }
  }
});

module.exports = { RequestQuery };
