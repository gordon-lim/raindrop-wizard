import type { WizardOptions } from '../utils/types';
import type { FrameworkConfig } from '../lib/framework-config';
import type { PackageJson } from '../utils/package-json-types';
import { enableDebugLogs } from '../utils/debug';
import { runAgentWizard } from '../lib/agent-runner';
import { Integration } from '../lib/constants';
import { getPackageVersion } from '../utils/package-json';
import fs from 'fs';
import path from 'path';
import clack from '../utils/ui';
import { abort } from '../utils/clack-utils';

/**
 * Vercel AI SDK framework configuration for the universal agent runner.
 */
const VERCEL_AI_SDK_AGENT_CONFIG: FrameworkConfig = {
  metadata: {
    name: 'Vercel AI SDK',
    integration: Integration.vercelAiSdk,
    docsUrl: 'https://www.raindrop.ai/docs/sdk/vercel-ai-sdk',
  },

  detection: {
    getVersion: (packageJson: PackageJson) =>
      getPackageVersion('raindrop-ai', packageJson),
  },

  prompts: {
    getDocumentation: async () => {
      try {
        // Ask about OTEL platform
        const otelPlatform = await clack.select({
          message: 'How do you want OpenTelemetry setup?',
          options: [
            {
              value: 'next',
              label: 'Next.js',
            },
            {
              value: 'node',
              label: 'Node.js',
            },
            {
              value: 'cloudflare',
              label: 'Cloudflare Workers',
            },
            {
              value: 'sentry',
              label: 'Sentry (Next.js)',
            },
          ],
        });

        if (clack.isCancel(otelPlatform)) {
          abort('Setup cancelled', 0);
        }

        // __dirname in compiled code is dist/src/vercelAiSdk/, so go up to project root then to src/vercelAiSdk/
        const baseDocsPath = path.resolve(
          __dirname,
          `../../../src/vercelAiSdk/docs.md`,
        );
        const baseDocs = await fs.promises.readFile(baseDocsPath, 'utf-8');

        // If no otel platform specified, just return base docs
        if (!otelPlatform) {
          return baseDocs;
        }

        // Load the platform-specific OTEL setup docs
        const otelDocsPath = path.resolve(
          __dirname,
          `../../../src/vercelAiSdk/otel-${otelPlatform}.md`,
        );
        const otelDocs = await fs.promises.readFile(otelDocsPath, 'utf-8');

        // Replace the {configure OTEL trace exporter} placeholder with the actual docs
        return baseDocs.replace('{configure OTEL trace exporter}', otelDocs);
      } catch (error) {
        // If docs file can't be read, return empty string
        // eslint-disable-next-line no-console
        console.warn('Could not load documentation file:', error);
        return '';
      }
    },
  },

  ui: {
    successMessage: 'raindrop.ai integration with Vercel AI SDK complete',
    estimatedDurationMinutes: 10,
    getOutroChanges: () => [
      'Installed raindrop-ai package',
      'Configured OpenTelemetry trace exporter',
      'Set up Vercel AI SDK telemetry instrumentation',
    ],
    getOutroNextSteps: () => [
      'Configure RAINDROP_WRITE_KEY in environment variables',
      'Enable telemetry in your AI SDK calls',
      'Add raindrop metadata to top-level user interactions',
    ],
  },
};

/**
 * Vercel AI SDK wizard powered by the universal agent runner.
 */
export async function runVercelAiSdkWizard(
  options: WizardOptions,
): Promise<void> {
  if (options.debug) {
    enableDebugLogs();
  }

  await runAgentWizard(VERCEL_AI_SDK_AGENT_CONFIG, options);
}
