import * as childProcess from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import chalk from 'chalk';
import { traceStep } from '../telemetry';
import type { WizardOptions } from './types';
import type { Integration } from '../lib/constants';
import clack from './clack';
import { INTEGRATION_CONFIG } from '../lib/config';
import type { OAuthTokenResponse, OAuthUserInfo } from './oauth';
import { getUserInfo, performOAuthFlow } from './oauth';

export function abort(message?: string, status?: number): never {
  clack.outro(message ?? 'Wizard setup cancelled.');
  return process.exit(status ?? 1);
}

export async function abortIfCancelled<T>(
  input: T | Promise<T>,
  integration?: Integration,
): Promise<Exclude<T, symbol>> {
  const resolvedInput = await input;

  if (
    clack.isCancel(resolvedInput) ||
    (typeof resolvedInput === 'symbol' &&
      resolvedInput.description === 'clack:cancel')
  ) {
    const docsUrl = integration
      ? INTEGRATION_CONFIG[integration].docsUrl
      : 'https://raindrop.com/docs';

    clack.cancel(
      `Wizard setup cancelled. You can read the documentation for ${integration ?? 'Raindrop'
      } at ${chalk.cyan(docsUrl)} to continue with the setup manually.`,
    );
    process.exit(0);
  } else {
    return input as Exclude<T, symbol>;
  }
}

export function printWelcome(options: {
  wizardName: string;
  message?: string;
}): void {
  // eslint-disable-next-line no-console
  console.log('');
  clack.intro(chalk.inverse(` ${options.wizardName} `));

  const welcomeText =
    options.message ||
    `The ${options.wizardName} will help you set up Raindrop for your Agent application.\nThank you for using Raindrop :)`;

  clack.note(welcomeText);
}

export async function confirmContinueIfNoOrDirtyGitRepo(
  options: Pick<WizardOptions, 'default'>,
): Promise<void> {
  return traceStep('check-git-status', async () => {
    if (!isInGitRepo()) {
      const continueWithoutGit = options.default
        ? true
        : await abortIfCancelled(
          clack.confirm({
            message:
              'You are not inside a git repository. The wizard will create and update files. Do you want to continue anyway?',
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
      clack.log.warn(
        `You have uncommitted or untracked files in your repo:

${uncommittedOrUntrackedFiles.join('\n')}

The wizard will create and update files.`,
      );
      const continueWithDirtyRepo = await abortIfCancelled(
        clack.confirm({
          message: 'Do you want to continue anyway?',
        }),
      );

      if (!continueWithDirtyRepo) {
        abort(undefined, 0);
      }
    }
  });
}

export function isInGitRepo() {
  try {
    childProcess.execSync('git rev-parse --is-inside-work-tree', {
      stdio: 'ignore',
    });
    return true;
  } catch {
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
  } catch {
    return [];
  }
}

export async function askForAIConsent(options: Pick<WizardOptions, 'default'>) {
  return await traceStep('ask-for-ai-consent', async () => {
    const aiConsent = options.default
      ? true
      : await abortIfCancelled(
        clack.select({
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
  });
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

  const userInfo = await getUserInfo(tokenResponse.access_token);
  const orgIds = Object.keys(userInfo.org_id_to_org_info || {});
  const projectId = orgIds[0];

  if (projectId === undefined) {
    const error = new Error(
      'No project access granted. Please authorize with project-level access.',
    );
    clack.log.error(error.message);
    await abort();
  }


  clack.log.success(
    `Login complete. ${options.signup ? 'Welcome to Raindrop! 🎉' : ''}`,
  );

  return tokenResponse;
}