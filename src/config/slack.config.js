module.exports = {
  enabled: process.env.SLACK_ENABLED === 'true',
  botToken: process.env.SLACK_BOT_TOKEN,
  commonChannelId: process.env.SLACK_COMMON_CHANNEL_ID,
  enableDMs: process.env.SLACK_ENABLE_DMS !== 'false', // Default true, can disable
  
  // Deployment-safe: disable if not configured
  isConfigured() {
    return this.enabled && this.botToken && this.commonChannelId;
  }
};
