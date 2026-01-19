const slackService = require('./slack.service');

/**
 * 1. New Submission Notification
 * Sent to: Common channel
 */
function newSubmissionMessage(data) {
  const { requestId, requesterEmail, database, dbName, requestType, pod, queryPreview, scriptPath } = data;
  
  const content = requestType === 'QUERY' 
    ? slackService.formatCode(queryPreview, 300)
    : slackService.formatCode(queryPreview, 500); // Show script preview, not just path

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📝 New Request Submitted',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Requester:*\n${requesterEmail}`
          },
          {
            type: 'mrkdwn',
            text: `*Database:*\n${database} / ${dbName}`
          },
          {
            type: 'mrkdwn',
            text: `*POD:*\n${pod}`
          },
          {
            type: 'mrkdwn',
            text: `*Type:*\n${requestType}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Preview:*\n${content}`
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '⏳ Awaiting approval'
          }
        ]
      }
    ],
    text: `New request from ${requesterEmail}`
  };
}

/**
 * 2. Approval + Success Notification
 * Sent to: Common channel + Requester DM
 */
function approvalSuccessMessage(data) {
  const { requestId, requesterEmail, database, executionTime, resultPreview, rowCount } = data;

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '✅ Request Executed Successfully',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Requester:*\n${requesterEmail}`
          },
          {
            type: 'mrkdwn',
            text: `*Database:*\n${database}`
          },
          {
            type: 'mrkdwn',
            text: `*Execution Time:*\n${executionTime}ms`
          },
          {
            type: 'mrkdwn',
            text: `*Rows:*\n${rowCount}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Result Preview:*\n${slackService.formatCode(resultPreview, 400)}`
        }
      }
    ],
    text: `Request executed successfully for ${requesterEmail}`
  };
}

/**
 * 3. Approval + Failure Notification
 * Sent to: Common channel + Requester DM
 */
function approvalFailureMessage(data) {
  const { requestId, requesterEmail, database, errorMessage, stackTrace } = data;

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '❌ Request Execution Failed',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Requester:*\n${requesterEmail}`
          },
          {
            type: 'mrkdwn',
            text: `*Database:*\n${database}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Error:*\n\`\`\`${slackService.truncate(errorMessage, 300)}\`\`\``
        }
      },
      ...(stackTrace ? [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Stack Trace:*\n${slackService.formatCode(stackTrace, 500)}`
        }
      }] : [])
    ],
    text: `Request execution failed for ${requesterEmail}`
  };
}

/**
 * 4. Rejection Notification
 * Sent to: Requester DM only
 */
function rejectionMessage(data) {
  const { requestId, requesterEmail, database, queryPreview, scriptPath, requestType, rejectionReason } = data;

  const content = requestType === 'QUERY' 
    ? slackService.formatCode(queryPreview, 300)
    : slackService.formatCode(queryPreview, 500); // Show script preview, not just path

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚫 Request Rejected',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Database:*\n${database}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Your Request:*\n${content}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Rejection Reason:*\n> ${rejectionReason || 'No reason provided'}`
        }
      }
    ],
    text: `Your request was rejected`
  };
}

module.exports = {
  newSubmissionMessage,
  approvalSuccessMessage,
  approvalFailureMessage,
  rejectionMessage
};
