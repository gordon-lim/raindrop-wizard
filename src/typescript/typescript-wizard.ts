import type { WizardOptions } from '../utils/types';
import type { FrameworkConfig } from '../lib/framework-config';
import type { PackageJson } from '../utils/package-json-types';
import { enableDebugLogs } from '../utils/debug';
import { runAgentWizard } from '../lib/agent-runner';
import { Integration, TEST_URL } from '../lib/constants';
import { getPackageVersion } from '../utils/package-json';
import fs from 'fs';
import path from 'path';
import clack from '../utils/clack';
import { abort } from '../utils/clack-utils';
import { addTestUrl, removeTestUrl } from '../utils/test-url';

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
    getDocumentation: async () => {
      try {
        // Ask about OTEL provider
        const otelProvider = await clack.select({
          message: 'Using Sentry/Datadog/other OTEL provider?',
          options: [
            {
              value: '',
              label: 'No - standalone',
              hint: 'Use raindrop.ai only',
            },
            {
              value: 'sentry',
              label: 'Yes - Sentry',
              hint: 'Integrate with Sentry',
            },
            {
              value: 'other',
              label: 'Other OTEL',
              hint: 'Use another OTEL provider',
            },
          ],
        });

        if (clack.isCancel(otelProvider)) {
          abort('Setup cancelled', 0);
        }

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
        let otelDocs = await fs.promises.readFile(otelDocsPath, 'utf-8');

        // Template replacement for otel docs
        otelDocs = otelDocs.replace(/\{\{TEST_URL\}\}/g, TEST_URL);

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
    successMessage: 'raindrop.ai integration complete',
    estimatedDurationMinutes: 8,
    getOutroChanges: () => [
      'Installed raindrop-ai package',
      'Initialized raindrop client with API key',
      'Set up environment variables for configuration',
    ],
    getOutroNextSteps: () => [
      'Configure your API key in environment variables for deployment',
      'Start using raindrop.ai in your TypeScript application',
    ],
  },

  setup: async () => {
    await addTestUrl({
      filePattern: '**/*.{ts,tsx,js,jsx}',
      ignorePatterns: ['node_modules/**', 'dist/**', '.next/**', 'build/**'],
      searchPattern: 'new Raindrop({',
      searchRegex: /new\s+Raindrop\s*\(\s*\{/g,
      parameterName: 'endpoint',
      testUrl: TEST_URL,
      style: 'object',
    });
  },

  cleanup: async () => {
    await removeTestUrl({
      filePattern: '**/*.{ts,tsx,js,jsx}',
      ignorePatterns: ['node_modules/**', 'dist/**', '.next/**', 'build/**'],
      searchPattern: 'new Raindrop({',
      searchRegex: /new\s+Raindrop\s*\(\s*\{/g,
      parameterName: 'endpoint',
      testUrl: TEST_URL,
      style: 'object',
    });
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
