/**
 * Logger component for displaying colored console messages
 * Styled to match Claude Code's UI with colored dots and tree characters
 */

import chalk from 'chalk';
import type { LogFunctions } from '../types';

export const log: LogFunctions = {
  info: (msg: string) => {
    // eslint-disable-next-line no-console
    console.log(chalk.white('●') + ' ' + chalk.dim(msg));
  },
  warn: (msg: string) => {
    // eslint-disable-next-line no-console
    console.log(chalk.yellow('●') + ' ' + chalk.yellow(msg));
  },
  error: (msg: string) => {
    // eslint-disable-next-line no-console
    console.log(chalk.red('●') + ' ' + chalk.red(msg));
  },
  success: (msg: string) => {
    // eslint-disable-next-line no-console
    console.log(chalk.green('●') + ' ' + msg);
  },
  step: (msg: string) => {
    // eslint-disable-next-line no-console
    console.log(chalk.white('●') + ' ' + msg);
  },
};

/**
 * Helper functions for Claude Code style formatting
 */

/**
 * Display a task with result in Claude Code tree style
 * Example:
 *   ● Explore(Map clack usage patterns)
 *   └─ Done (18 tool uses · 45.3k tokens · 1m 13s)
 */
export function logTaskResult(taskName: string, details: string): void {
  // eslint-disable-next-line no-console
  console.log(chalk.green('●') + ' ' + chalk.green(taskName));
  // eslint-disable-next-line no-console
  console.log('  ' + chalk.dim('└─') + ' ' + chalk.dim(details));
}

/**
 * Display an indented result line (for tree structure)
 * Example: └─ Read 27 lines
 */
export function logResult(message: string): void {
  // eslint-disable-next-line no-console
  console.log('  ' + chalk.dim('└─') + ' ' + chalk.dim(message));
}

/**
 * Display a task name (no result yet)
 * Example: ● Read(tsconfig.json)
 */
export function logTask(taskName: string): void {
  // eslint-disable-next-line no-console
  console.log(chalk.green('●') + ' ' + chalk.green(taskName));
}
