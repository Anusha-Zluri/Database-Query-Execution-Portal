/**
 * Metrics Service
 * 
 * Tracks execution metrics for monitoring and alerting.
 * Provides Prometheus-compatible metrics endpoint.
 */

class MetricsService {
  constructor() {
    this.metrics = {
      executionsStarted: 0,
      executionsCompleted: 0,
      executionsFailed: 0,
      executionsTimedOut: 0,
      executionsKilledByWatchdog: 0,
      executionsKilledByCleanup: 0,
      backendsTerminated: 0,
      avgExecutionTimeMs: 0,
      maxExecutionTimeMs: 0,
      currentConcurrency: 0,
      maxConcurrency: 0
    };
    
    this.startTime = Date.now();
  }
  
  recordExecutionStart() {
    this.metrics.executionsStarted++;
    this.metrics.currentConcurrency++;
    this.metrics.maxConcurrency = Math.max(
      this.metrics.maxConcurrency,
      this.metrics.currentConcurrency
    );
  }
  
  recordExecutionComplete(durationMs, success) {
    this.metrics.executionsCompleted++;
    this.metrics.currentConcurrency = Math.max(0, this.metrics.currentConcurrency - 1);
    
    if (!success) {
      this.metrics.executionsFailed++;
    }
    
    // Update average execution time
    const total = this.metrics.executionsCompleted;
    this.metrics.avgExecutionTimeMs = 
      (this.metrics.avgExecutionTimeMs * (total - 1) + durationMs) / total;
    
    this.metrics.maxExecutionTimeMs = Math.max(
      this.metrics.maxExecutionTimeMs,
      durationMs
    );
  }
  
  recordTimeout() {
    this.metrics.executionsTimedOut++;
  }
  
  recordWatchdogKill() {
    this.metrics.executionsKilledByWatchdog++;
  }
  
  recordCleanupKill() {
    this.metrics.executionsKilledByCleanup++;
  }
  
  recordBackendTermination() {
    this.metrics.backendsTerminated++;
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000)
    };
  }
  
  /**
   * Get metrics in Prometheus format
   */
  getPrometheusMetrics() {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    
    return `
# HELP executions_started_total Total number of executions started
# TYPE executions_started_total counter
executions_started_total ${this.metrics.executionsStarted}

# HELP executions_completed_total Total number of executions completed
# TYPE executions_completed_total counter
executions_completed_total ${this.metrics.executionsCompleted}

# HELP executions_failed_total Total number of executions that failed
# TYPE executions_failed_total counter
executions_failed_total ${this.metrics.executionsFailed}

# HELP executions_timed_out_total Total number of executions that timed out
# TYPE executions_timed_out_total counter
executions_timed_out_total ${this.metrics.executionsTimedOut}

# HELP executions_killed_by_watchdog_total Total number of executions killed by watchdog
# TYPE executions_killed_by_watchdog_total counter
executions_killed_by_watchdog_total ${this.metrics.executionsKilledByWatchdog}

# HELP executions_killed_by_cleanup_total Total number of executions killed by cleanup service
# TYPE executions_killed_by_cleanup_total counter
executions_killed_by_cleanup_total ${this.metrics.executionsKilledByCleanup}

# HELP backends_terminated_total Total number of database backends terminated
# TYPE backends_terminated_total counter
backends_terminated_total ${this.metrics.backendsTerminated}

# HELP executions_current Current number of concurrent executions
# TYPE executions_current gauge
executions_current ${this.metrics.currentConcurrency}

# HELP executions_max_concurrency Maximum concurrent executions reached
# TYPE executions_max_concurrency gauge
executions_max_concurrency ${this.metrics.maxConcurrency}

# HELP execution_duration_avg_ms Average execution duration in milliseconds
# TYPE execution_duration_avg_ms gauge
execution_duration_avg_ms ${this.metrics.avgExecutionTimeMs.toFixed(2)}

# HELP execution_duration_max_ms Maximum execution duration in milliseconds
# TYPE execution_duration_max_ms gauge
execution_duration_max_ms ${this.metrics.maxExecutionTimeMs}

# HELP system_uptime_seconds System uptime in seconds
# TYPE system_uptime_seconds counter
system_uptime_seconds ${uptime}
    `.trim();
  }
  
  /**
   * Check if system is healthy based on metrics
   */
  getHealthStatus() {
    const metrics = this.getMetrics();
    
    // Calculate failure rate
    const totalExecutions = metrics.executionsCompleted;
    const failureRate = totalExecutions > 0 
      ? (metrics.executionsFailed / totalExecutions) * 100 
      : 0;
    
    // Calculate timeout rate
    const timeoutRate = totalExecutions > 0
      ? (metrics.executionsTimedOut / totalExecutions) * 100
      : 0;
    
    let status = 'healthy';
    const warnings = [];
    
    // High failure rate
    if (failureRate > 50) {
      status = 'degraded';
      warnings.push(`High failure rate: ${failureRate.toFixed(1)}%`);
    }
    
    // High timeout rate
    if (timeoutRate > 20) {
      status = 'degraded';
      warnings.push(`High timeout rate: ${timeoutRate.toFixed(1)}%`);
    }
    
    // High concurrency
    if (metrics.currentConcurrency > 15) {
      status = 'degraded';
      warnings.push(`High concurrency: ${metrics.currentConcurrency}`);
    }
    
    // Many watchdog kills (indicates system stress)
    if (metrics.executionsKilledByWatchdog > 10) {
      status = 'degraded';
      warnings.push(`Many watchdog kills: ${metrics.executionsKilledByWatchdog}`);
    }
    
    return {
      status,
      warnings,
      metrics: {
        failureRate: failureRate.toFixed(1) + '%',
        timeoutRate: timeoutRate.toFixed(1) + '%',
        currentConcurrency: metrics.currentConcurrency,
        totalExecutions: totalExecutions
      }
    };
  }
}

// Singleton instance
const metricsService = new MetricsService();

module.exports = metricsService;
