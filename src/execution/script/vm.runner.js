const { Worker } = require('worker_threads');
const path = require('path');

module.exports = async function runUserScript({
  scriptCode,
  context,
  timeoutMs = 30000,  // Default 30 seconds
  executionContext = {}
}) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      path.join(__dirname, './vm.worker.js'),
      {
        workerData: {
          scriptCode,
          timeoutMs
        },
        resourceLimits: {
          maxOldGenerationSizeMb: 512,  // 512MB heap limit
          maxYoungGenerationSizeMb: 128, // 128MB young generation
          codeRangeSizeMb: 64,
          stackSizeMb: 4
        }
      }
    );

    // Register worker with watchdog for force termination if needed
    if (executionContext.onWorkerCreated) {
      executionContext.onWorkerCreated(worker);
    }

    let finished = false;

    // 🔥 HARD KILL TIMER — Forcefully terminates worker thread
    // This is the ONLY way to truly kill infinite loops like while(true){}
    const killTimer = setTimeout(() => {
      if (!finished) {
        finished = true;
        worker.terminate();   // Forcefully kills the worker thread
        reject(new Error('Script execution timeout - worker terminated'));
      }
    }, timeoutMs);

    // Handle messages from worker
    worker.on('message', async (msg) => {
      if (finished) return;

      // Worker is requesting a DB operation
      if (msg.type === 'db_call') {
        try {
          let result;
          
          if (msg.method === 'query') {
            // Postgres query
            result = await context.db.query(msg.args[0], msg.args[1]);
          } else if (msg.method === 'collection') {
            // MongoDB collection access
            const collection = context.db.collection(msg.collectionName);
            
            if (msg.operation === 'cursor') {
              // Handle cursor chain: find().limit().skip().toArray()
              let cursor = null;
              
              for (const step of msg.cursorChain) {
                if (step.method === 'find' || step.method === 'aggregate') {
                  // Initial cursor creation
                  cursor = collection[step.method](...step.args);
                  // Add cursor timeout to prevent hung cursors
                  if (cursor.maxTimeMS) {
                    cursor.maxTimeMS(25000); // 25s timeout
                  }
                } else {
                  // Chain methods like limit, skip, sort, project
                  cursor = cursor[step.method](...step.args);
                }
              }
              
              // Execute toArray on the final cursor
              result = await cursor.toArray();
            } else {
              // Direct collection operation (insertOne, updateOne, etc.)
              result = await collection[msg.operation](...msg.args);
            }
          }
          
          // Serialize result to handle MongoDB ObjectIds and other special types
          // JSON.parse(JSON.stringify()) converts ObjectIds to strings
          const serializedResult = JSON.parse(JSON.stringify(result));
          
          worker.postMessage({
            type: 'db_response',
            callId: msg.callId,
            result: serializedResult
          });
        } catch (error) {
          worker.postMessage({
            type: 'db_error',
            callId: msg.callId,
            error: error.message
          });
        }
        return;
      }

      // Worker finished execution
      if (msg.type === 'result') {
        finished = true;
        clearTimeout(killTimer);

        if (msg.ok) {
          resolve(msg.result);
        } else {
          reject(new Error(msg.error));
        }
      }
    });

    // Worker crashed
    worker.on('error', (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(killTimer);
      reject(err);
    });

    // Worker exited (could be from terminate() or natural exit)
    worker.on('exit', (code) => {
      if (!finished) {
        finished = true;
        clearTimeout(killTimer);
        
        // Clear any pending DB calls to prevent memory leaks
        pendingDbCalls.clear();
        
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      }
    });
  });
};

// Track pending DB calls for cleanup
const pendingDbCalls = new WeakMap();