/**
 * Message components for displaying styled intro/outro/note/cancel messages
 * Styled to match Claude Code's minimal UI
 */

import chalk from 'chalk';

export function intro(message: string): void {
  // Claude Code style - simple with colored dot
  // eslint-disable-next-line no-console
  console.log('\n' + chalk.white('●') + ' ' + message);
}

export function outro(message: string): void {
  // Claude Code style - simple output with tree character
  // eslint-disable-next-line no-console
  console.log(chalk.dim('└─') + ' ' + message + '\n');
}

export function note(message: string, title?: string): void {
  // Claude Code style - indented with tree characters
  const lines = message.split('\n');
  if (title) {
    // eslint-disable-next-line no-console
    console.log(chalk.dim('┌─') + ' ' + chalk.bold(title));
    lines.forEach((line, i) => {
      const prefix = i === lines.length - 1 ? '└─' : '├─';
      // eslint-disable-next-line no-console
      console.log(chalk.dim(prefix) + ' ' + chalk.dim(line));
    });
  } else {
    lines.forEach((line) => {
      // eslint-disable-next-line no-console
      console.log(chalk.dim('│ ') + chalk.dim(line));
    });
  }
}

export function cancel(message = 'Operation cancelled'): void {
  // eslint-disable-next-line no-console
  console.log(chalk.red('●') + ' ' + chalk.red(message));
}
