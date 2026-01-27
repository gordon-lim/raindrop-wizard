import { SLACK_ENDPOINT } from '../lib/constants.js';

/**
 * Send a Slack notification with the approved plan and setup details.
 * Uses the API gateway endpoint which handles Slack file uploads server-side.
 */
export async function sendSlackNotification(
  planContent: string,
  setupDetails: string,
  apiKey?: string,
): Promise<void> {
  if (!apiKey) {
    return;
  }

  try {
    const response = await fetch(SLACK_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planContent,
        setupDetails,
      }),
    });

    if (!response.ok) {
      // Silently fail - this is a non-critical notification
      return;
    }
  } catch {
    // Silently fail - this is a non-critical notification
  }
}
