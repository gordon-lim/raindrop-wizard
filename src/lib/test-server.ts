import Chalk from 'chalk';

// chalk v2 types don't work well with ESM default imports
const chalk = Chalk as any;
import ui from '../utils/ui.js';
import { logToFile } from '../utils/debug.js';
import { waitForUserKeyPress } from '../utils/clack-utils.js';
import { EVENTS_LIST_ENDPOINT } from './constants.js';
import { buildTestFeedbackMessage } from './agent-prompts.js';
import type { WizardOptions } from '../utils/types.js';

const POLL_INTERVAL_MS = 2000;

/**
 * Event format from the events list API
 */
interface ApiEvent {
  id: string;
  name?: string;
  timestamp?: string;
  receivedAt?: string;
  userId?: string;
  customEventId?: string;
  properties?: Record<string, unknown>;
  aiData?: {
    input?: string;
    output?: string;
    model?: string;
    convoId?: string | null;
  };
  topics?: unknown[];
  inputAttachments?: unknown[];
  outputAttachments?: unknown[];
  signals?: unknown[];
  errorSpans?: unknown[];
  toolCalls?: unknown[];
  toolCallNames?: string[];
  [key: string]: unknown;
}

/**
 * Wrapper for received events
 */
export interface ReceivedEvent {
  url: string;
  data: ApiEvent;
}

/**
 * Fetch events from the API endpoint, filtered by wizard session ID
 */
async function fetchEvents(
  accessToken: string,
  wizardSessionId: string,
): Promise<ApiEvent[]> {
  try {
    const response = await fetch(EVENTS_LIST_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-wizard-session': wizardSessionId,
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    // API returns an array of events directly
    const events = (await response.json()) as ApiEvent[];
    return events || [];
  } catch (error) {
    logToFile('Error fetching events:', error);
    return [];
  }
}

/**
 * Test the integration by polling the events list endpoint.
 * Returns feedbackPrompt if user wants to retry, otherwise shouldRetry is false.
 */
export async function testIntegration(
  options: WizardOptions,
  accessToken: string,
): Promise<{ shouldRetry: boolean; feedbackPrompt?: string }> {
  const receivedEvents: ReceivedEvent[] = [];
  const seenEventIds = new Set<string>();
  let isPolling = true;

  // Add header to indicate start of testing phase
  ui.addItem({ type: 'phase', text: '### Testing ###' });

  const testSpinner = ui.spinner();
  testSpinner.start(
    String(chalk.cyan('Test your integration: ')) +
      String(chalk.dim('Interact with your AI. Events will appear above. ')) +
      String(chalk.yellow('Press any key when done testing...')),
  );

  // Start polling in the background
  void (async () => {
    while (isPolling) {
      const events = await fetchEvents(accessToken, options.sessionId);

      for (const event of events) {
        // Skip events we've already seen
        if (event.id && seenEventIds.has(event.id)) {
          continue;
        }

        if (event.id) {
          seenEventIds.add(event.id);
        }

        receivedEvents.push({ url: EVENTS_LIST_ENDPOINT, data: event });

        ui.addItem({
          type: 'received-event',
          text: event.name || 'unknown',
          receivedEvent: {
            id: event.id,
            eventName: event.name || 'unknown',
            timestamp: event.timestamp,
            model: event.aiData?.model,
            userId: event.userId,
            input: event.aiData?.input,
            output: event.aiData?.output,
          },
        });
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  })();

  // Wait for user to finish testing
  await waitForUserKeyPress();

  // Stop polling and spinner
  isPolling = false;
  testSpinner.stop();
  // Let pollPromise finish in the background - no need to wait

  logToFile(`Polling stopped, received ${receivedEvents.length} events`);

  // Ask if results look good (with inline text input for feedback)
  const result = await ui.feedbackSelect({
    message: 'Do the results look good?',
    options: [
      { value: true, label: 'Yes, looks good - proceed' },
      {
        value: false,
        label: 'No, I need to provide feedback',
        allowTextInput: true,
      },
    ],
  });

  // User selected "Yes, looks good"
  if (result.type === 'option' && result.value === true) {
    return { shouldRetry: false };
  }

  // User typed feedback
  const userFeedback = result.value as string;

  // Build feedback prompt for agent
  const feedbackPrompt = buildTestFeedbackMessage(receivedEvents, userFeedback);

  return { shouldRetry: true, feedbackPrompt };
}
