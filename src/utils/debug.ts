import Chalk from 'chalk';

// chalk v2 types don't work well with ESM default imports
const chalk = Chalk as any;
import { appendFileSync } from 'fs';
import { prepareMessage } from './logging.js';
import ui from './ui.js';

let debugEnabled = false;

export const LOG_FILE_PATH = '/tmp/raindrop-ai-wizard.log';

/**
 * Initialize the log file with a run header.
 * Call this at the start of each wizard run.
 */
export function initLogFile() {
  const header = `\n${'='.repeat(
    60,
  )}\nRaindrop Wizard Run: ${new Date().toISOString()}\n${'='.repeat(60)}\n`;
  appendFileSync(LOG_FILE_PATH, header);
}

/**
 * Log a message to the file at /tmp/raindrop-ai-wizard.log.
 * Always writes regardless of debug flag.
 */
export function logToFile(...args: unknown[]) {
  const timestamp = new Date().toISOString();
  const msg = args.map((a) => prepareMessage(a)).join(' ');
  appendFileSync(LOG_FILE_PATH, `[${timestamp}] ${msg}\n`);
}

export function debug(...args: unknown[]) {
  if (!debugEnabled) {
    return;
  }

  // Don't sanitize debug logs to ui - they're for development
  const msg = args
    .map((a) => {
      if (typeof a === 'string') {
        return a;
      }
      if (a instanceof Error) {
        return `${a.stack || ''}`;
      }
      return JSON.stringify(a, null, '\t');
    })
    .join(' ');

  ui.addItem({ type: 'response', text: chalk.dim(msg) });
}

export function enableDebugLogs() {
  debugEnabled = true;
}
