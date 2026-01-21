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
} from '../utils/clack-utils';
import { writeApiKeyToEnv } from '../utils/environment';
import fs from 'fs';
import path from 'path';
import clack from '../utils/clack';
import { initializeAgent, runAgent } from './agent-interface';
import { logToFile, LOG_FILE_PATH } from '../utils/debug';
import chalk from 'chalk';
import { askForWizardLogin } from '../utils/clack-utils';
import { getUserApiKey } from '../utils/oauth';
import axios from 'axios';
import { API_BASE_URL } from './constants';

/**
 * Poll the events endpoint to check if integration is successful
 */
async function pollForEvents(
  accessToken: string,
  onEventsFound: () => void,
): Promise<void> {
  const eventsUrl = `${API_BASE_URL}/api/cli/events/list`;
  const pollInterval = 2000; // Poll every 2 seconds

  while (true) {
    try {
      const response = await axios.get(eventsUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // Check if there are any events
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        onEventsFound();
        break;
      }
    } catch (error) {
      // Silently continue polling on errors
      if (axios.isAxiosError(error)) {
        logToFile('Error polling events:', error.response?.data || error.message);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }
}

/**
 * Wait for user to press any key
 */
async function waitForUserKeyPress(): Promise<void> {
  return new Promise((resolve) => {
    const stdin = process.stdin;

    // Check if stdin is a TTY and can be set to raw mode
    if (!stdin.isTTY) {
      // If not a TTY, just resolve immediately (shouldn't happen in normal usage)
      resolve();
      return;
    }

    const wasRaw = stdin.isRaw;

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const onData = () => {
      stdin.setRawMode(wasRaw);
      stdin.pause();
      stdin.removeListener('data', onData);
      resolve();
    };

    stdin.once('data', onData);
  });
}

/**
 * Test the integration by waiting for events
 */
async function testIntegration(accessToken: string): Promise<boolean> {
  clack.log.step(
    chalk.cyan('\nTest your integration:') +
    '\n' +
    chalk.dim('Send an event through your app (e.g., make an OpenAI API call).') +
    '\n' +
    chalk.dim('Press any key when done to continue...'),
  );

  let eventsFound = false;
  let userPressedKey = false;

  // Start polling for events
  const pollPromise = pollForEvents(accessToken, () => {
    eventsFound = true;
  });

  // Wait for user keypress
  const keyPressPromise = waitForUserKeyPress().then(() => {
    userPressedKey = true;
  });

  // Race between polling finding events and user pressing a key
  await Promise.race([pollPromise, keyPressPromise]);

  // If events were found, we're done
  if (eventsFound) {
    return true;
  }

  // If user pressed key but no events found, check one last time
  if (userPressedKey) {
    try {
      const eventsUrl = `${API_BASE_URL}/api/cli/events/list`;
      const response = await axios.get(eventsUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        return true;
      }
    } catch (error) {
      logToFile('Error checking events:', error);
    }

    return false;
  }

  return false;
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
    otelProvider: additionalContext?.otelProvider || 'standalone',
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

  await runAgent(agent, integrationPrompt, options, spinner, {
    estimatedDurationMinutes: config.ui.estimatedDurationMinutes,
    spinnerMessage: SPINNER_MESSAGE,
    successMessage: config.ui.successMessage,
    errorMessage: 'Integration failed',
  });

  // Test the integration
  const integrationSuccess = await testIntegration(token.access_token);

  if (!integrationSuccess) {
    clack.log.error(
      chalk.red('\nIntegration test failed: No events detected.') +
      '\n' +
      chalk.dim('Make sure your app is running and making OpenAI API calls.'),
    );
    abort('Integration test failed', 1);
  }

  clack.log.success(chalk.green('Integration test successful! Events detected.'));

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
  },
): Promise<string> {
  let documentation = '';
  if (config.prompts.getDocumentation) {
    try {
      documentation = await config.prompts.getDocumentation({
        otelProvider: context.otelProvider,
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
