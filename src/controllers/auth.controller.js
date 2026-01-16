const jwt = require('jsonwebtoken');
const { loginUser } = require('../services/auth.service');
const jwtConfig = require('../config/jwt');
const tokenBlacklistService = require('../services/tokenBlacklist.service');

/* ================= LOGIN ================= */

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await loginUser(email, password);

    const token = jwt.sign(user, jwtConfig.secret, {
      expiresIn: jwtConfig.expiresIn,
    });

    // Occasionally cleanup expired tokens (10% chance on login)
    if (Math.random() < 0.1) {
      tokenBlacklistService.cleanupExpiredTokens().catch(err => {
        console.error('Token cleanup failed during login:', err);
      });
    }

    res.json({ token });
  } catch (err) {
    res.status(401).json({ message: err.message });
  }
};

/* ================= GET ME ================= */

exports.me = async (req, res) => {
  res.json(req.user);
};

/* ================= LOGOUT ================= */

exports.logout = async (req, res) => {
  try {
    const token = req.token; // Set by auth middleware
    const userId = req.user.id;
    
    // Decode token to get expiration time
    const decoded = jwt.decode(token);
    const expiresAt = new Date(decoded.exp * 1000); // Convert from seconds to milliseconds
    
    // Add token to blacklist
    await tokenBlacklistService.blacklistToken(token, userId, expiresAt);
    
    // Run cleanup of expired tokens (async, don't wait for it)
    tokenBlacklistService.cleanupExpiredTokens().catch(err => {
      console.error('Token cleanup failed during logout:', err);
    });
    
    res.json({ 
      message: 'Logged out successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      message: 'Logout failed',
      error: error.message 
    });
  }
};

/* ================= TOKEN CLEANUP ================= */

exports.cleanupTokens = async (req, res) => {
  try {
    const cleanedCount = await tokenBlacklistService.cleanupExpiredTokens();
    res.json({ 
      message: 'Token cleanup completed',
      cleanedTokens: cleanedCount 
    });
  } catch (error) {
    console.error('Token cleanup error:', error);
    res.status(500).json({ 
      message: 'Token cleanup failed',
      error: error.message 
    });
  }
};