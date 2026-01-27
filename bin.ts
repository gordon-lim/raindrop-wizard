#!/usr/bin/env node
import { satisfies } from 'semver';
import { red } from './src/utils/logging.js';

import yargs from 'yargs';
// @ts-expect-error - yargs/helpers types not available in ESM
import { hideBin } from 'yargs/helpers';

const NODE_VERSION_RANGE = '>=18.17.0';

// Node version check - must use console.log before Ink is initialized
if (!satisfies(process.version, NODE_VERSION_RANGE)) {
  red(
    `Raindrop wizard requires Node.js ${NODE_VERSION_RANGE}. You are using Node.js ${process.version}. Please upgrade your Node.js version.`,
  );
  process.exit(1);
}

import type { WizardOptions } from './src/utils/types.js';
import { runWizard } from './src/run.js';
import { isNonInteractiveEnvironment } from './src/utils/environment.js';
import ui, { initWizardUI } from './src/utils/ui.js';

yargs(hideBin(process.argv))
  .env('RAINDROP')
  // global options
  .options({
    debug: {
      default: false,
      describe: 'Enable verbose logging\nenv: RAINDROP_DEBUG',
      type: 'boolean',
    },
    default: {
      default: false,
      describe: 'Use default options for all prompts\nenv: RAINDROP_DEFAULT',
      type: 'boolean',
    },
    'api-key': {
      describe:
        'Raindrop personal API key (phx_xxx) for authentication\nenv: RAINDROP_WRITE_KEY',
      type: 'string',
    },
  })
  .command(
    ['$0'],
    'Run the Raindrop setup wizard',
    (yargs) => {
      return yargs.options({
        'force-install': {
          default: false,
          describe:
            'Force install packages even if peer dependency checks fail\nenv: RAINDROP_FORCE_INSTALL',
          type: 'boolean',
        },
        'install-dir': {
          describe:
            'Directory to install Raindrop in\nenv: RAINDROP_INSTALL_DIR',
          type: 'string',
        },
        integration: {
          describe: 'Integration to set up',
          choices: ['python', 'typescript'],
          type: 'string',
        },
      });
    },
    async (argv) => {
      const options = { ...argv };

      // Handle RAINDROP_WRITE_KEY env var (yargs expects RAINDROP_API_KEY)
      if (!options.apiKey && process.env.RAINDROP_WRITE_KEY) {
        options.apiKey = process.env.RAINDROP_WRITE_KEY;
      }

      // TTY check - must use console before Ink is initialized
      if (isNonInteractiveEnvironment()) {
        red(
          'Raindrop Wizard requires an interactive terminal (TTY) to run.\n' +
          'It appears you are running in a non-interactive environment.\n' +
          'Please run the wizard in an interactive terminal.',
        );
        process.exit(1);
      }

      // Initialize the unified Ink app (single render call)
      const wizardUI = await initWizardUI();

      // Display logo through Ink
      ui.addItem({ type: 'logo', text: '' });

      try {
        await runWizard(options as unknown as WizardOptions);
        process.exit(0);
      } catch (error) {
        ui.addItem({ type: 'error', text: `Error: ${error instanceof Error ? error.message : String(error)}` });
        wizardUI.unmount();
        process.exit(1);
      }

      // The wizard completes - unmount the UI
      wizardUI.unmount();
    },
  )
  .help()
  .alias('help', 'h')
  .version()
  .alias('version', 'v')
  .wrap(null).argv; // null = use terminal width automatically
