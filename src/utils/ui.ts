/**
 * Unified UI API for the raindrop wizard.
 *
 * This module provides a clack-compatible API that dispatches to the unified
 * Ink app via WizardContext actions. No more separate render() calls!
 *
 * Usage:
 * 1. Call startWizardUI() once at startup (in bin.ts)
 * 2. Use clack.select(), clack.text(), etc. - they dispatch to the unified app
 * 3. The app unmounts when you call the exit action
 */

import {
  getWizardActions,
  startWizardUI,
  isWizardRunning,
  type WizardInstance,
} from '../ui/render.js';
import { isCancel, CANCEL_SYMBOL } from '../ui/cancellation.js';
import type {
  SelectOptions,
  TextOptions,
  ConfirmOptions,
  SpinnerInstance,
} from '../ui/types.js';

// Re-export types for convenience
export type { SelectOptions, TextOptions, ConfirmOptions, SpinnerInstance };
export { isCancel, CANCEL_SYMBOL };

// Global wizard instance
let wizardInstance: WizardInstance | null = null;

/**
 * Initialize the wizard UI. Must be called before using any prompts.
 * Returns a promise that resolves when the wizard is ready.
 */
async function initWizardUIInternal(): Promise<WizardInstance> {
  if (wizardInstance) {
    return wizardInstance;
  }
  wizardInstance = startWizardUI();
  // Wait for the wizard to be ready (actions available)
  await wizardInstance.waitUntilReady();
  return wizardInstance;
}

/**
 * Get actions, initializing the wizard if needed.
 * Throws if wizard hasn't been started.
 */
function getActions() {
  const actions = getWizardActions();
  if (!actions) {
    throw new Error(
      'Wizard UI not initialized. Call initWizardUI() first (usually in bin.ts)',
    );
  }
  return actions;
}

/**
 * Display a select prompt and return the selected value.
 */
async function select<T>(options: SelectOptions<T>): Promise<T | symbol> {
  const actions = getActions();
  return actions.showSelect(options) as Promise<T | symbol>;
}

/**
 * Display a text input prompt and return the entered value.
 */
async function text(options: TextOptions): Promise<string | symbol> {
  const actions = getActions();
  return actions.showText(options);
}

/**
 * Display a confirm prompt and return the boolean result.
 */
async function confirm(options: ConfirmOptions): Promise<boolean | symbol> {
  const actions = getActions();
  return actions.showConfirm(options);
}

/**
 * Create and return a spinner instance.
 */
function spinner(): SpinnerInstance {
  const actions = getActions();
  return actions.showSpinner();
}

/**
 * Display an intro message.
 */
function intro(message: string): void {
  const actions = getActions();
  actions.intro(message);
}

/**
 * Display an outro message.
 */
function outro(message: string): void {
  const actions = getActions();
  actions.outro(message);
}

/**
 * Display a note message with optional title.
 */
function note(message: string, title?: string): void {
  const actions = getActions();
  actions.note(message, title);
}

/**
 * Display a cancellation message.
 */
function cancel(message?: string): void {
  const actions = getActions();
  actions.cancel(message);
}

/**
 * Display the logo.
 */
function showLogo(): void {
  const actions = getActions();
  actions.showLogo();
}

/**
 * Log functions for various message types.
 */
const log = {
  info: (msg: string) => getActions().log.info(msg),
  warn: (msg: string) => getActions().log.warn(msg),
  error: (msg: string) => getActions().log.error(msg),
  success: (msg: string) => getActions().log.success(msg),
  step: (msg: string) => getActions().log.step(msg),
};

/**
 * Helper functions for task logging (Claude Code style).
 */
function logTaskResult(taskName: string, details: string): void {
  const actions = getActions();
  actions.log.success(taskName);
  actions.addHistoryItem({
    type: 'log-info',
    content: `  └─ ${details}`,
  });
}

function logResult(message: string): void {
  const actions = getActions();
  actions.addHistoryItem({
    type: 'log-info',
    content: `  └─ ${message}`,
  });
}

function logTask(taskName: string): void {
  const actions = getActions();
  actions.log.success(taskName);
}

// Re-export for direct access
export { initWizardUIInternal as initWizardUI };

// Export as clack-compatible API
const inkPrompts = {
  select,
  confirm,
  text,
  spinner,
  intro,
  outro,
  note,
  cancel,
  log,
  logTaskResult,
  logResult,
  logTask,
  isCancel,
  showLogo,
  // Additional exports for initialization
  initWizardUI: initWizardUIInternal,
  isWizardRunning,
};

export default inkPrompts;

// Named exports for direct imports
export {
  select,
  confirm,
  text,
  spinner,
  intro,
  outro,
  note,
  cancel,
  log,
  logTaskResult,
  logResult,
  logTask,
  showLogo,
  isWizardRunning,
};
