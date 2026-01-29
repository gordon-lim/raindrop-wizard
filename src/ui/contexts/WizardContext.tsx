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
  SpinnerInstance,
  ToolApprovalProps,
  ToolApprovalResult,
  ClarifyingQuestionsProps,
  ClarifyingQuestionsResult,
  PlanApprovalProps,
  PlanApprovalResult,
  PersistentInputProps,
  ToolCallInfo,
  AgentQueryHandle,
  FeedbackSelectOptions,
  FeedbackSelectResult,
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
  | 'spinner-result'
  | 'tool-call'
  | 'agent-message'
  | 'user-message'
  | 'clarifying-questions-result'
  | 'declined-questions'
  | 'received-event'
  | 'plan-approved'
  | 'plan-rejected';

/**
 * Data for received-event history items
 */
export interface ReceivedEventData {
  id: string;
  eventName: string;
  timestamp?: string;
  model?: string;
  userId?: string;
  input?: string;
  output?: string;
}

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
  /** For received-event items, the event data */
  receivedEvent?: ReceivedEventData;
  /** For plan-approved and plan-rejected items, the plan content */
  planContent?: string;
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
  | 'spinner'
  | 'tool-approval'
  | 'clarifying-questions'
  | 'plan-approval'
  | 'persistent-input'
  | 'feedback-select';

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
  | SpinnerProps
  | ToolApprovalProps
  | ClarifyingQuestionsProps
  | PlanApprovalProps
  | PersistentInputProps
  | FeedbackSelectOptions<unknown>;

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
  /** Currently active prompt (rendered as pending) */
  pendingItem: PendingItem | null;
  /** Whether the app is ready to exit */
  shouldExit: boolean;
  /** Agent execution state */
  agentState: AgentState;
  /** Active spinner message (separate from pendingItem so both can be visible) */
  activeSpinner: string | null;
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
   * Show plan approval prompt (replaces persistent-input, restores after)
   * Used by canUseTool handler for ExitPlanMode tool
   */
  planApproval: (props: PlanApprovalProps) => Promise<PlanApprovalResult>;

  /**
   * Show feedback select prompt (select with inline text input option)
   * Used for "yes/no with feedback" patterns
   */
  feedbackSelect: <T>(
    options: FeedbackSelectOptions<T>,
  ) => Promise<FeedbackSelectResult<T>>;

  /**
   * Start persistent input mode during agent execution
   * Sets pendingItem to persistent-input type
   */
  startPersistentInput: (config: {
    onSubmit: (message: string) => void;
    onInterrupt: () => void;
    message?: string;
    placeholder?: string;
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
  // Queue of pending items - processes one at a time, FIFO order
  // This allows multiple tool approvals to be queued without losing earlier ones
  // Note: persistent-input is NOT stored in queue, it's a fallback shown when queue is empty
  const [pendingQueue, setPendingQueue] = useState<PendingItem[]>([]);
  const [shouldExit, setShouldExit] = useState(false);
  const [agentState, setAgentStateInternal] = useState<AgentState>({
    isRunning: false,
  });
  // Spinner state - separate from pendingItem so both can be visible
  const [activeSpinner, setActiveSpinner] = useState<string | null>(null);

  // Persistent input config - stored separately, shown as fallback when queue is empty
  const [persistentInputConfig, setPersistentInputConfig] = useState<{
    onSubmit: (message: string) => void;
    onInterrupt: () => void;
    message?: string;
    placeholder?: string;
  } | null>(null);

  // Derive current pending item:
  // 1. If queue has items → show first item in queue
  // 2. If queue is empty AND persistent input is active → show persistent input
  // 3. Otherwise → null
  const pendingItem: PendingItem | null = useMemo(() => {
    if (pendingQueue.length > 0) {
      return pendingQueue[0];
    }
    if (persistentInputConfig) {
      return {
        type: 'persistent-input',
        props: {
          onSubmit: persistentInputConfig.onSubmit,
          onInterrupt: persistentInputConfig.onInterrupt,
          placeholder:
            persistentInputConfig.placeholder ??
            'Type a message or press Esc to interrupt...',
          message: persistentInputConfig.message,
        } as PersistentInputProps,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        resolve: () => {},
      };
    }
    return null;
  }, [pendingQueue, persistentInputConfig]);

  // Counter for unique IDs
  const idCounter = useRef(0);

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

  // Resolve current pending item and advance the queue
  const resolvePending = useCallback((value: unknown) => {
    setPendingQueue((queue) => {
      if (queue.length > 0) {
        // Resolve the first item in the queue
        queue[0].resolve(value);
        // Return the queue without the first item (shift)
        return queue.slice(1);
      }
      return queue;
    });
  }, []);

  // Show select prompt - adds to queue
  const select = useCallback(
    <T,>(options: SelectOptions<T>): Promise<T | symbol> => {
      return new Promise((resolve) => {
        setPendingQueue((queue) => [
          ...queue,
          {
            type: 'select',
            props: options as SelectOptions<unknown>,
            resolve: resolve as (value: unknown) => void,
          },
        ]);
      });
    },
    [],
  );

  // Show text prompt - adds to queue
  const text = useCallback((options: TextOptions): Promise<string | symbol> => {
    return new Promise((resolve) => {
      setPendingQueue((queue) => [
        ...queue,
        {
          type: 'text',
          props: options,
          resolve: resolve as (value: unknown) => void,
        },
      ]);
    });
  }, []);

  // Show spinner - uses separate activeSpinner state so it can be visible alongside pendingItem
  const spinner = useCallback((): SpinnerInstance => {
    return {
      start: (msg = '') => {
        setActiveSpinner(msg || 'Working...');
      },
      stop: (msg = '') => {
        if (msg) {
          addItem({ type: 'spinner-result', text: msg });
        }
        setActiveSpinner(null);
      },
      message: (msg: string) => {
        setActiveSpinner(msg);
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

  // Show tool approval prompt - adds to queue
  // Persistent input automatically shows when queue becomes empty (it's a fallback, not in queue)
  const toolApproval = useCallback(
    (props: ToolApprovalProps): Promise<ToolApprovalResult> => {
      return new Promise((resolve) => {
        setPendingQueue((queue) => [
          ...queue,
          {
            type: 'tool-approval',
            props,
            resolve: resolve as (value: unknown) => void,
          },
        ]);
      });
    },
    [],
  );

  // Show clarifying questions prompt - adds to queue
  // Persistent input automatically shows when queue becomes empty
  const clarifyingQuestions = useCallback(
    (props: ClarifyingQuestionsProps): Promise<ClarifyingQuestionsResult> => {
      return new Promise((resolve) => {
        setPendingQueue((queue) => [
          ...queue,
          {
            type: 'clarifying-questions',
            props,
            resolve: resolve as (value: unknown) => void,
          },
        ]);
      });
    },
    [],
  );

  // Show plan approval prompt - adds to queue
  // Persistent input automatically shows when queue becomes empty
  const planApproval = useCallback(
    (props: PlanApprovalProps): Promise<PlanApprovalResult> => {
      return new Promise((resolve) => {
        setPendingQueue((queue) => [
          ...queue,
          {
            type: 'plan-approval',
            props,
            resolve: resolve as (value: unknown) => void,
          },
        ]);
      });
    },
    [],
  );

  // Show feedback select prompt - adds to queue
  const feedbackSelect = useCallback(
    <T,>(
      options: FeedbackSelectOptions<T>,
    ): Promise<FeedbackSelectResult<T>> => {
      return new Promise((resolve) => {
        setPendingQueue((queue) => [
          ...queue,
          {
            type: 'feedback-select',
            props: options as FeedbackSelectOptions<unknown>,
            resolve: resolve as (value: unknown) => void,
          },
        ]);
      });
    },
    [],
  );

  // Start persistent input mode - sets config so it shows as fallback when queue is empty
  const startPersistentInput = useCallback(
    (config: {
      onSubmit: (message: string) => void;
      onInterrupt: () => void;
      message?: string;
      placeholder?: string;
    }) => {
      // Store config - persistent input will automatically show when queue is empty
      setPersistentInputConfig(config);

      // Also store callbacks in agent state for external access if needed
      setAgentStateInternal((current) => ({
        ...current,
        persistentInputCallbacks: {
          onSubmit: config.onSubmit,
          onInterrupt: config.onInterrupt,
        },
      }));
    },
    [],
  );

  // Stop persistent input mode - clears config so it no longer shows
  const stopPersistentInput = useCallback(() => {
    setPersistentInputConfig(null);

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
      spinner,
      resolvePending,
      exit,
      toolApproval,
      clarifyingQuestions,
      planApproval,
      feedbackSelect,
      startPersistentInput,
      stopPersistentInput,
      setAgentState,
    }),
    [
      addItem,
      select,
      text,
      spinner,
      resolvePending,
      exit,
      toolApproval,
      clarifyingQuestions,
      planApproval,
      feedbackSelect,
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
      activeSpinner,
    }),
    [history, pendingItem, shouldExit, agentState, activeSpinner],
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
