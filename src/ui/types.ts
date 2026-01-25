/**
 * Type definitions for ink-based UI components
 * Maintains API compatibility with clack
 */

export interface SelectOption<T> {
  value: T;
  label: string;
  hint?: string;
}

export interface SelectOptions<T> {
  message: string;
  options: Array<SelectOption<T>>;
  initialValue?: T;
}

export interface ConfirmOptions {
  message: string;
  active?: string;
  inactive?: string;
  initialValue?: boolean;
}

export interface TextOptions {
  message: string;
  placeholder?: string;
  defaultValue?: string;
  initialValue?: string;
  validate?: (value: string) => string | void;
}

export interface SpinnerInstance {
  start: (msg?: string) => void;
  stop: (msg?: string) => void;
  message: (msg: string) => void;
}

export interface LogFunctions {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
  success: (msg: string) => void;
  step: (msg: string) => void;
}

// ============================================================================
// Tool Approval Types
// ============================================================================

/**
 * Tool approval result - returned to the SDK's canUseTool callback
 */
export type ToolApprovalResult =
  | { behavior: 'allow'; updatedInput: Record<string, unknown> }
  | { behavior: 'deny'; message: string };

/**
 * Props for tool approval prompts
 */
export interface ToolApprovalProps {
  toolName: string;
  input: Record<string, unknown>;
  /** For file edits, the diff content */
  diffContent?: string;
  /** For file edits, the filename */
  fileName?: string;
  /** Description of the tool action */
  description?: string;
}

// ============================================================================
// Clarifying Questions Types (AskUserQuestion tool)
// ============================================================================

/**
 * A single question option from the SDK
 */
export interface QuestionOption {
  label: string;
  description: string;
}

/**
 * A single clarifying question from the SDK
 */
export interface ClarifyingQuestion {
  question: string;
  header: string;
  options: QuestionOption[];
  multiSelect: boolean;
}

/**
 * Props for clarifying questions prompts
 */
export interface ClarifyingQuestionsProps {
  questions: ClarifyingQuestion[];
}

/**
 * Result from clarifying questions - returned to the SDK
 */
export interface ClarifyingQuestionsResult {
  questions: ClarifyingQuestion[];
  answers: Record<string, string>;
}

// ============================================================================
// Persistent Input Types
// ============================================================================

/**
 * Props for persistent text input during agent execution
 */
export interface PersistentInputProps {
  onSubmit: (message: string) => void | Promise<void>;
  onInterrupt: () => void;
  placeholder?: string;
  /** Message to show in the spinner while agent is working */
  spinnerMessage?: string;
}

// ============================================================================
// Tool Call Display Types
// ============================================================================

/**
 * Status of a tool call
 */
export type ToolCallStatus =
  | 'pending'
  | 'executing'
  | 'success'
  | 'error'
  | 'denied'
  | 'interrupted';

/**
 * A tool call to display in history
 */
export interface ToolCallInfo {
  toolName: string;
  description?: string;
  status: ToolCallStatus;
  input?: Record<string, unknown>;
  result?: string;
  error?: string;
  /** For file edits, the diff content */
  diffContent?: string;
  /** For file edits, the filename */
  fileName?: string;
}

// ============================================================================
// Agent Query Handle
// ============================================================================

/**
 * Handle to control an active agent query
 */
export interface AgentQueryHandle {
  /** Interrupt the current agent execution */
  interrupt: () => Promise<void>;
  /** @deprecated No-op - use interrupt() then resume with a new prompt instead */
  sendMessage: (message: string) => void;
}
