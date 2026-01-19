const { parentPort, workerData } = require('worker_threads');
const vm = require('vm');

let callIdCounter = 0;
const pendingCalls = new Map();

// DB call tracking for flood prevention
let dbCallCount = 0;
const MAX_DB_CALLS = 100; // Max 100 DB operations per execution

// Listen for messages from parent (DB responses)
parentPort.on('message', (msg) => {
  if (msg.type === 'db_response') {
    const resolver = pendingCalls.get(msg.callId);
    if (resolver) {
      resolver.resolve(msg.result);
      pendingCalls.delete(msg.callId);
    }
  } else if (msg.type === 'db_error') {
    const resolver = pendingCalls.get(msg.callId);
    if (resolver) {
      resolver.reject(new Error(msg.error));
      pendingCalls.delete(msg.callId);
    }
  }
});

// Helper to make async calls to parent thread
function callParent(message) {
  // Check DB call limit
  dbCallCount++;
  if (dbCallCount > MAX_DB_CALLS) {
    throw new Error(
      `Too many database operations (${dbCallCount}/${MAX_DB_CALLS}). ` +
      `Reduce the number of queries or use batch operations.`
    );
  }
  
  return new Promise((resolve, reject) => {
    const callId = callIdCounter++;
    pendingCalls.set(callId, { resolve, reject });
    parentPort.postMessage({ ...message, callId });
  });
}

(async () => {
  const { scriptCode, timeoutMs } = workerData;

  try {
    // Freeze prototypes FIRST to prevent pollution
    Object.freeze(Object.prototype);
    Object.freeze(Array.prototype);
    Object.freeze(String.prototype);
    Object.freeze(Number.prototype);
    Object.freeze(Boolean.prototype);
    Object.freeze(Function.prototype);
    Object.freeze(Promise.prototype);

    // Create completely clean sandbox (no prototype chain)
    const sandbox = Object.create(null);

    // Create proxy DB object that sends requests to parent thread
    const dbProxy = {
      // Postgres-style query method
      query: async (text, params) => {
        return await callParent({
          type: 'db_call',
          method: 'query',
          args: [text, params]
        });
      },
      
      // MongoDB-style collection method
      collection: (collectionName) => {
        // Return a proxy for collection methods
        return new Proxy({}, {
          get: (target, operation) => {
            return (...args) => {
              // Check if this is a cursor operation (find, aggregate)
              if (operation === 'find' || operation === 'aggregate') {
                // Return a cursor-like object with chainable methods
                const cursorProxy = {
                  _chain: [{ method: operation, args }],
                  
                  // Chainable cursor methods
                  limit(n) {
                    this._chain.push({ method: 'limit', args: [n] });
                    return this;
                  },
                  skip(n) {
                    this._chain.push({ method: 'skip', args: [n] });
                    return this;
                  },
                  sort(sortSpec) {
                    this._chain.push({ method: 'sort', args: [sortSpec] });
                    return this;
                  },
                  project(projection) {
                    this._chain.push({ method: 'project', args: [projection] });
                    return this;
                  },
                  
                  // Terminal operation
                  toArray: async function() {
                    return await callParent({
                      type: 'db_call',
                      method: 'collection',
                      collectionName,
                      operation: 'cursor',
                      cursorChain: this._chain
                    });
                  }
                };
                
                return cursorProxy;
              }
              
              // Direct collection operation (insertOne, updateOne, etc.)
              return callParent({
                type: 'db_call',
                method: 'collection',
                collectionName,
                operation,
                args
              });
            };
          }
        });
      }
    };

    // Recreate utils module in worker (can't clone functions)
    const utilsModule = {
      sleep(ms) {
        return new Promise(res => setTimeout(res, ms));
      },
      now() {
        return new Date();
      }
    };

    // Whitelisted safe globals only
    const safeGlobals = {
      Object,
      Array,
      String,
      Number,
      Boolean,
      Date,
      Math,
      JSON,
      RegExp,
      Error,
      TypeError,
      RangeError,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      Promise,

      // Controlled module system
      module: { exports: {} },
      exports: {},

      // Database proxy
      db: dbProxy,
      
      // Utils
      utils: utilsModule
    };

    Object.assign(sandbox, safeGlobals);

    // Create VM context
    const vmContext = vm.createContext(sandbox, {
      name: 'SecureUserScript',
      origin: 'user-script',
      codeGeneration: {
        strings: false,   // blocks eval / new Function
        wasm: false       // blocks WebAssembly
      }
    });

    // Wrap user code with hard security
    const wrappedCode = `
      (function() {
        "use strict";

        // Kill dangerous globals if they leaked
        try {
          if (typeof global !== 'undefined') global = undefined;
          if (typeof process !== 'undefined') process = undefined;
          if (typeof require !== 'undefined') require = undefined;
          if (typeof Buffer !== 'undefined') Buffer = undefined;
        } catch (e) {}

        // Freeze prototypes (prevents prototype pollution)
        Object.freeze(Object.prototype);
        Object.freeze(Array.prototype);
        Object.freeze(String.prototype);
        Object.freeze(Function.prototype);

        ${scriptCode}

        return module.exports;
      })()
    `;

    // Compile script with VM timeout (CPU protection)
    const script = new vm.Script(wrappedCode, {
      filename: 'user-script.js'
    });

    // VM timeout should be slightly less than worker termination timeout
    // This gives the VM a chance to throw an error before the worker is killed
    const vmTimeout = Math.max(100, timeoutMs - 100);

    // Run inside VM with CPU timeout
    // This will throw an error for synchronous infinite loops like while(true){}
    const exportedFn = script.runInContext(vmContext, {
      timeout: vmTimeout,          // 🔥 stops while(true) CPU loops
      displayErrors: false,
      breakOnSigint: true
    });

    if (typeof exportedFn !== 'function') {
      throw new Error('Script must export a function');
    }

    // Add timeout for async execution as well
    const executionPromise = exportedFn({ db: dbProxy, utils: utilsModule });
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Function execution timeout')), vmTimeout);
    });

    // Race between execution and timeout
    const result = await Promise.race([executionPromise, timeoutPromise]);

    // Safe serialization with circular reference detection
    const MAX_RESULT_MB = 50;
    const MAX_DEPTH = 100;
    
    function safeStringify(obj, maxDepth = MAX_DEPTH) {
      const seen = new WeakSet();
      let depth = 0;
      
      return JSON.stringify(obj, (key, value) => {
        // Track recursion depth
        if (typeof value === 'object' && value !== null) {
          depth++;
          if (depth > maxDepth) {
            return '[Max depth exceeded]';
          }
          
          // Detect circular references
          if (seen.has(value)) {
            return '[Circular reference]';
          }
          seen.add(value);
        }
        
        return value;
      });
    }
    
    let resultStr;
    try {
      resultStr = safeStringify(result);
    } catch (err) {
      throw new Error(
        `Result serialization failed: ${err.message}. ` +
        `Ensure result contains no circular references or unsupported types.`
      );
    }
    
    const resultSizeMB = resultStr.length / 1024 / 1024;
    if (resultSizeMB > MAX_RESULT_MB) {
      throw new Error(
        `Result too large: ${resultSizeMB.toFixed(1)}MB (max: ${MAX_RESULT_MB}MB). ` +
        `Reduce rows returned or use pagination.`
      );
    }

    // Validate contract strictly
    if (
      !result ||
      typeof result.rowCount !== 'number' ||
      !Array.isArray(result.rows)
    ) {
      throw new Error('Script must return { rowCount, rows }');
    }

    // Send result back safely
    parentPort.postMessage({
      type: 'result',
      ok: true,
      result
    });

  } catch (error) {
    // Sanitize dangerous errors
    let message = error.message || 'Script execution failed';

    if (
      message.includes('require is not defined') ||
      message.includes('process is not defined') ||
      message.includes('Constructor access') ||
      message.includes('dangerous')
    ) {
      message = 'Script attempted to access restricted functionality';
    }

    parentPort.postMessage({
      type: 'result',
      ok: false,
      error: message
    });
  }
})();