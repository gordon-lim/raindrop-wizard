#!/usr/bin/env node
import { satisfies } from 'semver';
import { red } from './src/utils/logging';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';

const NODE_VERSION_RANGE = '>=18.17.0';

// Have to run this above the other imports because they are importing clack that
// has the problematic imports.
if (!satisfies(process.version, NODE_VERSION_RANGE)) {
  red(
    `Raindrop wizard requires Node.js ${NODE_VERSION_RANGE}. You are using Node.js ${process.version}. Please upgrade your Node.js version.`,
  );
  process.exit(1);
}

import type { WizardOptions } from './src/utils/types';
import { runWizard } from './src/run';
import { isNonInteractiveEnvironment } from './src/utils/environment';
import clack from './src/utils/clack';

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
    (argv) => {
      const options = { ...argv };

      // Handle RAINDROP_WRITE_KEY env var (yargs expects RAINDROP_API_KEY)
      if (!options.apiKey && process.env.RAINDROP_WRITE_KEY) {
        options.apiKey = process.env.RAINDROP_WRITE_KEY;
      }

      // TTY check
      if (isNonInteractiveEnvironment()) {
        clack.intro(chalk.inverse(`Raindrop Wizard`));
        clack.log.error(
          'This installer requires an interactive terminal (TTY) to run.\n' +
            'It appears you are running in a non-interactive environment.\n' +
            'Please run the wizard in an interactive terminal.',
        );
        process.exit(1);
      }

      void runWizard(options as unknown as WizardOptions);
    },
  )
  .help()
  .alias('help', 'h')
  .version()
  .alias('version', 'v')
  .wrap(process.stdout.isTTY ? yargs.terminalWidth() : 80).argv;
