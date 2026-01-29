import {
  abortIfCancelled,
  askForAIConsent,
  abort,
} from './utils/clack-utils.js';

import type {
  WizardOptions,
  OtelPlatform,
  OtelProvider,
} from './utils/types.js';

import { getIntegrationDescription, Integration } from './lib/constants.js';
import { readEnvironment } from './utils/environment.js';
import ui from './utils/ui.js';
import path from 'path';
import {
  INTEGRATION_CONFIG,
  INTEGRATION_ORDER,
  type SetupDetail,
} from './lib/config.js';
import { runPythonWizard } from './python/python-wizard.js';
import { runTypescriptWizard } from './typescript/typescript-wizard.js';
import { runVercelAiSdkWizard } from './vercelAiSdk/vercelAiSdk-wizard.js';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import Chalk from 'chalk';

// chalk v2 types don't work well with ESM default imports
const chalk = Chalk as any;

EventEmitter.defaultMaxListeners = 50;

/**
 * Compile setup details into a single string grouped by filename.
 */
function compileSetupDetails(details: SetupDetail[]): string {
  return details
    .map(({ filename, content }) => `=== ${filename} ===\n${content}`)
    .join('\n\n');
}

type Args = {
  integration?: Integration;
  debug?: boolean;
  forceInstall?: boolean;
  installDir?: string;
  default?: boolean;
};

async function handleTypescriptSetup(wizardOptions: WizardOptions) {
  const otelProvider = await abortIfCancelled(
    ui.select<OtelProvider>({
      message: 'Are you using Sentry, or another OTEL provider?',
      options: [
        {
          value: '',
          label: 'Raindrop built-in observability',
          hint: 'No OpenTelemetry provider needed.',
        },
        {
          value: 'sentry',
          label: 'Sentry',
          hint: 'Send OpenTelemetry data to Sentry.',
        },
        {
          value: 'other',
          label: 'Another OpenTelemetry provider',
          hint: 'Use any OTEL-compatible backend.',
        },
      ],
    }),
  );
  await runTypescriptWizard({ ...wizardOptions, otelProvider });
}

async function handleVercelAiSdkSetup(wizardOptions: WizardOptions) {
  const choice = await abortIfCancelled(
    ui.select({
      message: 'Which setup would you like?',
      options: [
        {
          value: 'otel',
          label: 'Auto tracking via OpenTelemetry',
          hint: 'no attachments, no custom properties',
        },
        {
          value: 'typescript',
          label: 'Custom setup with the Raindrop Typescript SDK',
          hint: 'attachments, custom properties',
        },
      ],
    }),
  );

  if (choice === 'otel') {
    const otelPlatform = await abortIfCancelled(
      ui.select<OtelPlatform>({
        message: 'How do you want OpenTelemetry setup?',
        options: [
          { value: 'next', label: 'Next.js' },
          { value: 'node', label: 'Node.js' },
          { value: 'cloudflare', label: 'Cloudflare Workers' },
          { value: 'sentry', label: 'Sentry (Next.js)' },
        ],
      }),
    );
    await runVercelAiSdkWizard({ ...wizardOptions, otelPlatform });
  } else {
    await handleTypescriptSetup(wizardOptions);
  }
}

export async function runWizard(argv: Args) {
  const finalArgs = {
    ...argv,
    ...readEnvironment(),
  };

  let resolvedInstallDir: string;
  if (finalArgs.installDir) {
    if (path.isAbsolute(finalArgs.installDir)) {
      resolvedInstallDir = finalArgs.installDir;
    } else {
      resolvedInstallDir = path.join(process.cwd(), finalArgs.installDir);
    }
  } else {
    resolvedInstallDir = process.cwd();
  }

  let wizardOptions: WizardOptions = {
    debug: finalArgs.debug ?? false,
    forceInstall: finalArgs.forceInstall ?? false,
    installDir: resolvedInstallDir,
    default: finalArgs.default ?? false,
    sessionId: randomUUID(),
    compiledSetup: '', // Will be set after collecting setup details
  };

  ui.addItem({
    type: 'phase',
    text: '### Setup ###',
  });

  ui.addItem({
    type: 'response',
    text: `✨ Welcome to the Raindrop wizard! I will help you set up Raindrop for your AI application. Thank you for using Raindrop! 💧`,
  });

  const aiConsent = await askForAIConsent(wizardOptions);
  if (!aiConsent) {
    abort(
      `This wizard uses a Claude agent to intelligently modify your project. Please view the docs to set up Raindrop manually instead: https://raindrop.ai/docs`,
      0,
    );
  }

  const integration =
    finalArgs.integration ?? (await getIntegrationForSetup(wizardOptions));

  const setupDetails = await INTEGRATION_CONFIG[
    integration
  ].collectSetupDetails(wizardOptions.installDir);
  const compiledSetup = compileSetupDetails(setupDetails);
  wizardOptions = { ...wizardOptions, compiledSetup };

  try {
    switch (integration) {
      case Integration.python:
        await runPythonWizard(wizardOptions);
        break;
      case Integration.typescript:
        await handleTypescriptSetup(wizardOptions);
        break;
      case Integration.vercelAiSdk:
        await handleVercelAiSdkSetup(wizardOptions);
        break;
      default:
        ui.addItem({ type: 'error', text: 'No setup wizard selected!' });
    }
  } catch (error) {
    const docsUrl =
      (INTEGRATION_CONFIG as Record<string, { docsUrl: string }>)[integration]
        ?.docsUrl || 'https://raindrop.ai/docs';
    ui.addItem({
      type: 'error',
      text: `Something went wrong. You can read the documentation at ${chalk.cyan(
        docsUrl,
      )} to set up Raindrop manually.`,
    });
    ui.addItem({ type: 'error', text: `error: ${String(error)}` });
    process.exit(1);
  }
}

async function detectIntegration(
  options: Pick<WizardOptions, 'installDir'>,
): Promise<Integration | undefined> {
  // Search in priority order defined in INTEGRATION_ORDER
  const integrationConfigs = Object.entries(INTEGRATION_CONFIG).sort(
    ([a], [b]) =>
      INTEGRATION_ORDER.indexOf(a as Integration) -
      INTEGRATION_ORDER.indexOf(b as Integration),
  );

  for (const [integration, config] of integrationConfigs) {
    const detected = await config.detect(options);
    if (detected) {
      return integration as Integration;
    }
  }
}

async function getIntegrationForSetup(
  options: Pick<WizardOptions, 'installDir'>,
) {
  const detectedIntegration = await detectIntegration(options);

  if (detectedIntegration) {
    const isCorrect = await abortIfCancelled(
      ui.select<boolean>({
        message: `I detected your AI app uses ${chalk.bgCyan.black(
          getIntegrationDescription(detectedIntegration),
        )} for its AI logic. Is this correct?`,
        options: [
          { value: true, label: 'Yes' },
          { value: false, label: 'No' },
        ],
      }),
    );

    if (isCorrect) {
      return detectedIntegration;
    }
  }

  const integration: Integration = await abortIfCancelled(
    ui.select({
      message: 'What does your AI app use for its AI logic?',
      options: [
        {
          value: Integration.python,
          label: 'a Python SDK',
          hint: 'e.g. openai-python, anthropic-sdk-python, langchain',
        },
        {
          value: Integration.typescript,
          label: 'a TypeScript SDK',
          hint: 'e.g. openai-node, langchain-js',
        },
        {
          value: Integration.vercelAiSdk,
          label: 'the Vercel AI SDK',
          hint: 'i.e. vercel/ai',
        },
      ],
    }),
  );

  return integration;
}
