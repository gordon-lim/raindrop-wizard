import type { Integration } from './constants';
import type { PackageJson } from '../utils/package-json-types';

/**
 * Configuration interface for framework-specific agent integrations.
 * Each framework exports a FrameworkConfig that the universal runner uses.
 */
export interface FrameworkConfig {
  metadata: FrameworkMetadata;
  detection: FrameworkDetection;
  prompts: PromptConfig;
  ui: UIConfig;
  /** Optional setup function to run before testing (e.g., add test endpoint) */
  setup?: () => Promise<void>;
  /** Optional cleanup function to run after agent completes (e.g., remove test endpoint) */
  cleanup?: () => Promise<void>;
}

/**
 * Basic framework information and documentation
 */
export interface FrameworkMetadata {
  /** Display name (e.g., "Python", "TypeScript") */
  name: string;

  /** Integration type from constants */
  integration: Integration;

  /** URL to SDK-specific raindrop.ai docs */
  docsUrl: string;
}

/**
 * Framework detection and version handling
 */
export interface FrameworkDetection {
  /** Extract version from package.json */
  getVersion: (packageJson: PackageJson) => string | undefined;
}

/**
 * Prompt configuration
 */
export interface PromptConfig {
  /**
   * Optional: Get documentation content to include in the prompt.
   * May ask user questions to determine which documentation to load.
   */
  getDocumentation?: () => Promise<string>;
}

/**
 * UI messaging configuration
 */
export interface UIConfig {
  /** Success message when agent completes */
  successMessage: string;

  /** Estimated time for agent to complete (in minutes) */
  estimatedDurationMinutes: number;

  /** Generate "What the agent did" bullets from context */
  getOutroChanges: (context: any) => string[];

  /** Generate "Next steps" bullets from context */
  getOutroNextSteps: (context: any) => string[];
}

/**
 * Generate welcome message from framework name
 */
export function getWelcomeMessage(frameworkName: string): string {
  return `Raindrop ${frameworkName} wizard`;
}

/**
 * Shared spinner message for all frameworks
 */
export const SPINNER_MESSAGE =
  "Pitter patter, let's get at 'er... integrating with raindrop.ai!";
