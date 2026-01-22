import type { WizardOptions } from '../utils/types';
import type { FrameworkConfig } from '../lib/framework-config';
import { enableDebugLogs } from '../utils/debug';
import { runAgentWizard } from '../lib/agent-runner';
import { Integration, TEST_URL } from '../lib/constants';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

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
    getDocumentation: async (context) => {
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
      'Configure your API key in environment variables',
      'Start using raindrop.ai in your Python application',
    ],
  },

  setup: async () => {
    // Add test api_url to raindrop.init() for testing
    const files = await glob('**/*.py', {
      ignore: ['venv/**', '.venv/**', 'env/**', '__pycache__/**', '*.pyc'],
      absolute: true,
    });

    for (const file of files) {
      try {
        let content = await fs.promises.readFile(file, 'utf-8');

        // Check if file contains raindrop.init( without api_url already
        if (content.includes('raindrop.init(') && !content.includes('api_url')) {
          // Find and replace raindrop.init() calls with proper parentheses matching
          const pattern = /raindrop\.init\(/g;
          let match;
          const replacements: Array<{ start: number; end: number; replacement: string }> = [];

          while ((match = pattern.exec(content)) !== null) {
            const startPos = match.index;
            const openParenPos = startPos + 'raindrop.init'.length;

            // Find matching closing parenthesis by counting depth
            let depth = 0;
            let endPos = openParenPos;
            let inString = false;
            let stringChar = '';

            for (let i = openParenPos; i < content.length; i++) {
              const char = content[i];
              const prevChar = i > 0 ? content[i - 1] : '';

              // Track string state to ignore parentheses in strings
              if ((char === '"' || char === "'") && prevChar !== '\\') {
                if (!inString) {
                  inString = true;
                  stringChar = char;
                } else if (char === stringChar) {
                  inString = false;
                  stringChar = '';
                }
              }

              // Count parentheses when not in string
              if (!inString) {
                if (char === '(') depth++;
                if (char === ')') {
                  depth--;
                  if (depth === 0) {
                    endPos = i;
                    break;
                  }
                }
              }
            }

            if (depth === 0 && endPos > openParenPos) {
              // Extract inner content
              const innerContent = content.slice(openParenPos + 1, endPos);

              // Check if we need a comma
              const trimmed = innerContent.trim();
              const needsComma = trimmed.length > 0 && !trimmed.endsWith(',');
              const comma = needsComma ? ', ' : '';

              // Build replacement
              const replacement = `raindrop.init(${innerContent}${comma}\n            api_url="${TEST_URL}")`;

              replacements.push({
                start: startPos,
                end: endPos + 1,
                replacement,
              });
            }
          }

          // Apply replacements in reverse order to maintain positions
          if (replacements.length > 0) {
            replacements.reverse();
            for (const { start, end, replacement } of replacements) {
              content = content.slice(0, start) + replacement + content.slice(end);
            }
            await fs.promises.writeFile(file, content, 'utf-8');
          }
        }
      } catch (error) {
        // Skip files that can't be read/written
        continue;
      }
    }
  },

  cleanup: async () => {
    // Remove test api_url from raindrop.init()
    const files = await glob('**/*.py', {
      ignore: ['venv/**', '.venv/**', 'env/**', '__pycache__/**', '*.pyc'],
      absolute: true,
    });

    for (const file of files) {
      try {
        let content = await fs.promises.readFile(file, 'utf-8');

        // Check if file contains raindrop.init( with api_url
        if (content.includes('raindrop.init(') && content.includes('api_url')) {
          // Remove api_url parameter - handle both single and double quotes with escaped quotes
          // Matches: api_url="..." or api_url='...' with proper escape handling
          content = content.replace(
            /,?\s*api_url\s*=\s*(["'])(?:(?!\1).|\\.)*?\1\s*,?/g,
            ''
          );

          // Clean up any double commas or trailing commas before closing paren
          content = content.replace(/,\s*,/g, ',');
          content = content.replace(/,(\s*)\)/g, '$1)');

          // Clean up leading commas after opening paren
          content = content.replace(/\(\s*,/g, '(');

          await fs.promises.writeFile(file, content, 'utf-8');
        }
      } catch (error) {
        // Skip files that can't be read/written
        continue;
      }
    }
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
