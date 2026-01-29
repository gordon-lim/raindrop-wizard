import type { Integration } from './constants.js';
import type { PackageJson } from '../utils/package-json-types.js';
import type { WizardOptions } from '../utils/types.js';

/**
 * Configuration interface for framework-specific agent integrations.
 * Each framework exports a FrameworkConfig that the universal runner uses.
 */
export interface FrameworkConfig {
  metadata: FrameworkMetadata;
  detection: FrameworkDetection;
  prompts: PromptConfig;
  ui: UIConfig;
}

/**
 * Basic framework information and documentation
 */
export interface FrameworkMetadata {
  /** Display name (e.g., "Python", "TypeScript") */
  name: string;

  /** Integration type from constants */
  integration: Integration;

  /** URL to SDK-specific Raindrop docs */
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
   * Receives wizard options to access user selections like otelPlatform.
   */
  getDocumentation?: (options: WizardOptions) => Promise<string>;
}

/**
 * UI messaging configuration
 */
export interface UIConfig {
  /** Success message when agent completes */
  successMessage: string;

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
  "Pitter patter, let's get at 'er... integrating with Raindrop!";
