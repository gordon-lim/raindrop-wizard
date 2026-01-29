import * as childProcess from 'node:child_process';
import * as os from 'node:os';

import Chalk from 'chalk';

// chalk v2 types don't work well with ESM default imports
const chalk = Chalk as any;
import type { WizardOptions } from './types.js';
import type { Integration } from '../lib/constants.js';
import ui from './ui.js';
import { INTEGRATION_CONFIG } from '../lib/config.js';
import type { OAuthTokenResponse } from './oauth.js';
import { getUserInfo, performOAuthFlow } from './oauth.js';
import { debug } from './debug.js';

export function abort(message?: string, status?: number): never {
  ui.addItem({ type: 'outro', text: message ?? 'Wizard setup cancelled.' });
  return process.exit(status ?? 1);
}

export async function abortIfCancelled<T>(
  input: T | Promise<T>,
  integration?: Integration,
): Promise<Exclude<T, symbol>> {
  const resolvedInput = await input;

  if (
    ui.isCancel(resolvedInput) ||
    (typeof resolvedInput === 'symbol' &&
      resolvedInput.description === 'clack:cancel')
  ) {
    const docsUrl = integration
      ? INTEGRATION_CONFIG[integration].docsUrl
      : 'https://raindrop.com/docs';

    ui.addItem({
      type: 'cancel',
      text: `Wizard setup cancelled. You can read the documentation for ${
        integration ?? 'Raindrop'
      } at ${chalk.cyan(docsUrl)} to continue with the setup manually.`,
    });
    process.exit(0);
  } else {
    return input as Exclude<T, symbol>;
  }
}

export async function confirmContinueIfNoOrDirtyGitRepo(
  options: Pick<WizardOptions, 'default'>,
): Promise<void> {
  if (!isInGitRepo()) {
    const continueWithoutGit = options.default
      ? true
      : await abortIfCancelled(
          ui.select({
            message:
              'You are not inside a git repository. The wizard will create and update files. Do you want to continue anyway?',
            options: [
              { label: 'Yes', value: true },
              { label: 'No', value: false },
            ],
          }),
        );

    if (!continueWithoutGit) {
      abort(undefined, 0);
    }
    // return early to avoid checking for uncommitted files
    return;
  }

  const uncommittedOrUntrackedFiles = getUncommittedOrUntrackedFiles();
  if (uncommittedOrUntrackedFiles.length) {
    ui.addItem({
      type: 'warning',
      text: `You have uncommitted or untracked files in your repo:

${uncommittedOrUntrackedFiles.join('\n')}

The wizard will create and update files.`,
    });
    const continueWithDirtyRepo = await abortIfCancelled(
      ui.select({
        message: 'Do you want to continue anyway?',
        options: [
          { label: 'Yes', value: true },
          { label: 'No', value: false },
        ],
      }),
    );

    if (!continueWithDirtyRepo) {
      abort(undefined, 0);
    }
  }
}

export function isInGitRepo() {
  try {
    childProcess.execSync('git rev-parse --is-inside-work-tree', {
      stdio: 'ignore',
    });
    return true;
  } catch (error) {
    // Not in a git repo - this is expected in some cases
    debug(
      `Not in git repository: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return false;
  }
}

export function getUncommittedOrUntrackedFiles(): string[] {
  try {
    const gitStatus = childProcess
      .execSync('git status --porcelain=v1', {
        // we only care about stdout
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      .toString();

    const files = gitStatus
      .split(os.EOL)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((f) => `- ${f.split(/\s+/)[1]}`);

    return files;
  } catch (error) {
    // Error running git status - likely not in a git repo or git not available
    debug(
      `Failed to get git status: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return [];
  }
}

export async function askForAIConsent(options: Pick<WizardOptions, 'default'>) {
  const aiConsent = options.default
    ? true
    : await abortIfCancelled(
        ui.select({
          message: 'This setup wizard uses AI, are you happy to continue? ✨',
          options: [
            {
              label: 'Yes',
              value: true,
              hint: 'We will use AI to help you setup Raindrop quickly',
            },
            {
              label: 'No',
              value: false,
              hint: "I don't like AI",
            },
          ],
          initialValue: true,
        }),
      );

  return aiConsent;
}

export async function askForWizardLogin(options: {
  signup: boolean;
}): Promise<OAuthTokenResponse> {
  const tokenResponse = await performOAuthFlow({
    scopes: [
      'user:read',
      'project:read',
      'introspection',
      'llm_gateway:read',
      'dashboard:write',
      'insight:write',
    ],
    signup: options.signup,
  });

  return tokenResponse;
}

export async function validateProjectAccess(
  accessToken: string,
): Promise<void> {
  const userInfo = await getUserInfo(accessToken);
  const orgIds = Object.keys(userInfo.org_id_to_org_info || {});
  const projectId = orgIds[0];

  if (projectId === undefined) {
    const error = new Error(
      'No project access granted. Please authorize with project-level access.',
    );
    ui.addItem({ type: 'error', text: error.message });
    abort();
  }
}

/**
 * Wait for user to press any key
 */
export async function waitForUserKeyPress(): Promise<void> {
  return new Promise((resolve) => {
    const stdin = process.stdin;

    // Check if stdin is a TTY and can be set to raw mode
    if (!stdin.isTTY) {
      // If not a TTY, just resolve immediately (shouldn't happen in normal usage)
      resolve();
      return;
    }

    const wasRaw = stdin.isRaw;

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const onData = () => {
      stdin.setRawMode(wasRaw);
      stdin.pause();
      stdin.removeListener('data', onData);
      resolve();
    };

    stdin.once('data', onData);
  });
}
