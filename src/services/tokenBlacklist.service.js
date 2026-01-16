const crypto = require('crypto');
const { pool } = require('../config/db');

class TokenBlacklistService {
  // Hash token for storage (don't store full JWT for security)
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // Add token to blacklist
  async blacklistToken(token, userId, expiresAt) {
    const tokenHash = this.hashToken(token);
    
    try {
      await pool.query(
        `INSERT INTO public.blacklisted_tokens (token_hash, user_id, expires_at) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (token_hash) DO NOTHING`,
        [tokenHash, userId, expiresAt]
      );
      console.log('Token blacklisted successfully');
    } catch (error) {
      console.error('Error blacklisting token:', error);
      throw error;
    }
  }

  // Check if token is blacklisted
  async isTokenBlacklisted(token) {
    const tokenHash = this.hashToken(token);
    
    try {
      const result = await pool.query(
        `SELECT 1 FROM public.blacklisted_tokens 
         WHERE token_hash = $1 AND expires_at > NOW()`,
        [tokenHash]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking token blacklist:', error);
      // If there's an error, assume token is valid to avoid blocking users
      return false;
    }
  }

  // Cleanup expired tokens (run this periodically)
  async cleanupExpiredTokens() {
    try {
      const result = await pool.query(
        'DELETE FROM public.blacklisted_tokens WHERE expires_at <= NOW()'
      );
      console.log(`Cleaned up ${result.rowCount} expired blacklisted tokens`);
      return result.rowCount;
    } catch (error) {
      console.error('Error cleaning up expired tokens:', error);
      throw error;
    }
  }
}

module.exports = new TokenBlacklistService();