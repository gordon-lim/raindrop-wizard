import {
  getWelcomeMessage,
  SPINNER_MESSAGE,
  type FrameworkConfig,
} from './framework-config';
import type { WizardOptions } from '../utils/types';
import {
  abort,
  askForAIConsent,
  confirmContinueIfNoOrDirtyGitRepo,
  printWelcome,
  waitForUserKeyPress,
} from '../utils/clack-utils';
import { writeApiKeyToEnv } from '../utils/environment';
import fs from 'fs';
import path from 'path';
import clack from '../utils/clack';
import { initializeAgent, runAgent, type AgentRunConfig } from './agent-interface';
import { logToFile, LOG_FILE_PATH } from '../utils/debug';
import chalk from 'chalk';
import { askForWizardLogin } from '../utils/clack-utils';
import { getUserApiKey } from '../utils/oauth';
import axios from 'axios';
import { API_BASE_URL, TEST_PORT, TEST_URL, Integration } from './constants';
import http from 'http';
import { parseOtelTraces, spanToSimpleFormat, extractAIAttributes } from './otel-parser';

/**
 * Create an HTTP server to receive test events
 */
function createTestServer(): {
  server: http.Server;
  getReceivedEvents: () => any[];
  close: () => void;
} {
  const eventsReceived: any[] = [];

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

          let event: any;
          let bodyForLogging: string;

          if (isJson) {
            // JSON content-type = legacy raindrop.ai event format
            const body = buffer.toString('utf-8');
            const parsedJson = JSON.parse(body);

            bodyForLogging = body;
            event = parsedJson;

          } else {
            // Binary protobuf = OTEL format
            try {
              const { spans, format } = parseOtelTraces(new Uint8Array(buffer), contentType);
              bodyForLogging = `[OTEL ${format} data with ${spans.length} span(s), ${buffer.length} bytes]`;

              // Convert OTEL spans to event format
              event = {
                format: 'otel',
                spans: spans.map(spanToSimpleFormat),
                aiAttributes: extractAIAttributes(spans),
              };

            } catch (protobufError) {
              // If protobuf parsing fails, store raw buffer
              bodyForLogging = `[Binary data, ${buffer.length} bytes - failed to parse as OTEL protobuf]`;
              event = { rawBuffer: buffer, error: protobufError instanceof Error ? protobufError.message : String(protobufError) };

              clack.log.warn(
                chalk.yellow('Failed to parse as OTEL protobuf:') +
                '\n' +
                chalk.dim(protobufError instanceof Error ? protobufError.message : String(protobufError))
              );
            }
          }

          // Handle different event types - never auto-complete, always wait for user keypress
          const isOtelTrace = event.format === 'otel';
          const isJsonEvent = !isOtelTrace;

          if (isJsonEvent) {
            // JSON event format: always add to list
            eventsReceived.push({ url: req.url || '/', data: event });

            // Check if this is a completion event (for display only, don't auto-complete)
            const isComplete = event.is_pending === false || event.is_pending === 'false';

            clack.log.info(
              chalk.cyan(`\n━━━ Event at ${req.url} ━━━`) +
              '\n' +
              chalk.dim(JSON.stringify(event, null, 2)) +
              '\n' +
              (isComplete
                ? chalk.green(`Completion event (is_pending=false)`)
                : chalk.green(`Partial event (is_pending=true)`)) +
              '\n' +
              chalk.yellow(`Continue interacting or press any key to talk to the agent...`)
            );
          } else {
            // OTEL protobuf format
            const hasSpans = event.spans && event.spans.length > 0;

            if (hasSpans) {
              // Has spans: add to list
              eventsReceived.push({ url: req.url || '/', data: event });

              clack.log.info(
                chalk.cyan(`\n━━━ OTEL Trace at ${req.url} ━━━`) +
                '\n' +
                chalk.dim(JSON.stringify(event, null, 2)) +
                '\n' +
                chalk.green(`✓ ${event.spans.length} span(s)`) +
                '\n' +
                chalk.yellow(`Continue interacting or press any key to talk to the agent...`)
              );
            } else {
              // Empty OTEL trace: ignore and continue listening
              clack.log.info(
                chalk.dim(`OTEL trace with 0 spans at ${req.url} - ignoring`)
              );
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          clack.log.error(
            chalk.red('Failed to parse request:') +
            '\n' +
            chalk.dim(`Error: ${error instanceof Error ? error.message : String(error)}`),
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
async function testIntegration(
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
    const feedback = buildFeedbackPrompt(receivedEvents, userFeedback as string, TEST_URL);

    // Run agent with feedback, resuming the previous session if we have a session ID
    if (sessionId) {
      const newSessionId = await runAgent(agentConfig, feedback, options, spinner, {
        spinnerMessage: `Analyzing feedback and fixing issues (attempt ${attemptNumber})...`,
        successMessage: `Agent completed fixes (attempt ${attemptNumber})`,
        errorMessage: 'Failed to process feedback',
        resume: sessionId,
      });
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

/**
 * Universal agent-powered wizard runner.
 * Handles the complete flow for any raindrop.ai integration.
 */
export async function runAgentWizard(
  config: FrameworkConfig,
  options: WizardOptions,
  additionalContext?: {
    otelProvider?: string;
    otelPlatform?: string;
  },
): Promise<void> {
  // Setup phase
  printWelcome({ wizardName: getWelcomeMessage(config.metadata.name) });

  clack.log.info(
    `🧙 The wizard has chosen you to try the next-generation agent integration for ${config.metadata.name}.\n\nStand by for the good stuff, and let the robot minders know how it goes:\n\nwizard@raindrop.ai`,
  );

  const aiConsent = await askForAIConsent(options);
  if (!aiConsent) {
    abort(
      `This wizard uses an LLM agent to intelligently modify your project. Please view the docs to set up raindrop.ai for your ${config.metadata.name} SDK manually instead: ${config.metadata.docsUrl}`,
      0,
    );
  }

  // Check if the current directory is a git repository and has uncommitted or untracked changes; prompt the user to continue if so.
  await confirmContinueIfNoOrDirtyGitRepo(options);

  // Framework detection and version (only for projects with package.json)
  let packageJson: any = {};
  const packageJsonPath = path.join(options.installDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJsonContent = await fs.promises.readFile(
        packageJsonPath,
        'utf-8',
      );
      packageJson = JSON.parse(packageJsonContent);
    } catch {
      // package.json exists but couldn't be read/parsed - continue without it
    }
  }

  const token = await askForWizardLogin({ signup: false });

  const apiKey = await getUserApiKey(token.access_token);

  await writeApiKeyToEnv(apiKey, options.installDir);

  clack.log.success('API key retrieved and saved to .env');

  const frameworkVersion = config.detection.getVersion(packageJson);

  // Build integration prompt
  const integrationPrompt = await buildIntegrationPrompt(config, {
    frameworkVersion: frameworkVersion || 'latest',
    otelProvider: additionalContext?.otelProvider || '',
    otelPlatform: additionalContext?.otelPlatform,
  });

  if (options.debug) {
    clack.log.info(`Integration prompt logged to: ${LOG_FILE_PATH}`);
    clack.log.info(`Prompt preview: ${integrationPrompt.substring(0, 200)}...`);
  }

  // Initialize and run agent
  const spinner = clack.spinner();

  const agent = initializeAgent(
    {
      workingDirectory: options.installDir,
    },
    options,
  );

  // Use try-finally to ensure cleanup always runs, even if setup or test fails
  try {
    // Run agent to do the integration
    const sessionId = await runAgent(agent, integrationPrompt, options, spinner, {
      estimatedDurationMinutes: config.ui.estimatedDurationMinutes,
      spinnerMessage: SPINNER_MESSAGE,
      successMessage: config.ui.successMessage,
      errorMessage: 'Integration failed',
    });

    // Run setup function if provided (e.g., add test endpoint)
    if (config.setup) {
      spinner.start('Configuring test environment...');
      try {
        await config.setup();
        spinner.stop('Test environment configured');
      } catch (error) {
        spinner.stop('Setup encountered issues (non-fatal)');
        logToFile('Setup error:', error);
        throw error; // Re-throw to trigger cleanup
      }
    }

    // Test loop: continue until user says it's good or max attempts
    // TODO: Enable test integration for vercelaisdk once implemented
    if (config.metadata.integration !== Integration.vercelAiSdk) {
      let currentSessionId = sessionId;
      let attemptNumber = 0;
      let shouldContinue = true;
      const MAX_ATTEMPTS = 3;

      while (shouldContinue && attemptNumber < MAX_ATTEMPTS) {
        attemptNumber++;

        const result = await testIntegration(
          agent,
          currentSessionId,
          config,
          options,
          spinner,
          attemptNumber,
        );

        currentSessionId = result.sessionId;
        shouldContinue = result.shouldRetry;
      }

      if (attemptNumber >= MAX_ATTEMPTS && shouldContinue) {
        clack.log.warn(
          chalk.yellow('Maximum test attempts (3) reached. Proceeding with current state.'),
        );
      }
    }
  } finally {
    // Run cleanup function if provided - this ALWAYS runs
    if (config.cleanup) {
      spinner.start('Cleaning up test configuration...');
      try {
        await config.cleanup();
        spinner.stop('Test configuration cleaned up');
      } catch (error) {
        spinner.stop('Cleanup encountered issues (non-fatal)');
        logToFile('Cleanup error:', error);
      }
    }
  }

  // Build outro message
  const changes = [...config.ui.getOutroChanges({})].filter(Boolean);

  const nextSteps = [...config.ui.getOutroNextSteps({})].filter(Boolean);

  const outroMessage = `
${chalk.green('Successfully installed raindrop.ai!')}

${chalk.cyan('What the agent did:')}
${changes.map((change) => `• ${change}`).join('\n')}

${chalk.yellow('Next steps:')}
${nextSteps.map((step) => `• ${step}`).join('\n')}

Learn more: ${chalk.cyan(config.metadata.docsUrl)}
${chalk.dim(
    'Note: This wizard uses an LLM agent to analyze and modify your project. Please review the changes made.',
  )}`;

  clack.outro(outroMessage);
}

/**
 * Build the integration prompt for the agent.
 * Uses shared base prompt with optional framework-specific documentation.
 */
async function buildIntegrationPrompt(
  config: FrameworkConfig,
  context: {
    frameworkVersion: string;
    otelProvider: string;
    otelPlatform?: string;
  },
): Promise<string> {
  let documentation = '';
  if (config.prompts.getDocumentation) {
    try {
      documentation = await config.prompts.getDocumentation({
        otelProvider: context.otelProvider,
        otelPlatform: context.otelPlatform,
      });
    } catch (error) {
      logToFile('Error loading documentation:', error);
      // Continue without documentation if loading fails
    }
  }

  const docsSection = documentation
    ? `\n\nInstallation documentation:\n${documentation}\n`
    : '';

  const otelProviderInfo =
    context.otelProvider === 'sentry'
      ? `- OTEL Provider: 'sentry'\nIntegrate raindrop.ai alongside Sentry. Ensure compatibility with existing Sentry configuration.`
      : context.otelProvider === 'other'
        ? `- OTEL Provider: 'other'\nIntegrate raindrop.ai alongside an existing OTEL provider other than Sentry. Ensure compatibility with the existing OTEL setup.`
        : '';

  return `Integrate raindrop.ai into this ${config.metadata.name} project that makes calls to the OpenAI API.

Project context:
- Framework: ${config.metadata.name} ${context.frameworkVersion}
${otelProviderInfo}

Instructions:

1. Install the raindrop.ai SDK package using the appropriate package manager for this project:
   - Detect the package manager by checking for lockfiles or configuration files (e.g., package-lock.json/yarn.lock/pnpm-lock.yaml for Node.js, requirements.txt/poetry.lock/Pipfile for Python, etc.)
   - Use the detected package manager to install the raindrop.ai SDK (e.g., npm/yarn/pnpm/bun for Node.js, pip/poetry/pipenv for Python)
   - Do not manually edit package.json, requirements.txt, or lockfiles - use the package manager commands instead

2. Integrate raindrop.ai where the project makes calls to the OpenAI API:
   - Find files that contain OpenAI API client initialization, API calls, or request handlers
   - Wrap or intercept OpenAI API calls with raindrop.ai to enable observability and tracing
   - This may involve modifying OpenAI client initialization, adding middleware, or wrapping API call functions
   - Generate a unique user ID for the integration (e.g., using UUID or a similar identifier generation method)

3. Initialize raindrop.ai with the appropriate configuration:
   - Set up raindrop.ai client initialization with API keys
   - Configure environment variables as needed
   - Ensure raindrop.ai is properly integrated to capture OpenAI API interactions

4. Follow best practices for ${config.metadata.name} and ensure the integration doesn't break existing functionality.

Focus on files where OpenAI API calls are made - these are the files that need to be modified to integrate raindrop.ai.${docsSection}`;
}

/**
 * Build feedback prompt for the agent based on test results and user feedback
 */
function buildFeedbackPrompt(eventData: any, userFeedback: string, testUrl: string): string {
  if (eventData && eventData.length > 0) {

    // Check if eventData is an array (multiple events) or a single event
    const events = Array.isArray(eventData) ? eventData : [eventData];

    // Detect format: OTEL protobuf (spans) vs JSON events
    const isOtelFormat = events.some((event) => event.format === 'otel');

    if (isOtelFormat) {
      // Handle OTLP protobuf trace verification (spans)
      return buildOtelTraceFeedbackPrompt(events, userFeedback, testUrl);
    } else {
      // Handle JSON raindrop.ai event verification
      return buildJsonEventFeedbackPrompt(events, userFeedback, testUrl);
    }
  } else {
    clack.log.warn(
      chalk.yellow('\nNo event received at the test server.') +
      '\n' +
      chalk.dim('The integration may not be working correctly.'),
    );

    return `Integration test result: No event was received at ${testUrl} when the user tested their app.

This suggests the integration is not working correctly. Please troubleshoot:
1. Check if the raindrop.ai SDK is properly initialized
2. Verify the endpoint URL is correctly configured (should be ${testUrl})
3. Check if the OpenAI API calls are being intercepted
4. Look for any error messages in the code or configuration
5. Ensure the app is actually making OpenAI API calls during the test

User feedback: ${userFeedback}

Fix any issues found and explain what was wrong.`;
  }
}

/**
 * Build feedback prompt for OTLP protobuf traces (spans)
 */
function buildOtelTraceFeedbackPrompt(events: any[], userFeedback: string, testUrl: string): string {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Analyze OTEL traces
  let totalSpans = 0;
  let aiSpans = 0;

  events.forEach((event) => {
    if (event.format === 'otel' && event.spans) {
      totalSpans += event.spans.length;

      // Check AI attributes
      event.aiAttributes?.forEach((aiAttr: any) => {
        if (aiAttr.model || aiAttr.genAiSystem || aiAttr.prompt) {
          aiSpans++;
        }
      });
    }
  });

  // Validation checks
  if (totalSpans === 0) {
    issues.push('No spans were found in the OTEL trace data');
  }

  if (aiSpans === 0 && totalSpans > 0) {
    warnings.push(`Found ${totalSpans} span(s) but none contain AI/LLM attributes (gen_ai.system, gen_ai.response.model, etc.). Make sure OpenAI API calls are being traced.`);
  }

  // Build verification message
  let verificationMessage = `Integration test result: OpenTelemetry trace data successfully received at ${testUrl}.

Trace summary:
- Total spans received: ${totalSpans}
- Spans with AI/LLM attributes: ${aiSpans}
- Format: OTLP (OpenTelemetry Protocol)

`;

  if (issues.length > 0) {
    verificationMessage += `\n❌ Issues detected:\n${issues.map(i => `  - ${i}`).join('\n')}\n`;
  }

  if (warnings.length > 0) {
    verificationMessage += `\n⚠️  Warnings:\n${warnings.map(w => `  - ${w}`).join('\n')}\n`;
  }

  if (aiSpans > 0) {
    verificationMessage += `\n✅ Success! The integration is working correctly.

Key AI/LLM attributes to verify:
- gen_ai.system: The AI system being used (e.g., "openai", "anthropic")
- gen_ai.response.model: The model name
- gen_ai.usage.input_tokens: Input token count
- gen_ai.usage.output_tokens: Output token count

Please verify that the trace data contains the expected information from your OpenAI API calls.`;
  } else if (totalSpans > 0) {
    verificationMessage += `\nPlease verify:
1. Are the OpenAI API calls being properly instrumented?
2. Is the OpenTelemetry instrumentation capturing gen_ai.* attributes?
3. Check the span attributes to ensure AI/LLM data is being recorded.

The integration may need adjustments to properly capture AI/LLM telemetry data.`;
  } else {
    verificationMessage += `\nThe integration needs debugging:
1. Verify that OpenTelemetry is properly initialized
2. Check that the exporter endpoint is correctly configured to ${testUrl}
3. Ensure OpenAI API calls are being instrumented
4. Look for any errors in the application logs`;
  }

  // Add user feedback
  verificationMessage += `\n\nUser feedback: ${userFeedback}`;

  return verificationMessage;
}

/**
 * Build feedback prompt for JSON raindrop.ai events
 */
function buildJsonEventFeedbackPrompt(events: any[], userFeedback: string, testUrl: string): string {
  // Verify required fields
  const requiredFields = ['input', 'output', 'model', 'convo_id', 'event_id', 'user_id'];
  const missingFields: string[] = [];
  const fieldIssues: string[] = [];

  // Check each event for required fields
  events.forEach((event, index) => {
    requiredFields.forEach((field) => {
      if (!(field in event) || event[field] === null || event[field] === undefined) {
        const issue = `Event ${index + 1}: Missing or null field '${field}'`;
        if (!missingFields.includes(issue)) {
          missingFields.push(issue);
        }
      }
    });
  });

  // Check for completion indicator (is_pending=False)
  const hasCompletionEvent = events.some(
    (event) => event.is_pending === false || event.is_pending === 'false'
  );

  if (!hasCompletionEvent && events.length > 0) {
    fieldIssues.push(
      `Found ${events.length} event(s) but no event with is_pending=False. This suggests the request likely didn't properly call interaction.finish().`
    );
  }

  // Build verification message
  let verificationMessage = `Integration test result: Event(s) were successfully received at ${testUrl}.

Event data received:
${JSON.stringify(events, null, 2)}

Please verify:`;

  if (missingFields.length > 0) {
    verificationMessage += `\n\n❌ Missing required fields:\n${missingFields.map(f => `  - ${f}`).join('\n')}`;
  }

  if (fieldIssues.length > 0) {
    verificationMessage += `\n\n⚠️  Issues detected:\n${fieldIssues.map(f => `  - ${f}`).join('\n')}`;
  }

  verificationMessage += `\n\nRequired fields to verify:
1. input - Should contain the input/prompt sent to the model
2. output - Should contain the model's response
3. model - Should specify which model was used
4. convo_id - Should be a unique conversation identifier
5. event_id - Should be a unique event identifier
6. user_id - Should identify the user making the request
7. is_pending - Should be False for completed interactions (indicates interaction.finish() was called)

${missingFields.length > 0 || fieldIssues.length > 0
      ? 'Please fix the integration code to ensure all required fields are present and interaction.finish() is properly called.'
      : 'If everything looks correct, respond with a brief confirmation.'}

User feedback: ${userFeedback}`;

  return verificationMessage;
}
