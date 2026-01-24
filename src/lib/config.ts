import type { WizardOptions } from '../utils/types';
import { Integration } from './constants';
import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
import clack from '../utils/ui';

type IntegrationConfig = {
  detect: (options: Pick<WizardOptions, 'installDir'>) => Promise<boolean>;
  docsUrl: string;
};

async function detectPythonProject(
  options: Pick<WizardOptions, 'installDir'>,
): Promise<boolean> {
  // Check for Python files
  const pythonFiles = await fg('**/*.py', {
    cwd: options.installDir,
    ignore: [
      '**/node_modules/**',
      '**/__pycache__/**',
      '**/.venv/**',
      '**/venv/**',
    ],
    onlyFiles: true,
  });

  if (pythonFiles.length > 0) {
    return true;
  }

  // Check for Python project files
  const pythonProjectFiles = [
    'requirements.txt',
    'setup.py',
    'pyproject.toml',
    'Pipfile',
    'poetry.lock',
  ];

  for (const file of pythonProjectFiles) {
    const filePath = path.join(options.installDir, file);
    if (fs.existsSync(filePath)) {
      return true;
    }
  }

  return false;
}

async function detectTypeScriptProject(
  options: Pick<WizardOptions, 'installDir'>,
): Promise<boolean> {
  // Check for tsconfig.json
  const tsconfigPath = path.join(options.installDir, 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    return true;
  }

  // Check for TypeScript files
  const tsFiles = await fg('**/*.{ts,tsx}', {
    cwd: options.installDir,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    onlyFiles: true,
  });

  if (tsFiles.length > 0) {
    return true;
  }

  // Check for TypeScript in package.json (if it exists)
  const packageJsonPath = path.join(options.installDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJsonContent = await fs.promises.readFile(
        packageJsonPath,
        'utf-8',
      );
      const packageJson = JSON.parse(packageJsonContent);
      const deps = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {}),
      };
      if (
        'typescript' in deps ||
        '@types/node' in deps ||
        '@types/react' in deps
      ) {
        return true;
      }
    } catch {
      // package.json exists but couldn't be read/parsed - skip this check
    }
  }

  return false;
}

async function detectVercelAiSdkProject(
  options: Pick<WizardOptions, 'installDir'>,
): Promise<boolean> {
  // Check for 'ai' package in package.json
  const packageJsonPath = path.join(options.installDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJsonContent = await fs.promises.readFile(
        packageJsonPath,
        'utf-8',
      );
      const packageJson = JSON.parse(packageJsonContent);
      const deps = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {}),
      };

      // Check for 'ai' package or AI SDK providers
      if ('ai' in deps) {
        clack.log.info('✓ Found "ai" package in dependencies');
        return true;
      }
      if ('@ai-sdk/openai' in deps) {
        clack.log.info('✓ Found "@ai-sdk/openai" package in dependencies');
        return true;
      }
      if ('@ai-sdk/anthropic' in deps) {
        clack.log.info('✓ Found "@ai-sdk/anthropic" package in dependencies');
        return true;
      }
    } catch {
      // package.json exists but couldn't be read/parsed - continue to file check
    }
  }

  // Check for Vercel AI SDK imports in source files
  const sourceFiles = await fg('**/*.{ts,tsx,js,jsx}', {
    cwd: options.installDir,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'],
    onlyFiles: true,
  });

  const aiSdkImportPatterns = [
    /from\s+['"]ai['"]/,
    /from\s+['"]ai\/rsc['"]/,
    /from\s+['"]@ai-sdk\//,
  ];

  for (const file of sourceFiles) {
    try {
      const filePath = path.join(options.installDir, file);
      const content = await fs.promises.readFile(filePath, 'utf-8');

      if (aiSdkImportPatterns.some((pattern) => pattern.test(content))) {
        clack.log.info(`✓ Found AI SDK imports in source file: ${file}`);
        return true;
      }
    } catch {
      // Skip files that can't be read
      continue;
    }
  }

  return false;
}

export const INTEGRATION_CONFIG = {
  [Integration.python]: {
    detect: detectPythonProject,
    docsUrl: 'https://www.raindrop.ai/docs/sdk/python',
  },
  [Integration.typescript]: {
    detect: detectTypeScriptProject,
    docsUrl: 'https://www.raindrop.ai/docs/sdk/typescript',
  },
  [Integration.vercelAiSdk]: {
    detect: detectVercelAiSdkProject,
    docsUrl: 'https://www.raindrop.ai/docs/sdk/auto-vercel-ai',
  },
} as const satisfies Record<Integration, IntegrationConfig>;

export const INTEGRATION_ORDER = [
  Integration.python,
  Integration.vercelAiSdk,
  Integration.typescript,
] as const;
