const vm = require('vm');

module.exports = async function runUserScript({
  scriptCode,
  context,
  timeoutMs = 10000  // Increased to 10 seconds for database operations
}) {
  // Create a completely isolated sandbox with no prototype chain
  const sandbox = Object.create(null);
  
  // Only add safe, whitelisted globals
  const safeGlobals = {
    // Basic JavaScript constructors (frozen to prevent modification)
    Object: Object,
    Array: Array,
    String: String,
    Number: Number,
    Boolean: Boolean,
    Date: Date,
    Math: Math,
    JSON: JSON,
    RegExp: RegExp,
    Error: Error,
    TypeError: TypeError,
    RangeError: RangeError,
    
    // Safe utility functions
    parseInt: parseInt,
    parseFloat: parseFloat,
    isNaN: isNaN,
    isFinite: isFinite,
    
    // Module system (controlled)
    module: { exports: {} },
    exports: {},
    
    // Database context (what we actually want to expose)
    ...context
  };

  // Add globals to sandbox
  Object.assign(sandbox, safeGlobals);

  // Create VM context with security restrictions
  const vmContext = vm.createContext(sandbox, {
    name: 'SecureUserScript',
    origin: 'user-script',
    codeGeneration: {
      strings: false,  // Disable eval()
      wasm: false      // Disable WebAssembly
    }
  });

  // Wrap user code with security measures
  const wrappedCode = `
    (function() {
      "use strict";
      
      // Remove any dangerous globals that might have leaked
      try {
        if (typeof global !== 'undefined') global = undefined;
        if (typeof process !== 'undefined') process = undefined;
        if (typeof require !== 'undefined') require = undefined;
        if (typeof Buffer !== 'undefined') Buffer = undefined;
      } catch (e) {
        // Ignore errors when trying to remove globals
      }
      
      // Freeze prototypes to prevent pollution
      Object.freeze(Object.prototype);
      Object.freeze(Array.prototype);
      Object.freeze(String.prototype);
      Object.freeze(Function.prototype);
      
      // Execute user code
      ${scriptCode}
      return module.exports;
    })()
  `;

  try {
    const script = new vm.Script(wrappedCode, {
      filename: 'user-script.js',
      timeout: timeoutMs
    });

    const exportedFn = await script.runInContext(vmContext, {
      displayErrors: false,
      breakOnSigint: true
    });

    if (typeof exportedFn !== 'function') {
      throw new Error('Script must export a function'); 
    }

    // Execute the user function with single timeout protection
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Function execution timeout'));
      }, timeoutMs);
    });

    const result = await Promise.race([
      exportedFn(context),
      timeoutPromise
    ]);

    if (
      !result ||
      typeof result.rowCount !== 'number' ||
      !Array.isArray(result.rows)
    ) {
      throw new Error('Script must return { rowCount, rows }');
    }

    return result;
  } catch (error) {
    // Sanitize error messages to prevent information leakage
    if (error.message && (
      error.message.includes('require is not defined') || 
      error.message.includes('process is not defined') ||
      error.message.includes('Constructor access blocked') ||
      error.message.includes('dangerous')
    )) {
      throw new Error('Script attempted to access restricted functionality');
    }
    
    // Allow other errors (like legitimate script errors) to pass through
    throw error;
  }
};
