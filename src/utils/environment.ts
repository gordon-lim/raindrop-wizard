import readEnv from 'read-env';
import type { WizardOptions } from './types';
import fg from 'fast-glob';
import { IS_DEV } from '../lib/constants';
import fs from 'fs';
import path from 'path';

export function isNonInteractiveEnvironment(): boolean {
  if (IS_DEV) {
    return false;
  }

  if (!process.stdout.isTTY || !process.stderr.isTTY) {
    return true;
  }

  return false;
}

export function readEnvironment(): Record<string, unknown> {
  const result = readEnv('RAINDROP');

  return result;
}

export async function detectEnvVarPrefix(
  options: WizardOptions,
): Promise<string> {
  let deps: Record<string, string> = {};
  const packageJsonPath = path.join(options.installDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJsonContent = await fs.promises.readFile(
        packageJsonPath,
        'utf-8',
      );
      const packageJson = JSON.parse(packageJsonContent);
      deps = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {}),
      };
    } catch {
      // package.json exists but couldn't be read/parsed - continue without deps
    }
  }

  const has = (name: string) => name in deps;
  const hasAnyFile = async (patterns: string[]) => {
    const matches = await fg(patterns, {
      cwd: options.installDir,
      absolute: false,
      onlyFiles: true,
      ignore: ['**/node_modules/**'],
    });
    return matches.length > 0;
  };

  // --- Next.js
  if (has('next') || (await hasAnyFile(['**/next.config.{js,ts,mjs,cjs}']))) {
    return 'NEXT_PUBLIC_';
  }

  // --- Create React App
  if (
    has('react-scripts') ||
    has('create-react-app') ||
    (await hasAnyFile(['**/config-overrides.js']))
  ) {
    return 'REACT_APP_';
  }

  // --- Vite (vanilla, TanStack, Solid, etc.)
  // Note: Vite does not need PUBLIC_ but we use it to follow the docs, to improve the chances of an LLM getting it right.
  if (has('vite') || (await hasAnyFile(['**/vite.config.{js,ts,mjs,cjs}']))) {
    return 'VITE_PUBLIC_';
  }

  // --- SvelteKit
  if (
    has('@sveltejs/kit') ||
    (await hasAnyFile(['**/svelte.config.{js,ts}']))
  ) {
    return 'PUBLIC_';
  }

  // --- TanStack Start (uses Vite)
  if (
    has('@tanstack/start') ||
    (await hasAnyFile(['**/tanstack.config.{js,ts}']))
  ) {
    return 'VITE_PUBLIC_';
  }

  // --- SolidStart (uses Vite)
  if (has('solid-start') || (await hasAnyFile(['**/solid.config.{js,ts}']))) {
    return 'VITE_PUBLIC_';
  }

  // --- Astro
  if (has('astro') || (await hasAnyFile(['**/astro.config.{js,ts,mjs}']))) {
    return 'PUBLIC_';
  }

  // We default to Vite if we can't detect a specific framework, since it's the most commonly used.
  return 'VITE_PUBLIC_';
}

/**
 * Validates API key format to prevent injection attacks and file corruption.
 * API keys should be alphanumeric with optional hyphens/underscores, 20-100 chars.
 *
 * @param key - The API key to validate
 * @returns true if the key is valid, false otherwise
 */
function validateApiKey(key: string): boolean {
  // API keys should be alphanumeric with optional hyphens/underscores
  // Length: 20-100 characters (reasonable bounds for API keys)
  const API_KEY_PATTERN = /^[a-zA-Z0-9_-]{20,100}$/;

  // Check pattern and ensure no dangerous characters
  return (
    API_KEY_PATTERN.test(key) &&
    !key.includes('\n') &&
    !key.includes('\r') &&
    !key.includes('\0')
  );
}

export async function writeApiKeyToEnv(
  apiKey: string,
  installDir: string,
): Promise<void> {
  // Sanitize input by trimming and removing dangerous characters
  const sanitizedKey = apiKey.trim().replace(/[\r\n\0]/g, '');

  // Validate the sanitized key
  if (!validateApiKey(sanitizedKey)) {
    throw new Error(
      'Invalid API key format. API keys must be 20-100 characters long and contain only alphanumeric characters, hyphens, and underscores.',
    );
  }

  const envPath = path.join(installDir, '.env');
  let envContent = '';

  try {
    envContent = await fs.promises.readFile(envPath, 'utf-8');
  } catch {
    // File doesn't exist, will create it
  }

  // Check if RAINDROP_WRITE_KEY already exists in the file
  if (envContent.includes('RAINDROP_WRITE_KEY=')) {
    // Replace existing key
    envContent = envContent.replace(
      /RAINDROP_WRITE_KEY=.*/,
      `RAINDROP_WRITE_KEY=${sanitizedKey}`,
    );
  } else {
    // Add new key
    envContent =
      envContent.trim() +
      (envContent ? '\n' : '') +
      `RAINDROP_WRITE_KEY=${sanitizedKey}\n`;
  }

  await fs.promises.writeFile(envPath, envContent, 'utf-8');
}
