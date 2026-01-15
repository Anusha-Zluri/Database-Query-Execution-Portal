const vm = require('vm');

module.exports = async function runUserScript({
  scriptCode,
  context,
  timeoutMs = 3000
}) {
  const sandbox = {
    module: { exports: {} },
    exports: {},
    ...context
  };

  vm.createContext(sandbox);

  const wrappedCode = `
    (async () => {
      ${scriptCode}
      return module.exports;
    })()
  `;

  const script = new vm.Script(wrappedCode);

  const exportedFn = await script.runInContext(sandbox, {
    timeout: timeoutMs
  });

  if (typeof exportedFn !== 'function') {
    throw new Error('Script must export a function'); 
  }

  const result = await exportedFn(context);

  if (
    !result ||
    typeof result.rowCount !== 'number' ||
    !Array.isArray(result.rows)
  ) {
    throw new Error('Script must return { rowCount, rows }');
  }

  return result;
};
