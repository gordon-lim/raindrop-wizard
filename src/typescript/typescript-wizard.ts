import type { WizardOptions } from '../utils/types';
import type { FrameworkConfig } from '../lib/framework-config';
import { enableDebugLogs } from '../utils/debug';
import { runAgentWizard } from '../lib/agent-runner';
import { Integration, TEST_URL } from '../lib/constants';
import { getPackageVersion } from '../utils/package-json';
import fs from 'fs';
import path from 'path';
import clack from '../utils/clack';
import { abort } from '../utils/clack-utils';
import { glob } from 'glob';

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
    getDocumentation: async (context) => {
      try {
        const otelProvider = context?.otelProvider || '';
        // __dirname in compiled code is dist/src/typescript/, so go up to project root then to src/typescript/
        const baseDocsPath = path.resolve(
          __dirname,
          `../../../src/typescript/docs.md`,
        );
        let baseDocs = await fs.promises.readFile(baseDocsPath, 'utf-8');

        // Template replacement
        baseDocs = baseDocs.replace(/\{\{TEST_URL\}\}/g, TEST_URL);

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
    // Add test endpoint to Raindrop initialization for testing
    const files = await glob('**/*.{ts,tsx,js,jsx}', {
      ignore: ['node_modules/**', 'dist/**', '.next/**', 'build/**'],
      absolute: true,
    });

    for (const file of files) {
      try {
        let content = await fs.promises.readFile(file, 'utf-8');

        // Check if file contains new Raindrop({ without endpoint already
        if (content.includes('new Raindrop({') && !content.includes('endpoint:')) {
          // Find and replace Raindrop initialization with proper brace matching
          const pattern = /new\s+Raindrop\s*\(\s*\{/g;
          let match;
          const replacements: Array<{ start: number; end: number; replacement: string }> = [];

          while ((match = pattern.exec(content)) !== null) {
            const startPos = match.index;
            const openBracePos = content.indexOf('{', startPos);

            // Find matching closing brace by counting depth
            let braceDepth = 0;
            let endBracePos = -1;
            let inString = false;
            let stringChar = '';

            for (let i = openBracePos; i < content.length; i++) {
              const char = content[i];
              const prevChar = i > 0 ? content[i - 1] : '';

              // Track string state (single, double, or template literal)
              if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
                if (!inString) {
                  inString = true;
                  stringChar = char;
                } else if (char === stringChar) {
                  inString = false;
                  stringChar = '';
                }
              }

              // Count braces when not in string
              if (!inString) {
                if (char === '{') {
                  braceDepth++;
                }
                if (char === '}') {
                  braceDepth--;
                  if (braceDepth === 0) {
                    endBracePos = i;
                    break;
                  }
                }
              }
            }

            // After finding closing brace, verify next non-whitespace char is ')'
            let endParenPos = -1;
            if (endBracePos !== -1) {
              for (let i = endBracePos + 1; i < content.length; i++) {
                const char = content[i];
                if (char === ')') {
                  endParenPos = i;
                  break;
                }
                // If we hit a non-whitespace character that's not ')', this isn't the pattern we want
                if (!/\s/.test(char)) {
                  break;
                }
              }
            }

            if (endBracePos !== -1 && endParenPos !== -1) {
              // Extract inner content (between braces)
              const innerContent = content.slice(openBracePos + 1, endBracePos);

              // Check if we need a comma
              const trimmed = innerContent.trim();
              const needsComma = trimmed.length > 0 && !trimmed.endsWith(',');
              const comma = needsComma ? ',' : '';

              // Build replacement
              const replacement = `new Raindrop({${innerContent}${comma}\n  endpoint: "${TEST_URL}"\n})`;

              replacements.push({
                start: startPos,
                end: endParenPos + 1,
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
    // Remove test endpoint from Raindrop initialization
    const files = await glob('**/*.{ts,tsx,js,jsx}', {
      ignore: ['node_modules/**', 'dist/**', '.next/**', 'build/**'],
      absolute: true,
    });

    for (const file of files) {
      try {
        let content = await fs.promises.readFile(file, 'utf-8');

        // Check if file contains new Raindrop({ with endpoint
        if (content.includes('new Raindrop({') && content.includes('endpoint:')) {
          // Remove endpoint property - handle both single and double quotes with escaped quotes
          // Also handle template literals
          content = content.replace(
            /,?\s*endpoint:\s*(?:(["'`])(?:(?!\1).|\\.)*?\1|[^,}\s]+)\s*,?/g,
            ''
          );

          // Clean up any double commas or trailing commas before closing brace
          content = content.replace(/,\s*,/g, ',');
          content = content.replace(/,(\s*)\}/g, '$1}');

          // Clean up leading commas after opening brace
          content = content.replace(/\{\s*,/g, '{');

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
 * TypeScript wizard powered by the universal agent runner.
 */
export async function runTypescriptWizard(
  options: WizardOptions,
): Promise<void> {
  if (options.debug) {
    enableDebugLogs();
  }

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

  await runAgentWizard(TYPESCRIPT_AGENT_CONFIG, options, {
    otelProvider: otelProvider as string,
  });
}
