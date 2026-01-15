function sanitizeDbError(err, engine = 'generic') {
  let code = 'EXECUTION_FAILED';
  let message = 'Execution failed';

  if (engine === 'postgres') {
    switch (err.code) {
      case '42601':
        code = 'SYNTAX_ERROR';
        message = 'Invalid SQL syntax';
        break;

      case '42703':
        code = 'INVALID_COLUMN';
        message = 'Query references a column that does not exist';
        break;

      case '42P01':
        code = 'INVALID_TABLE';
        message = 'Query references a table that does not exist';
        break;

      case '42883':
        code = 'INVALID_FUNCTION';
        message = 'Query uses an unsupported or invalid function';
        break;

      case '42501':
        code = 'PERMISSION_DENIED';
        message = 'Insufficient database privileges';
        break;

      case '57014':
        code = 'TIMEOUT';
        message = 'Query execution exceeded time limit';
        break;

      default:
        if (err.code?.startsWith('23')) {
          code = 'CONSTRAINT_VIOLATION';
          message = 'Database constraint violation';
        }
    }
  }

  if (engine === 'mongodb') {
    code = 'MONGO_OPERATION_FAILED';
    message = 'Invalid MongoDB operation or query';
  }

  if (err.name === 'ScriptExecutionError') {
    code = 'SCRIPT_ERROR';
    message = err.safeMessage || 'Script execution failed';
  }

  return { code, message };
}

module.exports = { sanitizeDbError };