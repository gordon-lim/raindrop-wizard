export type RaindropProjectData = Record<string, unknown>;

export type PreselectedProject = {
  project: RaindropProjectData;
  authToken: string;
};

export type OtelPlatform = 'next' | 'node' | 'cloudflare' | 'sentry';

export type OtelProvider = '' | 'sentry' | 'other';

export type WizardOptions = {
  /**
   * Whether to enable debug mode.
   */
  debug: boolean;

  /**
   * Whether to force install the SDK package to continue with the installation in case
   * any package manager checks are failing (e.g. peer dependency versions).
   *
   * Use with caution and only if you know what you're doing.
   *
   * Does not apply to all wizard flows (currently NPM only)
   */
  forceInstall: boolean;

  /**
   * The directory to run the wizard in.
   */
  installDir: string;

  /**
   * Whether to select the default option for all questions automatically.
   */
  default: boolean;

  /**
   * Unique session ID (UUID) generated at wizard startup.
   * Used to identify events from this wizard run.
   */
  sessionId: string;

  /**
   * Compiled setup details string for session initialization.
   * Contains project info like package.json, dependencies, etc.
   */
  compiledSetup: string;

  /**
   * OpenTelemetry platform selection for Vercel AI SDK integration.
   */
  otelPlatform?: OtelPlatform;

  /**
   * OpenTelemetry provider selection for TypeScript integration.
   */
  otelProvider?: OtelProvider;
};

export interface Feature {
  id: string;
  prompt: string;
  enabledHint?: string;
  disabledHint?: string;
}

export type FileChange = {
  filePath: string;
  oldContent?: string;
  newContent: string;
};

export type CloudRegion = 'us' | 'eu';

export type AIModel =
  | 'gpt-5-mini'
  | 'o4-mini'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-pro';
