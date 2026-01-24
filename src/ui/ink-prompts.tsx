/**
 * Main entry point for ink-based UI components
 * Provides clack-compatible API for the raindrop wizard
 *
 * NOTE: This file should NOT have static imports of ink-dependent components
 * because ink uses ESM with top-level await, which breaks in CommonJS.
 * Use dynamic imports in src/utils/ui.ts instead.
 */

// Only export non-ink components and types
export { intro, outro, note, cancel } from './components/Message';
export { log, logTaskResult, logResult, logTask } from './components/Logger';

// Re-export types only (types don't cause runtime imports)
export type {
  SelectOptions,
  SelectOption,
  ConfirmOptions,
  TextOptions,
  SpinnerInstance,
  LogFunctions,
} from './types';

// Re-export cancellation symbol (no ink dependency)
export { isCancel, CANCEL_SYMBOL } from './cancellation';
