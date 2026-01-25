/**
 * Central state management for the unified Ink wizard app.
 * Uses React Context to share state between all UI components.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import type {
  SelectOptions,
  TextOptions,
  ConfirmOptions,
  SpinnerInstance,
  ToolApprovalProps,
  ToolApprovalResult,
  ClarifyingQuestionsProps,
  ClarifyingQuestionsResult,
  PersistentInputProps,
  ToolCallInfo,
  AgentQueryHandle,
} from '../types.js';

/**
 * Types of items that can appear in the history (Static section)
 */
export type HistoryItemType =
  | 'logo'
  | 'outro'
  | 'note'
  | 'cancel'
  | 'response'
  | 'warning'
  | 'error'
  | 'success'
  | 'step'
  | 'phase'
  | 'select-result'
  | 'text-result'
  | 'confirm-result'
  | 'spinner-result'
  | 'tool-call'
  | 'agent-message'
  | 'user-message'
  | 'clarifying-questions-result'
  | 'declined-questions';

/**
 * A completed item that goes into the Static history
 */
export interface HistoryItem {
  id: number;
  type: HistoryItemType;
  text: string;
  /** Optional secondary content (e.g., selected option label) */
  label?: string;
  /** Optional hint/description */
  hint?: string;
  /** Title for note items */
  title?: string;
  /** For tool-call items, the tool call info */
  toolCall?: ToolCallInfo;
  /** For clarifying-questions-result items, the Q&A pairs */
  questionsAndAnswers?: Array<{ question: string; answer: string }>;
}

/**
 * Input type for adding history items (without id)
 */
export type HistoryItemInput = Omit<HistoryItem, 'id'>;

/**
 * Types of pending prompts that can be active
 */
export type PendingItemType =
  | 'select'
  | 'text'
  | 'confirm'
  | 'spinner'
  | 'tool-approval'
  | 'clarifying-questions'
  | 'persistent-input';

/**
 * Spinner-specific props
 */
export interface SpinnerProps {
  message: string;
}

/**
 * All possible pending item props
 */
export type PendingItemProps =
  | SelectOptions<unknown>
  | TextOptions
  | ConfirmOptions
  | SpinnerProps
  | ToolApprovalProps
  | ClarifyingQuestionsProps
  | PersistentInputProps;

/**
 * A pending item represents an active prompt or spinner
 */
export interface PendingItem {
  type: PendingItemType;
  props: PendingItemProps;
  resolve: (value: unknown) => void;
  reject?: (error: Error) => void;
}

/**
 * Agent execution state
 */
export interface AgentState {
  /** Whether an agent is currently running */
  isRunning: boolean;
  /** Session ID for resuming */
  sessionId?: string;
  /** Handle to control the running agent */
  queryHandle?: AgentQueryHandle;
  /** Callbacks to restore persistent input after approval prompts */
  persistentInputCallbacks?: {
    onSubmit: (message: string) => void;
    onInterrupt: () => void;
  };
}

/**
 * Wizard state that's exposed via context
 */
export interface WizardState {
  /** Completed history items (rendered in Static) */
  history: HistoryItem[];
  /** Currently active prompt/spinner (rendered as pending) */
  pendingItem: PendingItem | null;
  /** Whether the app is ready to exit */
  shouldExit: boolean;
  /** Agent execution state */
  agentState: AgentState;
}

/**
 * Actions to modify wizard state
 */
export interface WizardActions {
  /** Add an item to history (like gemini-cli's addItem) */
  addItem: (item: HistoryItemInput) => void;

  /** Display a select prompt and return the selected value */
  select: <T>(options: SelectOptions<T>) => Promise<T | symbol>;

  /** Display a text input prompt and return the entered value */
  text: (options: TextOptions) => Promise<string | symbol>;

  /** Display a confirm prompt and return the boolean result */
  confirm: (options: ConfirmOptions) => Promise<boolean | symbol>;

  /** Display a spinner and return control methods */
  spinner: () => SpinnerInstance;

  /** Resolve the current pending item with a value */
  resolvePending: (value: unknown) => void;

  /** Mark the app as ready to exit */
  exit: () => void;

  // ========================================================================
  // Agent-related actions
  // ========================================================================

  /**
   * Show tool approval prompt (replaces persistent-input, restores after)
   * Used by canUseTool handler for tools that need user approval
   */
  toolApproval: (props: ToolApprovalProps) => Promise<ToolApprovalResult>;

  /**
   * Show clarifying questions prompt (replaces persistent-input, restores after)
   * Used by canUseTool handler for AskUserQuestion tool
   */
  clarifyingQuestions: (
    props: ClarifyingQuestionsProps,
  ) => Promise<ClarifyingQuestionsResult>;

  /**
   * Start persistent input mode during agent execution
   * Sets pendingItem to persistent-input type
   */
  startPersistentInput: (callbacks: {
    onSubmit: (message: string) => void;
    onInterrupt: () => void;
  }) => void;

  /**
   * Stop persistent input mode
   * Clears pendingItem if it's persistent-input type
   */
  stopPersistentInput: () => void;

  /**
   * Update agent state
   */
  setAgentState: (state: Partial<AgentState>) => void;
}

/**
 * Combined context type
 */
export interface WizardContextType {
  state: WizardState;
  actions: WizardActions;
}

// Create the context with a null default (must be used within provider)
const WizardContext = createContext<WizardContextType | null>(null);

/**
 * Hook to access wizard state and actions
 */
export function useWizard(): WizardContextType {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}

/**
 * Hook to access just the wizard state
 */
export function useWizardState(): WizardState {
  return useWizard().state;
}

/**
 * Hook to access just the wizard actions
 */
export function useWizardActions(): WizardActions {
  return useWizard().actions;
}

/**
 * Props for the WizardProvider
 */
interface WizardProviderProps {
  children: ReactNode;
  onExit?: () => void;
}

/**
 * Provider component that manages all wizard state
 */
export function WizardProvider({
  children,
  onExit,
}: WizardProviderProps): React.ReactElement {
  // State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [pendingItem, setPendingItem] = useState<PendingItem | null>(null);
  const [shouldExit, setShouldExit] = useState(false);
  const [agentState, setAgentStateInternal] = useState<AgentState>({
    isRunning: false,
  });

  // Counter for unique IDs
  const idCounter = useRef(0);

  // Ref for persistent input callbacks and config (immediately available, no state delay)
  const persistentInputConfigRef = useRef<{
    onSubmit: (message: string) => void;
    onInterrupt: () => void;
    spinnerMessage?: string;
  } | null>(null);

  // Get next unique ID
  const getNextId = useCallback(() => {
    return ++idCounter.current;
  }, []);

  // Add item to history (direct, like gemini-cli)
  const addItem = useCallback(
    (item: HistoryItemInput) => {
      setHistory((prev) => [...prev, { ...item, id: getNextId() }]);
    },
    [getNextId],
  );

  // Resolve current pending item
  const resolvePending = useCallback((value: unknown) => {
    setPendingItem((current) => {
      if (current) {
        current.resolve(value);
      }
      return null;
    });
  }, []);

  // Show select prompt
  const select = useCallback(
    <T,>(options: SelectOptions<T>): Promise<T | symbol> => {
      return new Promise((resolve) => {
        setPendingItem({
          type: 'select',
          props: options as SelectOptions<unknown>,
          resolve: resolve as (value: unknown) => void,
        });
      });
    },
    [],
  );

  // Show text prompt
  const text = useCallback(
    (options: TextOptions): Promise<string | symbol> => {
      return new Promise((resolve) => {
        setPendingItem({
          type: 'text',
          props: options,
          resolve: resolve as (value: unknown) => void,
        });
      });
    },
    [],
  );

  // Show confirm prompt
  const confirm = useCallback(
    (options: ConfirmOptions): Promise<boolean | symbol> => {
      return new Promise((resolve) => {
        setPendingItem({
          type: 'confirm',
          props: options,
          resolve: resolve as (value: unknown) => void,
        });
      });
    },
    [],
  );

  // Spinner ref to manage spinner state
  const spinnerResolve = useRef<((value: unknown) => void) | null>(null);

  // Show spinner
  const spinner = useCallback((): SpinnerInstance => {
    return {
      start: (msg = '') => {
        setPendingItem({
          type: 'spinner',
          props: { message: msg },
          resolve: (value) => {
            spinnerResolve.current?.(value);
          },
        });
      },
      stop: (msg = '') => {
        if (msg) {
          addItem({ type: 'spinner-result', text: msg });
        }
        setPendingItem(null);
      },
      message: (msg: string) => {
        setPendingItem((current) => {
          if (current?.type === 'spinner') {
            return {
              ...current,
              props: { message: msg },
            };
          }
          return current;
        });
      },
    };
  }, [addItem]);

  // Exit the app
  const exit = useCallback(() => {
    setShouldExit(true);
    onExit?.();
  }, [onExit]);

  // ========================================================================
  // Agent-related actions
  // ========================================================================

  // Helper to restore persistent input after approval/questions prompts
  const restorePersistentInput = useCallback(() => {
    const config = persistentInputConfigRef.current;
    if (config) {
      setPendingItem({
        type: 'persistent-input',
        props: {
          onSubmit: config.onSubmit,
          onInterrupt: config.onInterrupt,
          placeholder: 'Type a message or press Esc to interrupt...',
          spinnerMessage: config.spinnerMessage,
        } as PersistentInputProps,
        resolve: () => {},
      });
    }
  }, []);

  // Show tool approval prompt
  const toolApproval = useCallback(
    (props: ToolApprovalProps): Promise<ToolApprovalResult> => {
      return new Promise((resolve) => {
        setPendingItem({
          type: 'tool-approval',
          props,
          resolve: (result) => {
            // Restore persistent input after user responds
            restorePersistentInput();
            resolve(result as ToolApprovalResult);
          },
        });
      });
    },
    [restorePersistentInput],
  );

  // Show clarifying questions prompt
  const clarifyingQuestions = useCallback(
    (props: ClarifyingQuestionsProps): Promise<ClarifyingQuestionsResult> => {
      return new Promise((resolve) => {
        setPendingItem({
          type: 'clarifying-questions',
          props,
          resolve: (result) => {
            // Restore persistent input after user responds
            restorePersistentInput();
            resolve(result as ClarifyingQuestionsResult);
          },
        });
      });
    },
    [restorePersistentInput],
  );

  // Start persistent input mode
  const startPersistentInput = useCallback(
    (config: {
      onSubmit: (message: string) => void;
      onInterrupt: () => void;
      spinnerMessage?: string;
    }) => {
      // Store config in ref for immediate access during restoration
      persistentInputConfigRef.current = config;

      // Also store callbacks in state for external access if needed
      setAgentStateInternal((current) => ({
        ...current,
        persistentInputCallbacks: {
          onSubmit: config.onSubmit,
          onInterrupt: config.onInterrupt,
        },
      }));

      setPendingItem({
        type: 'persistent-input',
        props: {
          onSubmit: config.onSubmit,
          onInterrupt: config.onInterrupt,
          placeholder: 'Type a message or press Esc to interrupt...',
          spinnerMessage: config.spinnerMessage,
        } as PersistentInputProps,
        resolve: () => {},
      });
    },
    [],
  );

  // Stop persistent input mode
  const stopPersistentInput = useCallback(() => {
    // Clear the ref
    persistentInputConfigRef.current = null;

    setPendingItem((current) => {
      if (current?.type === 'persistent-input') {
        return null;
      }
      return current;
    });

    setAgentStateInternal((current) => ({
      ...current,
      persistentInputCallbacks: undefined,
    }));
  }, []);

  // Update agent state
  const setAgentState = useCallback((state: Partial<AgentState>) => {
    setAgentStateInternal((current) => ({ ...current, ...state }));
  }, []);

  // Combine actions
  const actions = useMemo<WizardActions>(
    () => ({
      addItem,
      select,
      text,
      confirm,
      spinner,
      resolvePending,
      exit,
      toolApproval,
      clarifyingQuestions,
      startPersistentInput,
      stopPersistentInput,
      setAgentState,
    }),
    [
      addItem,
      select,
      text,
      confirm,
      spinner,
      resolvePending,
      exit,
      toolApproval,
      clarifyingQuestions,
      startPersistentInput,
      stopPersistentInput,
      setAgentState,
    ],
  );

  // Combine state
  const state = useMemo<WizardState>(
    () => ({
      history,
      pendingItem,
      shouldExit,
      agentState,
    }),
    [history, pendingItem, shouldExit, agentState],
  );

  // Context value
  const contextValue = useMemo<WizardContextType>(
    () => ({ state, actions }),
    [state, actions],
  );

  return (
    <WizardContext.Provider value={contextValue}>
      {children}
    </WizardContext.Provider>
  );
}

export { WizardContext };
