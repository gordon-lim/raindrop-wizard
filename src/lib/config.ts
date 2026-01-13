import type { WizardOptions } from '../utils/types';
import { Integration } from './constants';
import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';

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

export const INTEGRATION_CONFIG = {
  [Integration.python]: {
    detect: detectPythonProject,
    docsUrl: 'https://www.raindrop.ai/docs/sdk/python',
  },
  [Integration.typescript]: {
    detect: detectTypeScriptProject,
    docsUrl: 'https://www.raindrop.ai/docs/sdk/typescript',
  },
} as const satisfies Record<Integration, IntegrationConfig>;

export const INTEGRATION_ORDER = [
  Integration.python,
  Integration.typescript,
] as const;
