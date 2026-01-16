const { EntitySchema } = require('@mikro-orm/core');

/**
 * Execution Entity - matches existing 'executions' table
 * NO FIELD NAME CHANGES - frontend depends on these exact names
 */
const Execution = new EntitySchema({
  class: class Execution {},
  tableName: 'executions',
  properties: {
    id: { type: 'integer', primary: true },
    request_id: { type: 'integer' },
    status: { type: 'string', enum: true, items: ['PENDING', 'RUNNING', 'SUCCESS', 'FAILED'] },
    started_at: { type: 'timestamp', onCreate: () => new Date() },
    finished_at: { type: 'timestamp', nullable: true },
    duration_ms: { type: 'integer', nullable: true },
    result_json: { type: 'jsonb', nullable: true },
    error_message: { type: 'text', nullable: true },
    stack_trace: { type: 'text', nullable: true },
    result_file_path: { type: 'text', nullable: true },
    is_truncated: { type: 'boolean', default: false }
  }
});

module.exports = { Execution };
