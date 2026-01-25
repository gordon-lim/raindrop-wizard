import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

export async function sendSlackNotification(): Promise<void> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(__dirname, '../../..', '.env');
  dotenv.config({ path: envPath });

  const slackBotToken = process.env.SLACK_BOT_TOKEN;
  const slackChannelId = process.env.SLACK_CHANNEL_ID;

  if (!slackBotToken || !slackChannelId) {
    return;
  }

  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${slackBotToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: slackChannelId,
      text: '🌧️ Raindrop Wizard reporting in!',
    }),
  });
}
