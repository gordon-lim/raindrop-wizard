import type { WizardOptions } from '../utils/types';
import type { FrameworkConfig } from '../lib/framework-config';
import { enableDebugLogs } from '../utils/debug';
import { runAgentWizard } from '../lib/agent-runner';
import { Integration } from '../lib/constants';
import { getPackageVersion } from '../utils/package-json';
import fs from 'fs';
import path from 'path';

/**
 * TypeScript framework configuration for the universal agent runner.
 */
const TYPESCRIPT_AGENT_CONFIG: FrameworkConfig = {
  metadata: {
    name: 'TypeScript',
    integration: Integration.typescript,
    docsUrl: 'https://www.raindrop.ai/docs/sdk/typescript',
  },

  detection: {
    getVersion: (packageJson: any) =>
      getPackageVersion('raindrop-ai', packageJson),
  },

  prompts: {
    getDocumentation: async () => {
      try {
        // __dirname in compiled code is dist/src/typescript/, so go up to project root then to src/typescript/docs.md
        const docsPath = path.resolve(
          __dirname,
          '../../../src/typescript/docs.md',
        );
        return await fs.promises.readFile(docsPath, 'utf-8');
      } catch (error) {
        // If docs file can't be read, return empty string
        // eslint-disable-next-line no-console
        console.warn('Could not load documentation file:', error);
        return '';
      }
    },
  },

  ui: {
    successMessage: 'raindrop.ai integration complete',
    estimatedDurationMinutes: 8,
    getOutroChanges: () => [
      'Installed raindrop-ai package',
      'Initialized raindrop client with API key',
      'Set up environment variables for configuration',
    ],
    getOutroNextSteps: () => [
      'Configure your API key in environment variables',
      'Start using raindrop.ai in your TypeScript application',
    ],
  },
};

/**
 * TypeScript wizard powered by the universal agent runner.
 */
export async function runTypescriptWizard(
  options: WizardOptions,
): Promise<void> {
  if (options.debug) {
    enableDebugLogs();
  }

  await runAgentWizard(TYPESCRIPT_AGENT_CONFIG, options);
}
