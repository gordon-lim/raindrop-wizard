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
import { initializeAgent, runAgentLoop } from './agent-interface.js';
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
 * Handles the complete flow for any Raindrop integration.
 */
export async function runAgentWizard(
  config: FrameworkConfig,
  options: WizardOptions,
): Promise<void> {
  // Setup phase
  const aiConsent = await askForAIConsent(options);
  if (!aiConsent) {
    abort(
      `This wizard uses an LLM agent to intelligently modify your project. Please view the docs to set up Raindrop for your ${config.metadata.name} SDK manually instead: ${config.metadata.docsUrl}`,
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

  // Initialize agent
  const agent = initializeAgent(
    {
      workingDirectory: options.installDir,
    },
    options,
  );

  // Unified loop: run agent, then test, repeat if user provides feedback
  // TODO: Enable test integration for vercelaisdk once implemented
  let prompt = integrationPrompt;
  // let prompt = "First, write a plan to write a hello world script to a plan file then call the ExitPlanMode tool.";
  let resume: string | undefined = undefined;
  let shouldContinue = true;

  while (shouldContinue) {
    const agentResult = await runAgentLoop(
      agent,
      prompt,
      options,
      {
        spinnerMessage: SPINNER_MESSAGE,
        successMessage: config.ui.successMessage,
        resume,
      },
    );

    // Skip testing for vercelAiSdk (not yet implemented)
    if (config.metadata.integration === Integration.vercelAiSdk) {
      break;
    }

    const result = await testIntegration(options, token.access_token);

    if (result.shouldRetry && result.feedbackPrompt) {
      prompt = result.feedbackPrompt;
      resume = agentResult.sessionId;
    } else {
      shouldContinue = false;
    }
  }

  // Build outro message
  const nextSteps = [...config.ui.getOutroNextSteps({})].filter(Boolean);

  const outroMessage = `${chalk.white('Raindrop successfully integrated')}

${chalk.yellow('Next steps:')}
${nextSteps.map((step) => `• ${step}`).join('\n')}

Learn more: ${chalk.cyan(config.metadata.docsUrl)}
${chalk.dim(
    'Note: This wizard uses an LLM agent to analyze and modify your project. Please review the changes made.',
  )}`;

  ui.addItem({ type: 'success', text: outroMessage });
}
