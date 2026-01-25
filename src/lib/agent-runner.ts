import {
  SPINNER_MESSAGE,
  type FrameworkConfig,
} from './framework-config.js';
import type { WizardOptions } from '../utils/types.js';
import type { PackageJson } from '../utils/package-json-types.js';
import {
  abort,
  askForAIConsent,
  confirmContinueIfNoOrDirtyGitRepo,
} from '../utils/clack-utils.js';
import { writeApiKeyToEnv } from '../utils/environment.js';
import fs from 'fs';
import path from 'path';
import ui from '../utils/ui.js';
import { initializeAgent, runAgent } from './agent-interface.js';
import { logToFile, LOG_FILE_PATH, debug } from '../utils/debug.js';
import Chalk from 'chalk';

// chalk v2 types don't work well with ESM default imports
const chalk = Chalk as any;
import { askForWizardLogin } from '../utils/clack-utils.js';
import { getUserApiKey } from '../utils/oauth.js';
import { Integration } from './constants.js';
import { buildIntegrationPrompt } from './agent-prompts.js';
import { testIntegration } from './test-server.js';

/**
 * Universal agent-powered wizard runner.
 * Handles the complete flow for any raindrop.ai integration.
 */
export async function runAgentWizard(
  config: FrameworkConfig,
  options: WizardOptions,
): Promise<void> {
  // Setup phase
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
  let packageJson: PackageJson = {};
  const packageJsonPath = path.join(options.installDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJsonContent = await fs.promises.readFile(
        packageJsonPath,
        'utf-8',
      );
      packageJson = JSON.parse(packageJsonContent) as PackageJson;
    } catch (error) {
      // package.json exists but couldn't be read/parsed - continue without it
      logToFile(
        `Failed to read/parse package.json at ${packageJsonPath}:`,
        error,
      );
      debug(
        `Skipping package.json: ${error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  const token = await askForWizardLogin({ signup: false });

  const apiKey = await getUserApiKey(token.access_token);

  await writeApiKeyToEnv(apiKey, options.installDir);

  ui.addItem({ type: 'success', text: 'I retrieved your API key and saved it to .env' });

  const frameworkVersion = config.detection.getVersion(packageJson);

  // Build integration prompt
  const integrationPrompt = await buildIntegrationPrompt(config, {
    frameworkVersion: frameworkVersion || 'latest',
  });

  if (options.debug) {
    ui.addItem({ type: 'response', text: `Integration prompt logged to: ${LOG_FILE_PATH}` });
    ui.addItem({ type: 'response', text: `Prompt preview: ${integrationPrompt.substring(0, 200)}...` });
  }

  // Initialize and run agent
  const spinner = ui.spinner();

  const agent = initializeAgent(
    {
      workingDirectory: options.installDir,
    },
    options,
  );

  // Use try-finally to ensure cleanup always runs, even if setup or test fails
  try {

    // Add header to indicate start of interactive agent phase
    ui.addItem({ type: 'phase', text: '### Agent ###' });
    // Run agent to do the integration
    const agentResult = await runAgent(
      agent,
      integrationPrompt,
      options,
      spinner,
      {
        spinnerMessage: SPINNER_MESSAGE,
        successMessage: config.ui.successMessage,
        errorMessage: 'Integration failed',
        streamingInput: true, // Enable persistent text input for user interaction
      },
    );

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
      let currentSessionId = agentResult.sessionId;
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
        ui.addItem({
          type: 'warning',
          text: chalk.yellow(
            'Maximum test attempts (3) reached. Proceeding with current state.',
          ),
        });
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

  ui.addItem({ type: 'outro', text: outroMessage });
}
