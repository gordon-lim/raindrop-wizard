import { abortIfCancelled } from './utils/clack-utils';

import type { WizardOptions } from './utils/types';

import { getIntegrationDescription, Integration } from './lib/constants';
import { readEnvironment } from './utils/environment';
import clack from './utils/clack';
import path from 'path';
import { INTEGRATION_CONFIG, INTEGRATION_ORDER } from './lib/config';
import { runPythonWizard } from './python/python-wizard';
import { runTypescriptWizard } from './typescript/typescript-wizard';
import { runVercelAiSdkWizard } from './vercelAiSdk/vercelAiSdk-wizard';
import { EventEmitter } from 'events';
import chalk from 'chalk';

EventEmitter.defaultMaxListeners = 50;

type Args = {
  integration?: Integration;
  debug?: boolean;
  forceInstall?: boolean;
  installDir?: string;
  default?: boolean;
  apiKey?: string;
};

async function handleVercelAiSdkSetup(wizardOptions: WizardOptions) {
  const choice = await abortIfCancelled(
    clack.select({
      message: 'Which setup would you like?',
      options: [
        {
          value: 'otel',
          label: "Vercel AI SDK' OTel integration",
          hint: 'no attachments, no custom properties',
        },
        {
          value: 'typescript',
          label: 'raindrop.ai Typescript SDK',
          hint: 'attachments, custom properties',
        },
      ],
    }),
  );

  if (choice === 'otel') {
    await runVercelAiSdkWizard(wizardOptions);
  } else {
    await runTypescriptWizard(wizardOptions);
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

  const wizardOptions: WizardOptions = {
    debug: finalArgs.debug ?? false,
    forceInstall: finalArgs.forceInstall ?? false,
    installDir: resolvedInstallDir,
    default: finalArgs.default ?? false,
    apiKey: finalArgs.apiKey,
  };

  clack.intro(`Welcome to the raindrop.ai setup wizard ✨`);

  const integration =
    finalArgs.integration ?? (await getIntegrationForSetup(wizardOptions));

  try {
    switch (integration) {
      case Integration.python:
        await runPythonWizard(wizardOptions);
        break;
      case Integration.typescript:
        await runTypescriptWizard(wizardOptions);
        break;
      case Integration.vercelAiSdk:
        await handleVercelAiSdkSetup(wizardOptions);
        break;
      default:
        clack.log.error('No setup wizard selected!');
    }
  } catch (error) {
    const docsUrl =
      (INTEGRATION_CONFIG as Record<string, { docsUrl: string }>)[integration]
        ?.docsUrl || 'https://raindrop.ai/docs';
    clack.log.error(
      `Something went wrong. You can read the documentation at ${chalk.cyan(
        docsUrl,
      )} to set up raindrop.ai manually.`,
    );
    clack.log.error(`error: ${String(error)}`);
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
    clack.log.success(
      `Detected integration: ${getIntegrationDescription(detectedIntegration)}`,
    );
    return detectedIntegration;
  }

  const integration: Integration = await abortIfCancelled(
    clack.select({
      message: 'What do you want to set up?',
      options: [
        { value: Integration.python, label: 'Python' },
        { value: Integration.typescript, label: 'TypeScript' },
        { value: Integration.vercelAiSdk, label: 'Vercel AI SDK' },
      ],
    }),
  );

  return integration;
}
