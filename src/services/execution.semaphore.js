/**
 * Execution Semaphore Service
 * 
 * Limits global concurrency to prevent resource exhaustion.
 * Queues executions when max concurrency is reached.
 * Also enforces per-user limits for fairness.
 */

class ExecutionSemaphore {
  constructor(maxConcurrent = 10, maxPerUser = 3, maxQueueSize = 50) {
    this.maxConcurrent = maxConcurrent;
    this.maxPerUser = maxPerUser;
    this.maxQueueSize = maxQueueSize;
    this.current = 0;
    this.queue = [];
    this.userExecutions = new Map(); // userId -> count
    this.acquireLock = Promise.resolve(); // Mutex for acquire operations
  }
  
  async acquire(userId = null) {
    // Use a mutex to prevent race conditions when multiple requests come in simultaneously
    // This ensures per-user limit checks are atomic
    await this.acquireLock;
    
    return new Promise((resolve, reject) => {
      this.acquireLock = (async () => {
        try {
          // Check per-user limit first (BEFORE incrementing)
          if (userId) {
            const userCount = this.userExecutions.get(userId) || 0;
            if (userCount >= this.maxPerUser) {
              const error = new Error(
                `User concurrency limit exceeded. ` +
                `You have ${userCount} executions running (max: ${this.maxPerUser}). ` +
                `Please wait for them to complete.`
              );
              reject(error);
              return;
            }
          }
          
          // Check global limit
          if (this.current < this.maxConcurrent) {
            // Increment counters atomically
            this.current++;
            if (userId) {
              this.userExecutions.set(userId, (this.userExecutions.get(userId) || 0) + 1);
            }
            console.log(`[Semaphore] Acquired slot (${this.current}/${this.maxConcurrent}, user: ${userId || 'unknown'}, userCount: ${this.userExecutions.get(userId) || 0})`);
            resolve();
            return;
          }
          
          // Check queue size limit before adding to queue
          if (this.queue.length >= this.maxQueueSize) {
            const error = new Error(
              `System overloaded. Queue is full (${this.queue.length}/${this.maxQueueSize}). ` +
              `Please try again in a few minutes.`
            );
            reject(error);
            return;
          }
          
          // Wait in queue
          console.log(`[Semaphore] Queue full, waiting... (${this.queue.length} in queue)`);
          this.queue.push({ resolve, reject, userId });
        } catch (err) {
          reject(err);
        }
      })();
    });
  }
  
  release(userId = null) {
    this.current--;
    if (userId) {
      const userCount = this.userExecutions.get(userId) || 0;
      if (userCount > 0) {
        this.userExecutions.set(userId, userCount - 1);
        if (userCount - 1 === 0) {
          this.userExecutions.delete(userId);
        }
      }
    }
    console.log(`[Semaphore] Released slot (${this.current}/${this.maxConcurrent}, user: ${userId || 'unknown'}, userCount: ${this.userExecutions.get(userId) || 0})`);
    
    // Process queue - check per-user limits before allowing queued execution
    if (this.queue.length > 0) {
      // Find next eligible execution (respects per-user limits)
      let processed = false;
      for (let i = 0; i < this.queue.length; i++) {
        const { resolve, reject, userId: queuedUserId } = this.queue[i];
        
        // Check if this user can run now
        if (queuedUserId) {
          const userCount = this.userExecutions.get(queuedUserId) || 0;
          if (userCount >= this.maxPerUser) {
            // Skip this one, try next
            continue;
          }
        }
        
        // This one can run
        this.queue.splice(i, 1);
        this.current++;
        if (queuedUserId) {
          this.userExecutions.set(queuedUserId, (this.userExecutions.get(queuedUserId) || 0) + 1);
        }
        console.log(`[Semaphore] Processing queued execution (${this.queue.length} remaining, user: ${queuedUserId || 'unknown'})`);
        resolve();
        processed = true;
        break;
      }
      
      // If no execution could be processed, reject all that exceed per-user limit
      if (!processed) {
        const toReject = [];
        for (let i = this.queue.length - 1; i >= 0; i--) {
          const { reject, userId: queuedUserId } = this.queue[i];
          if (queuedUserId) {
            const userCount = this.userExecutions.get(queuedUserId) || 0;
            if (userCount >= this.maxPerUser) {
              toReject.push({ reject, userId: queuedUserId });
              this.queue.splice(i, 1);
            }
          }
        }
        
        toReject.forEach(({ reject, userId: rejectedUserId }) => {
          const userCount = this.userExecutions.get(rejectedUserId) || 0;
          reject(new Error(
            `User concurrency limit exceeded. ` +
            `You have ${userCount} executions running (max: ${this.maxPerUser}). ` +
            `Please wait for them to complete.`
          ));
        });
      }
    }
  }
  
  getStats() {
    return {
      current: this.current,
      max: this.maxConcurrent,
      queued: this.queue.length,
      maxQueueSize: this.maxQueueSize,
      maxPerUser: this.maxPerUser,
      activeUsers: this.userExecutions.size
    };
  }
  
  getUserStats(userId) {
    return {
      current: this.userExecutions.get(userId) || 0,
      max: this.maxPerUser
    };
  }
}

// Singleton instance
const executionSemaphore = new ExecutionSemaphore(
  parseInt(process.env.MAX_CONCURRENT_EXECUTIONS) || 10,
  parseInt(process.env.MAX_CONCURRENT_PER_USER) || 3,
  parseInt(process.env.MAX_QUEUE_SIZE) || 50
);

module.exports = executionSemaphore;
