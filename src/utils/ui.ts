/**
 * Unified UI API for the raindrop wizard.
 *
 * Direct API (like gemini-cli) that dispatches to the unified Ink app via WizardContext.
 *
 * Usage:
 * 1. Call initWizardUI() once at startup (in bin.ts)
 * 2. Use ui.addItem(), ui.select(), ui.text(), etc.
 * 3. The app unmounts when you call ui.exit()
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
  SpinnerInstance,
  ToolApprovalProps,
  ToolApprovalResult,
  ClarifyingQuestionsProps,
  ClarifyingQuestionsResult,
  PlanApprovalProps,
  PlanApprovalResult,
} from '../ui/types.js';
import type { HistoryItemInput, AgentState } from '../ui/contexts/WizardContext.js';

// Re-export types for convenience
export type {
  SelectOptions,
  TextOptions,
  SpinnerInstance,
  HistoryItemInput,
  ToolApprovalProps,
  ToolApprovalResult,
  ClarifyingQuestionsProps,
  ClarifyingQuestionsResult,
  PlanApprovalProps,
  PlanApprovalResult,
  AgentState,
};
export { isCancel, CANCEL_SYMBOL };

// Global wizard instance
let wizardInstance: WizardInstance | null = null;

/**
 * Initialize the wizard UI. Must be called before using any prompts.
 * Returns a promise that resolves when the wizard is ready.
 */
export async function initWizardUI(): Promise<WizardInstance> {
  if (wizardInstance) {
    return wizardInstance;
  }
  wizardInstance = startWizardUI();
  await wizardInstance.waitUntilReady();
  return wizardInstance;
}

/**
 * Get actions, throws if wizard hasn't been started.
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
 * Add an item to history (direct, like gemini-cli).
 * 
 * @example
 * ui.addItem({ type: 'response', text: 'Starting setup...' });
 * ui.addItem({ type: 'success', text: 'Done!' });
 * ui.addItem({ type: 'error', text: 'Something went wrong' });
 * ui.addItem({ type: 'logo', text: '' });
 */
export function addItem(item: HistoryItemInput): void {
  getActions().addItem(item);
}

/**
 * Display a select prompt and return the selected value.
 */
export async function select<T>(options: SelectOptions<T>): Promise<T | symbol> {
  return getActions().select(options) as Promise<T | symbol>;
}

/**
 * Display a text input prompt and return the entered value.
 */
export async function text(options: TextOptions): Promise<string | symbol> {
  return getActions().text(options);
}

/**
 * Create and return a spinner instance.
 */
export function spinner(): SpinnerInstance {
  return getActions().spinner();
}

/**
 * Exit the wizard UI.
 */
export function exit(): void {
  getActions().exit();
}

/**
 * Check if the wizard UI is running.
 */
export { isWizardRunning };

// ============================================================================
// Agent-related functions
// ============================================================================

/**
 * Show tool approval prompt (replaces persistent-input, restores after).
 * Used by canUseTool handler for tools that need user approval.
 */
export async function toolApproval(
  props: ToolApprovalProps,
): Promise<ToolApprovalResult> {
  return getActions().toolApproval(props);
}

/**
 * Show clarifying questions prompt (replaces persistent-input, restores after).
 * Used by canUseTool handler for AskUserQuestion tool.
 */
export async function clarifyingQuestions(
  props: ClarifyingQuestionsProps,
): Promise<ClarifyingQuestionsResult> {
  return getActions().clarifyingQuestions(props);
}

/**
 * Show plan approval prompt (replaces persistent-input, restores after).
 * Used by canUseTool handler for ExitPlanMode tool.
 */
export async function planApproval(
  props: PlanApprovalProps,
): Promise<PlanApprovalResult> {
  return getActions().planApproval(props);
}

/**
 * Start persistent input mode during agent execution.
 * Sets pendingItem to persistent-input type.
 */
export function startPersistentInput(config: {
  onSubmit: (message: string) => void;
  onInterrupt: () => void;
  spinnerMessage?: string;
}): void {
  getActions().startPersistentInput(config);
}

/**
 * Stop persistent input mode.
 * Clears pendingItem if it's persistent-input type.
 */
export function stopPersistentInput(): void {
  getActions().stopPersistentInput();
}

/**
 * Update agent state.
 */
export function setAgentState(state: Partial<AgentState>): void {
  getActions().setAgentState(state);
}

// Default export with all functions
const ui = {
  initWizardUI,
  addItem,
  select,
  text,
  spinner,
  exit,
  isCancel,
  isWizardRunning,
  // Agent-related functions
  toolApproval,
  clarifyingQuestions,
  planApproval,
  startPersistentInput,
  stopPersistentInput,
  setAgentState,
};

export default ui;
