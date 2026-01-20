/**
 * Rate Limiting Middleware
 * 
 * Prevents users from spamming execution requests.
 * Limits based on user ID (if authenticated) or IP address.
 */

const rateLimit = require('express-rate-limit');

const executionRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 10, // 10 executions per minute
  message: {
    error: 'Too many execution requests',
    message: 'You have exceeded the rate limit. Please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  // Use user ID if authenticated, otherwise use default IP handling
  keyGenerator: (req) => {
    // If user is authenticated, use their ID
    if (req.user?.id) {
      return `user_${req.user.id}`;
    }
    // Otherwise, let express-rate-limit handle IP (supports IPv6)
    return undefined;
  },
  // Skip rate limiting for health checks
  skip: (req) => {
    return req.path === '/health' || req.path === '/metrics';
  }
});

module.exports = { executionRateLimiter };
