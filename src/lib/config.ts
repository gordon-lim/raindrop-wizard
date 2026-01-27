import type { WizardOptions } from '../utils/types.js';
import { Integration } from './constants.js';
import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
import ui from '../utils/ui.js';
import { execSync } from 'child_process';

/**
 * Setup detail collected for Slack notification
 */
export type SetupDetail = {
  filename: string;
  content: string;
};

type IntegrationConfig = {
  detect: (options: Pick<WizardOptions, 'installDir'>) => Promise<boolean>;
  docsUrl: string;
  collectSetupDetails: (installDir: string) => Promise<SetupDetail[]>;
};

/**
 * Get installed Python packages based on detected package manager/environment.
 * Returns the command used and the output.
 */
function getPythonPackages(installDir: string): { command: string; output: string } | null {
  // Check for Poetry (poetry.lock)
  if (fs.existsSync(path.join(installDir, 'poetry.lock'))) {
    try {
      const output = execSync('poetry show', { encoding: 'utf-8', cwd: installDir }).trim();
      return { command: 'poetry show', output };
    } catch {
      // Poetry not available or failed
    }
  }

  // Check for Pipenv (Pipfile.lock)
  if (fs.existsSync(path.join(installDir, 'Pipfile.lock'))) {
    try {
      const output = execSync('pipenv run pip list', { encoding: 'utf-8', cwd: installDir }).trim();
      return { command: 'pipenv run pip list', output };
    } catch {
      // Pipenv not available or failed
    }
  }

  // Check for uv (uv.lock)
  if (fs.existsSync(path.join(installDir, 'uv.lock'))) {
    try {
      const output = execSync('uv pip list', { encoding: 'utf-8', cwd: installDir }).trim();
      return { command: 'uv pip list', output };
    } catch {
      // uv not available or failed
    }
  }

  // Check for PDM (pdm.lock)
  if (fs.existsSync(path.join(installDir, 'pdm.lock'))) {
    try {
      const output = execSync('pdm list', { encoding: 'utf-8', cwd: installDir }).trim();
      return { command: 'pdm list', output };
    } catch {
      // PDM not available or failed
    }
  }

  // Check for Conda (environment.yml or conda-lock.yml)
  if (
    fs.existsSync(path.join(installDir, 'environment.yml')) ||
    fs.existsSync(path.join(installDir, 'environment.yaml')) ||
    fs.existsSync(path.join(installDir, 'conda-lock.yml'))
  ) {
    try {
      const output = execSync('conda list', { encoding: 'utf-8', cwd: installDir }).trim();
      return { command: 'conda list', output };
    } catch {
      // Conda not available or failed
    }
  }

  // Check for virtual environment by scanning for pyvenv.cfg in top-level directories
  try {
    const entries = fs.readdirSync(installDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const venvPath = path.join(installDir, entry.name);
        const pyvenvCfg = path.join(venvPath, 'pyvenv.cfg');

        if (fs.existsSync(pyvenvCfg)) {
          // Found a virtual environment - try Unix-style path first, then Windows
          const unixPip = path.join(venvPath, 'bin', 'pip');
          const winPip = path.join(venvPath, 'Scripts', 'pip.exe');

          if (fs.existsSync(unixPip)) {
            try {
              const output = execSync(`"${unixPip}" list`, { encoding: 'utf-8', cwd: installDir }).trim();
              return { command: `${entry.name}/bin/pip list`, output };
            } catch {
              // Failed
            }
          } else if (fs.existsSync(winPip)) {
            try {
              const output = execSync(`"${winPip}" list`, { encoding: 'utf-8', cwd: installDir }).trim();
              return { command: `${entry.name}/Scripts/pip list`, output };
            } catch {
              // Failed
            }
          }
        }
      }
    }
  } catch {
    // Failed to read directory
  }

  // Fallback to system pip/pip3
  try {
    const output = execSync('pip list', { encoding: 'utf-8', cwd: installDir }).trim();
    return { command: 'pip list', output };
  } catch {
    try {
      const output = execSync('pip3 list', { encoding: 'utf-8', cwd: installDir }).trim();
      return { command: 'pip3 list', output };
    } catch {
      return null;
    }
  }
}

/**
 * Collect setup details for Python projects
 */
async function collectPythonSetupDetails(installDir: string): Promise<SetupDetail[]> {
  const details: SetupDetail[] = [];

  // Collect installed packages using detected package manager
  const packages = getPythonPackages(installDir);
  if (packages) {
    details.push({
      filename: `installed-packages (${packages.command})`,
      content: packages.output,
    });
  }

  // Collect pyproject.toml
  const pyprojectPath = path.join(installDir, 'pyproject.toml');
  if (fs.existsSync(pyprojectPath)) {
    const content = await fs.promises.readFile(pyprojectPath, 'utf-8');
    details.push({ filename: 'pyproject.toml', content });
  }

  // Collect requirements.txt (lower priority - less verbose than package list)
  const requirementsPath = path.join(installDir, 'requirements.txt');
  if (fs.existsSync(requirementsPath)) {
    const content = await fs.promises.readFile(requirementsPath, 'utf-8');
    details.push({ filename: 'requirements.txt', content });
  }

  return details;
}

/**
 * Collect setup details for TypeScript/Node.js projects
 */
async function collectTypeScriptSetupDetails(installDir: string): Promise<SetupDetail[]> {
  const details: SetupDetail[] = [];

  // Collect package.json
  const packageJsonPath = path.join(installDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const content = await fs.promises.readFile(packageJsonPath, 'utf-8');
    details.push({ filename: 'package.json', content });
  }

  // Collect Node version
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
    details.push({ filename: 'node-version', content: nodeVersion });
  } catch {
    // Node version not available
  }

  // Collect TypeScript version
  try {
    // First try to get from package.json devDependencies/dependencies
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      if (deps.typescript) {
        details.push({ filename: 'typescript-version', content: deps.typescript });
      }
    }
  } catch {
    // TypeScript version not available
  }

  return details;
}

// Python AI SDK import patterns to detect
const PYTHON_AI_SDK_IMPORT_PATTERNS = [
  // Direct provider SDKs
  /(?:from|import)\s+openai/,
  /(?:from|import)\s+anthropic/,
  /(?:from|import)\s+google\.generativeai/,
  /(?:from|import)\s+mistralai/,
  /(?:from|import)\s+cohere/,
  /(?:from|import)\s+groq/,
  /(?:from|import)\s+together/,
  /(?:from|import)\s+fireworks/,
  /(?:from|import)\s+replicate/,

  // Frameworks / Orchestration
  /(?:from|import)\s+litellm/,
  /(?:from|import)\s+langchain/,
  /from\s+langchain_\w+\s+import/,
  /(?:from|import)\s+llama_index/,
  /(?:from|import)\s+autogen/,
  /(?:from|import)\s+crewai/,
  /(?:from|import)\s+dspy/,

  // Cloud AI
  /(?:from|import)\s+vertexai/,
  /from\s+google\.cloud\s+import\s+aiplatform/,
];

// Python AI SDK package names (for checking requirements/pyproject)
const PYTHON_AI_SDK_PACKAGES = [
  // Direct provider SDKs
  'openai',
  'anthropic',
  'google-generativeai',
  'mistralai',
  'cohere',
  'groq',
  'together',
  'fireworks-ai',
  'replicate',

  // Frameworks / Orchestration
  'litellm',
  'langchain',
  'langchain-openai',
  'langchain-anthropic',
  'langchain-google-genai',
  'langchain-community',
  'langchain-core',
  'llama-index',
  'llama-index-core',
  'autogen',
  'pyautogen',
  'crewai',
  'dspy',
  'dspy-ai',

  // Cloud AI
  'vertexai',
  'google-cloud-aiplatform',
];

async function detectPythonProject(
  options: Pick<WizardOptions, 'installDir'>,
): Promise<boolean> {
  // Check for Python files with AI SDK imports
  const pythonFiles = await fg('**/*.py', {
    cwd: options.installDir,
    ignore: [
      '**/node_modules/**',
      '**/__pycache__/**',
      '**/.venv/**',
      '**/venv/**',
      '**/site-packages/**',
    ],
    onlyFiles: true,
  });

  for (const file of pythonFiles) {
    try {
      const filePath = path.join(options.installDir, file);
      const content = await fs.promises.readFile(filePath, 'utf-8');

      if (PYTHON_AI_SDK_IMPORT_PATTERNS.some((pattern) => pattern.test(content))) {
        ui.addItem({ type: 'response', text: `✓ Found AI SDK imports in: ${file}` });
        return true;
      }
    } catch {
      // Skip files that can't be read
      continue;
    }
  }

  // Check for AI SDK packages in requirements.txt
  const requirementsPath = path.join(options.installDir, 'requirements.txt');
  if (fs.existsSync(requirementsPath)) {
    try {
      const content = await fs.promises.readFile(requirementsPath, 'utf-8');
      const lines = content.toLowerCase().split('\n');
      for (const pkg of PYTHON_AI_SDK_PACKAGES) {
        if (lines.some((line) => line.startsWith(pkg.toLowerCase()))) {
          ui.addItem({ type: 'response', text: `✓ Found "${pkg}" in requirements.txt` });
          return true;
        }
      }
    } catch {
      // Skip if can't read
    }
  }

  // Check for AI SDK packages in pyproject.toml
  const pyprojectPath = path.join(options.installDir, 'pyproject.toml');
  if (fs.existsSync(pyprojectPath)) {
    try {
      const content = await fs.promises.readFile(pyprojectPath, 'utf-8');
      const contentLower = content.toLowerCase();
      for (const pkg of PYTHON_AI_SDK_PACKAGES) {
        // Check for package in dependencies (handles both regular and optional deps)
        if (contentLower.includes(`"${pkg.toLowerCase()}"`) || contentLower.includes(`'${pkg.toLowerCase()}'`)) {
          ui.addItem({ type: 'response', text: `✓ Found "${pkg}" in pyproject.toml` });
          return true;
        }
      }
    } catch {
      // Skip if can't read
    }
  }

  // Check for AI SDK packages in Pipfile
  const pipfilePath = path.join(options.installDir, 'Pipfile');
  if (fs.existsSync(pipfilePath)) {
    try {
      const content = await fs.promises.readFile(pipfilePath, 'utf-8');
      const contentLower = content.toLowerCase();
      for (const pkg of PYTHON_AI_SDK_PACKAGES) {
        if (contentLower.includes(pkg.toLowerCase())) {
          ui.addItem({ type: 'response', text: `✓ Found "${pkg}" in Pipfile` });
          return true;
        }
      }
    } catch {
      // Skip if can't read
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
        ui.addItem({ type: 'response', text: '✓ Found "ai" package in dependencies' });
        return true;
      }
      if ('@ai-sdk/openai' in deps) {
        ui.addItem({ type: 'response', text: '✓ Found "@ai-sdk/openai" package in dependencies' });
        return true;
      }
      if ('@ai-sdk/anthropic' in deps) {
        ui.addItem({ type: 'response', text: '✓ Found "@ai-sdk/anthropic" package in dependencies' });
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
        ui.addItem({ type: 'response', text: `✓ Found AI SDK imports in source file: ${file}` });
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
    collectSetupDetails: collectPythonSetupDetails,
  },
  [Integration.typescript]: {
    detect: detectTypeScriptProject,
    docsUrl: 'https://www.raindrop.ai/docs/sdk/typescript',
    collectSetupDetails: collectTypeScriptSetupDetails,
  },
  [Integration.vercelAiSdk]: {
    detect: detectVercelAiSdkProject,
    docsUrl: 'https://www.raindrop.ai/docs/sdk/auto-vercel-ai',
    collectSetupDetails: collectTypeScriptSetupDetails, // Same as TypeScript
  },
} as const satisfies Record<Integration, IntegrationConfig>;

export const INTEGRATION_ORDER = [
  Integration.python,
  Integration.vercelAiSdk,
  Integration.typescript,
] as const;
