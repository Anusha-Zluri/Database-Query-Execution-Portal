/**
 * Execution Cleanup Service
 * 
 * Failsafe mechanism to prevent stuck executions.
 * Runs periodically to mark any executions that have been RUNNING too long as FAILED.
 * Also kills orphaned Postgres backend queries.
 * 
 * This handles edge cases where:
 * - Worker was killed but status update failed
 * - System crashed during execution
 * - Database transaction was interrupted
 * - Watchdog failed to kill execution
 */

const { getORM } = require('../config/orm');

const EXECUTION_TIMEOUT_SECONDS = 35; // Slightly longer than worker timeout (30s)
const CLEANUP_INTERVAL_MS = 10000; // Run every 10 seconds

let cleanupInterval = null;

/**
 * Mark stuck executions as FAILED and kill their backend queries
 */
async function cleanupStuckExecutions() {
  try {
    const orm = await getORM();
    const em = orm.em.fork();

    // Find executions that have been running too long
    const stuckExecutions = await em.getConnection().execute(`
      SELECT id, request_id, backend_pid
      FROM executions
      WHERE status = 'RUNNING' 
        AND started_at < NOW() - INTERVAL '${EXECUTION_TIMEOUT_SECONDS} seconds'
    `);

    if (stuckExecutions.length === 0) {
      return 0;
    }

    console.warn(`[CleanupService] Found ${stuckExecutions.length} stuck executions`);

    // Kill Postgres backends first
    for (const exec of stuckExecutions) {
      if (exec.backend_pid) {
        try {
          await em.getConnection().execute(`
            SELECT pg_terminate_backend($1)
          `, [exec.backend_pid]);
          
          console.log(`[CleanupService] Killed Postgres backend ${exec.backend_pid} for execution ${exec.id}`);
          
          // Record metric
          const metricsService = require('./metrics.service');
          metricsService.recordBackendTermination();
        } catch (err) {
          console.error(`[CleanupService] Failed to kill backend ${exec.backend_pid}:`, err.message);
        }
      }
    }

    // Mark all stuck executions as FAILED
    const updated = await em.getConnection().execute(`
      UPDATE executions 
      SET 
        status = 'FAILED',
        error_message = 'Execution timeout',
        finished_at = NOW(),
        duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
        backend_pid = NULL,
        mongo_connection_id = NULL
      WHERE status = 'RUNNING' 
        AND started_at < NOW() - INTERVAL '${EXECUTION_TIMEOUT_SECONDS} seconds'
      RETURNING id
    `);

    console.warn(`[CleanupService] Cleaned up ${updated.length} stuck executions:`, 
      updated.map(e => e.id));

    // Record metrics
    const metricsService = require('./metrics.service');
    for (let i = 0; i < updated.length; i++) {
      metricsService.recordCleanupKill();
    }

    return updated.length;
  } catch (error) {
    console.error('[CleanupService] Error during cleanup:', error.message);
    // Don't throw - we want cleanup to continue running
    return 0;
  }
}

/**
 * Kill orphaned Postgres backends that are running too long
 * This catches queries that somehow escaped execution tracking
 */
async function killOrphanedBackends() {
  try {
    const orm = await getORM();
    const em = orm.em.fork();

    // Find long-running script_executor backends (> 35 seconds)
    const orphanedBackends = await em.getConnection().execute(`
      SELECT 
        pid,
        usename,
        application_name,
        state,
        query,
        NOW() - query_start as duration
      FROM pg_stat_activity
      WHERE application_name = 'script_executor'
        AND state = 'active'
        AND query NOT LIKE '%pg_stat_activity%'
        AND query NOT LIKE '%pg_terminate_backend%'
        AND NOW() - query_start > INTERVAL '35 seconds'
    `);

    if (orphanedBackends.length > 0) {
      console.warn(`[CleanupService] Found ${orphanedBackends.length} orphaned script_executor backends`);

      for (const backend of orphanedBackends) {
        try {
          await em.getConnection().execute(`
            SELECT pg_terminate_backend($1)
          `, [backend.pid]);
          
          console.log(`[CleanupService] Killed orphaned backend ${backend.pid} (running for ${backend.duration})`);
          
          const metricsService = require('./metrics.service');
          metricsService.recordBackendTermination();
        } catch (err) {
          console.error(`[CleanupService] Failed to kill orphaned backend ${backend.pid}:`, err.message);
        }
      }
    }

    return orphanedBackends.length;
  } catch (error) {
    console.error('[CleanupService] Error killing orphaned backends:', error.message);
    return 0;
  }
}

/**
 * Main cleanup function - runs both cleanup tasks
 */
async function runCleanup() {
  const stuckCount = await cleanupStuckExecutions();
  const orphanedCount = await killOrphanedBackends();
  
  if (stuckCount > 0 || orphanedCount > 0) {
    console.log(`[CleanupService] Cleanup complete: ${stuckCount} executions, ${orphanedCount} backends`);
  }
}

/**
 * Start the cleanup service
 */
function startCleanupService() {
  if (cleanupInterval) {
    console.warn('[CleanupService] Already running');
    return;
  }

  console.log(`[CleanupService] Starting (interval: ${CLEANUP_INTERVAL_MS}ms, timeout: ${EXECUTION_TIMEOUT_SECONDS}s)`);

  // Run immediately on start
  runCleanup();

  // Then run periodically
  cleanupInterval = setInterval(() => {
    runCleanup();
  }, CLEANUP_INTERVAL_MS);

  // Ensure cleanup runs on process exit
  process.on('SIGTERM', stopCleanupService);
  process.on('SIGINT', stopCleanupService);
}

/**
 * Stop the cleanup service
 */
function stopCleanupService() {
  if (cleanupInterval) {
    console.log('[CleanupService] Stopping');
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

module.exports = {
  startCleanupService,
  stopCleanupService,
  cleanupStuckExecutions,
  killOrphanedBackends
};
