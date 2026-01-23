import http from 'http';
import chalk from 'chalk';
import clack from '../utils/clack';
import { logToFile } from '../utils/debug';
import {
  parseOtelTraces,
  spanToSimpleFormat,
  extractAIAttributes,
} from './otel-parser';
import { waitForUserKeyPress } from '../utils/clack-utils';
import { TEST_PORT, TEST_URL } from './constants';
import { buildTestFeedbackMessage } from './agent-prompts';
import { runAgent, type AgentRunConfig } from './agent-interface';
import type { FrameworkConfig } from './framework-config';
import type { WizardOptions } from '../utils/types';

/**
 * JSON event format (legacy raindrop.ai event)
 */
interface JsonEvent {
  input?: unknown;
  output?: unknown;
  model?: string;
  convo_id?: string;
  event_id?: string;
  user_id?: string;
  is_pending?: boolean | string;
  [key: string]: unknown;
}

/**
 * OTEL event format (parsed from protobuf)
 */
interface OtelEvent {
  format: 'otel';
  spans: unknown[];
  aiAttributes: Record<string, unknown>;
}

/**
 * Wrapper for received events with URL context
 */
export interface ReceivedEvent {
  url: string;
  data: JsonEvent | OtelEvent;
}

/**
 * Create an HTTP server to receive test events
 */
function createTestServer(): {
  server: http.Server;
  getReceivedEvents: () => ReceivedEvent[];
  close: () => void;
} {
  const eventsReceived: ReceivedEvent[] = [];

  const server = http.createServer((req, res) => {
    if (req.method === 'POST') {
      const contentType = req.headers['content-type'] || '';
      const isJson = contentType.includes('application/json');

      const chunks: Buffer[] = [];

      req.on('data', (chunk) => {
        chunks.push(Buffer.from(chunk));
      });

      req.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);

          let event: JsonEvent | OtelEvent;

          if (isJson) {
            // JSON content-type = legacy raindrop.ai event format
            const body = buffer.toString('utf-8');
            const parsedJson = JSON.parse(body);

            event = parsedJson;
          } else {
            // Binary protobuf = OTEL format
            try {
              const { spans } = parseOtelTraces(
                new Uint8Array(buffer),
                contentType,
              );

              // Convert OTEL spans to event format
              event = {
                format: 'otel',
                spans: spans.map(spanToSimpleFormat),
                aiAttributes: extractAIAttributes(spans),
              };
            } catch (protobufError) {
              // If protobuf parsing fails, store raw buffer
              event = {
                rawBuffer: buffer,
                error:
                  protobufError instanceof Error
                    ? protobufError.message
                    : String(protobufError),
              };

              clack.log.warn(
                chalk.yellow('Failed to parse as OTEL protobuf:') +
                  '\n' +
                  chalk.dim(
                    protobufError instanceof Error
                      ? protobufError.message
                      : String(protobufError),
                  ),
              );
            }
          }

          // Handle different event types - never auto-complete, always wait for user keypress
          const isOtelTrace = 'format' in event && event.format === 'otel';

          if (isOtelTrace) {
            // OTEL protobuf format
            const otelEvent = event as OtelEvent;
            const hasSpans = otelEvent.spans && otelEvent.spans.length > 0;

            if (hasSpans) {
              // Has spans: add to list
              eventsReceived.push({ url: req.url || '/', data: otelEvent });

              clack.log.info(
                chalk.cyan(`\n━━━ OTEL Trace at ${req.url} ━━━`) +
                  '\n' +
                  chalk.dim(JSON.stringify(otelEvent, null, 2)) +
                  '\n' +
                  chalk.green(`✓ ${otelEvent.spans.length} span(s)`) +
                  '\n' +
                  chalk.yellow(
                    `Continue interacting or press any key to talk to the agent...`,
                  ),
              );
            } else {
              // Empty OTEL trace: ignore and continue listening
              clack.log.info(
                chalk.dim(`OTEL trace with 0 spans at ${req.url} - ignoring`),
              );
            }
          } else {
            // JSON event format: always add to list
            const jsonEvent = event as JsonEvent;
            eventsReceived.push({ url: req.url || '/', data: jsonEvent });

            // Check if this is a completion event (for display only, don't auto-complete)
            const isComplete =
              jsonEvent.is_pending === false ||
              jsonEvent.is_pending === 'false';

            clack.log.info(
              chalk.cyan(`\n━━━ Event at ${req.url} ━━━`) +
                '\n' +
                chalk.dim(JSON.stringify(jsonEvent, null, 2)) +
                '\n' +
                (isComplete
                  ? chalk.green(`Completion event (is_pending=false)`)
                  : chalk.green(`Partial event (is_pending=true)`)) +
                '\n' +
                chalk.yellow(
                  `Continue interacting or press any key to talk to the agent...`,
                ),
            );
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          clack.log.error(
            chalk.red('Failed to parse request:') +
              '\n' +
              chalk.dim(
                `Error: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              ),
          );
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to parse request body' }));
        }
      });
    } else {
      clack.log.warn(
        chalk.yellow('Non-POST request received:') +
          '\n' +
          chalk.dim(`Method: ${req.method}`) +
          '\n' +
          chalk.dim(`URL: ${req.url}`),
      );
      res.writeHead(404);
      res.end();
    }
  });

  return {
    server,
    getReceivedEvents: () => {
      return eventsReceived;
    },
    close: () => {
      server.close((err) => {
        if (err) {
          logToFile('Error closing test server:', err);
        } else {
          logToFile('Test server closed successfully');
        }
      });
    },
  };
}

/**
 * Test the integration by waiting for events on a local test server
 */
export async function testIntegration(
  agentConfig: AgentRunConfig,
  sessionId: string | undefined,
  config: FrameworkConfig,
  options: WizardOptions,
  spinner: any,
  attemptNumber: number,
): Promise<{ sessionId?: string; shouldRetry: boolean }> {
  const { server, close, getReceivedEvents } = createTestServer();

  try {
    // Start the server
    await new Promise<void>((resolve, reject) => {
      server.listen(TEST_PORT, () => {
        logToFile(`Test server listening on ${TEST_URL}`);
        resolve();
      });
      server.on('error', reject);
    });

    clack.log.step(
      chalk.cyan(`\nTest your integration (Attempt ${attemptNumber}):`) +
        '\n' +
        chalk.dim(`Interact with your AI.`) +
        '\n' +
        chalk.dim('Events will appear below as they arrive...') +
        '\n' +
        chalk.yellow('Press any key when done testing...'),
    );

    // Wait for user to finish testing
    await waitForUserKeyPress();

    // Get all received events
    const receivedEvents = getReceivedEvents();

    // Ask if results look good
    const resultsGood = await clack.select({
      message: `Test attempt ${attemptNumber}: Do the results look good?`,
      options: [
        { value: true, label: 'Yes, looks good - proceed' },
        { value: false, label: 'No, I need to provide feedback' },
      ],
    });

    if (resultsGood) {
      // User is satisfied
      clack.log.success('Integration test passed!');
      return { sessionId, shouldRetry: false };
    }

    // User wants to provide feedback
    const userFeedback = await clack.text({
      message: 'Provide feedback on the issues:',
      placeholder: 'e.g., "user_id is missing" or "wrong endpoint"',
    });

    // Build feedback for agent
    const feedback = buildTestFeedbackMessage(
      receivedEvents,
      userFeedback as string,
      attemptNumber,
    );

    // Run agent with feedback, resuming the previous session if we have a session ID
    if (sessionId) {
      const newSessionId = await runAgent(
        agentConfig,
        feedback,
        options,
        spinner,
        {
          spinnerMessage: `Analyzing feedback and fixing issues (attempt ${attemptNumber})...`,
          successMessage: `Agent completed fixes (attempt ${attemptNumber})`,
          errorMessage: 'Failed to process feedback',
          resume: sessionId,
        },
      );
      return { sessionId: newSessionId, shouldRetry: true };
    } else {
      clack.log.warn(
        chalk.yellow('No session ID available, cannot continue testing'),
      );
      return { sessionId: undefined, shouldRetry: false };
    }
  } finally {
    // Clean up server
    close();
  }
}
