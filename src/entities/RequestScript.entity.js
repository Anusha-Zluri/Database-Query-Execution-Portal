const { EntitySchema } = require('@mikro-orm/core');

/**
 * RequestScript Entity - matches existing 'request_scripts' table
 * NO FIELD NAME CHANGES - frontend depends on these exact names
 */
const RequestScript = new EntitySchema({
  class: class RequestScript {},
  tableName: 'request_scripts',
  properties: {
    request_id: { type: 'bigint', primary: true },
    file_path: { type: 'text' },
    script_content: { type: 'text', nullable: true },
    checksum: { type: 'text', nullable: true },
    created_at: { type: 'timestamptz', onCreate: () => new Date() },
    line_count: { type: 'integer', nullable: true },
    risk_level: { type: 'text', nullable: true },
    has_dangerous_apis: { type: 'boolean', nullable: true }
  }
});

module.exports = { RequestScript };
