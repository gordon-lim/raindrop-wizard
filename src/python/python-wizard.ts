import type { WizardOptions } from '../utils/types.js';
import type { FrameworkConfig } from '../lib/framework-config.js';
import { enableDebugLogs } from '../utils/debug.js';
import { runAgentWizard } from '../lib/agent-runner.js';
import { Integration, TEST_URL } from '../lib/constants.js';
import fs from 'fs';
import path from 'path';
import { addTestUrl, removeTestUrl } from '../utils/test-url.js';

/**
 * Python framework configuration for the universal agent runner.
 */
const PYTHON_AGENT_CONFIG: FrameworkConfig = {
  metadata: {
    name: 'Python',
    integration: Integration.python,
    docsUrl: 'https://www.raindrop.ai/docs/sdk/python',
  },

  detection: {
    getVersion: () => undefined, // TODO: Create a pip.ts to get the version of the pip package
  },

  prompts: {
    getDocumentation: async () => {
      try {
        // __dirname in compiled code is dist/src/python/, so go up to project root then to src/python/docs.md
        const docsPath = path.resolve(__dirname, '../../../src/python/docs.md');
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
      'Configure your API key in environment variables for deployment',
      'Start using raindrop.ai in your Python application',
    ],
  },

  setup: async () => {
    await addTestUrl({
      filePattern: '**/*.py',
      ignorePatterns: [
        'venv/**',
        '.venv/**',
        'env/**',
        '__pycache__/**',
        '*.pyc',
      ],
      searchPattern: 'raindrop.init(',
      searchRegex: /raindrop\.init\(/g,
      parameterName: 'api_url',
      testUrl: TEST_URL,
      style: 'function',
    });
  },

  cleanup: async () => {
    await removeTestUrl({
      filePattern: '**/*.py',
      ignorePatterns: [
        'venv/**',
        '.venv/**',
        'env/**',
        '__pycache__/**',
        '*.pyc',
      ],
      searchPattern: 'raindrop.init(',
      searchRegex: /raindrop\.init\(/g,
      parameterName: 'api_url',
      testUrl: TEST_URL,
      style: 'function',
    });
  },
};

/**
 * Python wizard powered by the universal agent runner.
 */
export async function runPythonWizard(options: WizardOptions): Promise<void> {
  if (options.debug) {
    enableDebugLogs();
  }

  await runAgentWizard(PYTHON_AGENT_CONFIG, options);
}
