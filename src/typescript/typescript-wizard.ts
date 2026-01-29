import type { WizardOptions } from '../utils/types.js';
import type { FrameworkConfig } from '../lib/framework-config.js';
import type { PackageJson } from '../utils/package-json-types.js';
import { enableDebugLogs } from '../utils/debug.js';
import { runAgentWizard } from '../lib/agent-runner.js';
import { Integration } from '../lib/constants.js';
import { getPackageVersion } from '../utils/package-json.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    getVersion: (packageJson: PackageJson) =>
      getPackageVersion('raindrop-ai', packageJson),
  },

  prompts: {
    getDocumentation: async (options) => {
      try {
        const { otelProvider } = options;

        // __dirname in compiled code is dist/src/typescript/, so go up to project root then to src/typescript/
        const baseDocsPath = path.resolve(
          __dirname,
          `../../../src/typescript/docs.md`,
        );
        const baseDocs = await fs.promises.readFile(baseDocsPath, 'utf-8');

        // If no otel provider, just return base docs
        if (!otelProvider) {
          return baseDocs;
        }

        // For sentry or other, combine base docs with otel-specific docs
        const otelDocsPath = path.resolve(
          __dirname,
          `../../../src/typescript/otel-${otelProvider}.md`,
        );
        const otelDocs = await fs.promises.readFile(otelDocsPath, 'utf-8');

        return `${baseDocs}\n\n${otelDocs}`;
      } catch (error) {
        // If docs file can't be read, return empty string
        // eslint-disable-next-line no-console
        console.warn('Could not load documentation file:', error);
        return '';
      }
    },
  },

  ui: {
    successMessage: 'Raindrop integration complete',
    getOutroNextSteps: () => [
      'Configure your API key in environment variables for deployment',
      'Start using Raindrop in your TypeScript application',
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
