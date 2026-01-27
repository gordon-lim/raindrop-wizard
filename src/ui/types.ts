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
// Plan Approval Types (ExitPlanMode tool)
// ============================================================================

/**
 * Props for plan approval prompts
 */
export interface PlanApprovalProps {
  planContent: string;
}

/**
 * Result from plan approval - returned to the handler
 */
export interface PlanApprovalResult {
  approved: boolean;
  feedback?: string; // Present only if approved: false
}

// ============================================================================
// Persistent Input Types
// ============================================================================

/**
 * Props for unified text input component.
 * Handles both callback mode (during agent execution) and context mode (standalone prompts).
 * Note: Spinner is managed separately via ui.spinner().
 */
export interface PersistentInputProps {
  placeholder?: string;
  /** Message to show above the input */
  message?: string;
  /** Default value for the input */
  defaultValue?: string;
  /** Validation function - return error message or void */
  validate?: (value: string) => string | void;
  /** Callback when user submits - if not provided, uses resolvePending from context */
  onSubmit?: (message: string) => void | Promise<void>;
  /** Callback when user interrupts (Esc/Ctrl+C) - if not provided, uses resolvePending from context */
  onInterrupt?: () => void;
}

// ============================================================================
// Feedback Select Types (Select with inline text input option)
// ============================================================================

/**
 * An option in a feedback select prompt
 */
export interface FeedbackSelectOption<T> {
  value: T;
  label: string;
  /** If true, selecting this option enables inline text input */
  allowTextInput?: boolean;
}

/**
 * Props for feedback select prompts
 */
export interface FeedbackSelectOptions<T> {
  message: string;
  options: Array<FeedbackSelectOption<T>>;
}

/**
 * Result from feedback select - either an option was selected or text was entered
 */
export type FeedbackSelectResult<T> =
  | { type: 'option'; value: T }
  | { type: 'text'; value: string };

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
