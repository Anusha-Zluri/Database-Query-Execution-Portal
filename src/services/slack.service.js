const { WebClient } = require('@slack/web-api');
const slackConfig = require('../config/slack.config');

class SlackService {
  constructor() {
    if (slackConfig.isConfigured()) {
      this.client = new WebClient(slackConfig.botToken);
      this.enabled = true;
    } else {
      this.enabled = false;
      console.warn('Slack integration disabled: Missing configuration');
    }
  }

  /**
   * Send message to common channel
   * Non-blocking: catches errors and logs them
   */
  async sendToCommonChannel(blocks, text) {
    if (!this.enabled) return;

    try {
      await this.client.chat.postMessage({
        channel: slackConfig.commonChannelId,
        blocks,
        text, // Fallback text for notifications
      });
    } catch (error) {
      console.error('Failed to send Slack message to common channel:', error.message);
      // Don't throw - we don't want to break business logic
    }
  }

  /**
   * Send DM to user by email
   * Non-blocking: catches errors and logs them
   * Falls back gracefully if user not found
   */
  async sendDM(userEmail, blocks, text) {
    if (!this.enabled || !slackConfig.enableDMs) {
      return; // DMs disabled
    }

    try {
      // Look up user by email
      const user = await this.client.users.lookupByEmail({ email: userEmail });
      
      if (!user || !user.user) {
        console.warn(`Slack user not found for email: ${userEmail} - DM not sent`);
        return;
      }

      // Send DM
      await this.client.chat.postMessage({
        channel: user.user.id,
        blocks,
        text, // Fallback text
      });
      
      console.log(`Slack DM sent to ${userEmail}`);
    } catch (error) {
      // This is expected to fail with dummy emails - just log and continue
      console.warn(`Could not send Slack DM to ${userEmail}: ${error.message}`);
      // Don't throw - we don't want to break business logic
    }
  }

  /**
   * Send to both common channel and DM
   * If DM fails (e.g., dummy email), only common channel gets the message
   */
  async sendToChannelAndDM(userEmail, blocks, text) {
    // Run in parallel but don't wait
    Promise.all([
      this.sendToCommonChannel(blocks, text),
      this.sendDM(userEmail, blocks, text)
    ]).catch(err => {
      console.error('Failed to send Slack notifications:', err.message);
    });
  }

  /**
   * Truncate text for display
   */
  truncate(text, maxLength = 200) {
    if (!text) return 'N/A';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Format code block for Slack
   */
  formatCode(code, maxLength = 500) {
    const truncated = this.truncate(code, maxLength);
    return `\`\`\`${truncated}\`\`\``;
  }
}

module.exports = new SlackService();
