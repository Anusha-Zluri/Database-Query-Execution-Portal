/**
 * Execution Watchdog Service
 * 
 * In-memory failsafe that tracks active executions and force-kills them if they exceed timeout.
 * This works even if the database is down or slow.
 * 
 * Key features:
 * - Tracks all active executions in memory
 * - Sets hard timeout per execution
 * - Kills worker threads (JS/VM)
 * - Kills Postgres backend queries
 * - Marks executions as FAILED
 * - Independent of database availability
 */

const activeExecutions = new Map(); // executionId -> execution metadata

class ExecutionWatchdog {
  /**
   * Register a new execution for monitoring
   */
  static register(executionId, timeoutMs = 35000) {
    const startTime = Date.now();
    
    // Set hard timeout - this will fire even if everything else fails
    const timeoutHandle = setTimeout(() => {
      this.forceKill(executionId);
    }, timeoutMs);
    
    activeExecutions.set(executionId, {
      executionId,
      startTime,
      timeoutHandle,
      backendPid: null,
      mongoConnectionId: null,
      workerThread: null, // Store worker reference for force termination
      timeoutMs
    });
    
    console.log(`[Watchdog] Registered execution ${executionId} (timeout: ${timeoutMs}ms)`);
  }
  
  /**
   * Store worker thread reference for later termination if needed
   */
  static setWorkerThread(executionId, worker) {
    const exec = activeExecutions.get(executionId);
    if (exec) {
      exec.workerThread = worker;
      console.log(`[Watchdog] Stored worker thread for execution ${executionId}`);
    }
  }
  
  /**
   * Store backend PID for later termination if needed
   */
  static setBackendPid(executionId, backendPid) {
    const exec = activeExecutions.get(executionId);
    if (exec) {
      exec.backendPid = backendPid;
      console.log(`[Watchdog] Stored backend PID ${backendPid} for execution ${executionId}`);
    }
  }
  
  /**
   * Store MongoDB connection ID
   */
  static setMongoConnectionId(executionId, connectionId) {
    const exec = activeExecutions.get(executionId);
    if (exec) {
      exec.mongoConnectionId = connectionId;
      console.log(`[Watchdog] Stored Mongo connection ${connectionId} for execution ${executionId}`);
    }
  }
  
  /**
   * Force-kill an execution that has exceeded its timeout
   * This is the nuclear option - kills worker thread, backend query, and marks execution failed
   */
  static async forceKill(executionId) {
    const exec = activeExecutions.get(executionId);
    if (!exec) {
      console.warn(`[Watchdog] Execution ${executionId} not found in registry`);
      return;
    }
    
    const runningFor = Date.now() - exec.startTime;
    console.warn(`[Watchdog] Force-killing execution ${executionId} (running for ${runningFor}ms)`);
    
    try {
      // 1. Kill worker thread first (stops JS execution)
      if (exec.workerThread) {
        try {
          exec.workerThread.terminate();
          console.log(`[Watchdog] Terminated worker thread for execution ${executionId}`);
        } catch (err) {
          console.error(`[Watchdog] Failed to terminate worker thread:`, err.message);
        }
      }
      
      // 2. Kill Postgres backend query if we have PID
      if (exec.backendPid) {
        try {
          const { getORM } = require('../config/orm');
          const orm = await getORM();
          await orm.em.getConnection().execute(
            'SELECT pg_terminate_backend($1)',
            [exec.backendPid]
          );
          console.log(`[Watchdog] Killed Postgres backend ${exec.backendPid}`);
          
          // Record metric
          const metricsService = require('./metrics.service');
          metricsService.recordBackendTermination();
        } catch (err) {
          console.error(`[Watchdog] Failed to kill Postgres backend ${exec.backendPid}:`, err.message);
        }
      }
      
      // 3. For MongoDB, we can't kill individual queries, but the connection will be closed
      // when the pool is destroyed in the executor's finally block
      
      // 4. Mark execution as failed in database
      try {
        const executionDAL = require('../dal/execution.dal');
        await executionDAL.markExecutionFailure(
          executionId,
          runningFor,
          'Execution timeout - killed by watchdog',
          null
        );
        console.log(`[Watchdog] Marked execution ${executionId} as FAILED`);
        
        // Record metric
        const metricsService = require('./metrics.service');
        metricsService.recordWatchdogKill();
      } catch (err) {
        console.error(`[Watchdog] Failed to mark execution ${executionId} as FAILED:`, err.message);
        // This is critical - if we can't update the DB, the cleanup service will catch it
      }
    } catch (err) {
      // Catch-all to prevent watchdog itself from crashing
      console.error(`[Watchdog] Critical error in forceKill for execution ${executionId}:`, err.message);
    } finally {
      // Always unregister, even if something failed
      this.unregister(executionId);
    }
  }
  
  /**
   * Unregister an execution (called when execution completes normally)
   */
  static unregister(executionId) {
    const exec = activeExecutions.get(executionId);
    if (exec) {
      clearTimeout(exec.timeoutHandle);
      activeExecutions.delete(executionId);
      
      const runningFor = Date.now() - exec.startTime;
      console.log(`[Watchdog] Unregistered execution ${executionId} (ran for ${runningFor}ms)`);
    }
  }
  
  /**
   * Get count of active executions
   */
  static getActiveCount() {
    return activeExecutions.size;
  }
  
  /**
   * Get details of all active executions
   */
  static getActiveExecutions() {
    return Array.from(activeExecutions.values()).map(exec => ({
      executionId: exec.executionId,
      runningFor: Date.now() - exec.startTime,
      timeoutIn: exec.timeoutMs - (Date.now() - exec.startTime),
      backendPid: exec.backendPid,
      mongoConnectionId: exec.mongoConnectionId
    }));
  }
  
  /**
   * Emergency: Kill all active executions
   * Use only in extreme situations (e.g., system shutdown)
   */
  static async killAll() {
    console.warn(`[Watchdog] Emergency: Killing all ${activeExecutions.size} active executions`);
    
    const promises = [];
    for (const executionId of activeExecutions.keys()) {
      promises.push(this.forceKill(executionId));
    }
    
    await Promise.allSettled(promises);
    console.log(`[Watchdog] Emergency kill complete`);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Watchdog] SIGTERM received, killing all active executions...');
  await ExecutionWatchdog.killAll();
});

process.on('SIGINT', async () => {
  console.log('[Watchdog] SIGINT received, killing all active executions...');
  await ExecutionWatchdog.killAll();
});

module.exports = ExecutionWatchdog;
