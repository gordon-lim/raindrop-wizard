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
} from '../types.js';

/**
 * Types of items that can appear in the history (Static section)
 */
export type HistoryItemType =
  | 'logo'
  | 'intro'
  | 'outro'
  | 'note'
  | 'cancel'
  | 'log-info'
  | 'log-warn'
  | 'log-error'
  | 'log-success'
  | 'log-step'
  | 'select-result'
  | 'text-result'
  | 'confirm-result'
  | 'spinner-result';

/**
 * A completed item that goes into the Static history
 */
export interface HistoryItem {
  id: number;
  type: HistoryItemType;
  content: string;
  /** Optional secondary content (e.g., selected option label) */
  label?: string;
  /** Optional hint/description */
  hint?: string;
  /** Title for note items */
  title?: string;
}

/**
 * Types of pending prompts that can be active
 */
export type PendingItemType = 'select' | 'text' | 'confirm' | 'spinner';

/**
 * A pending item represents an active prompt or spinner
 */
export interface PendingItem {
  type: PendingItemType;
  props: SelectOptions<unknown> | TextOptions | ConfirmOptions | SpinnerProps;
  resolve: (value: unknown) => void;
  reject?: (error: Error) => void;
}

/**
 * Spinner-specific props
 */
export interface SpinnerProps {
  message: string;
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
}

/**
 * Actions to modify wizard state
 */
export interface WizardActions {
  /** Add an item to history */
  addHistoryItem: (
    item: Omit<HistoryItem, 'id'>,
  ) => void;

  /** Display a select prompt and return the selected value */
  showSelect: <T>(options: SelectOptions<T>) => Promise<T | symbol>;

  /** Display a text input prompt and return the entered value */
  showText: (options: TextOptions) => Promise<string | symbol>;

  /** Display a confirm prompt and return the boolean result */
  showConfirm: (options: ConfirmOptions) => Promise<boolean | symbol>;

  /** Display a spinner and return control methods */
  showSpinner: () => SpinnerInstance;

  /** Resolve the current pending item with a value */
  resolvePending: (value: unknown) => void;

  /** Mark the app as ready to exit */
  exit: () => void;

  /** Log functions that add to history */
  log: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
    success: (msg: string) => void;
    step: (msg: string) => void;
  };

  /** Message functions */
  intro: (message: string) => void;
  outro: (message: string) => void;
  note: (message: string, title?: string) => void;
  cancel: (message?: string) => void;

  /** Display the logo */
  showLogo: () => void;
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

  // Counter for unique IDs
  const idCounter = useRef(0);

  // Get next unique ID
  const getNextId = useCallback(() => {
    return ++idCounter.current;
  }, []);

  // Add item to history
  const addHistoryItem = useCallback(
    (item: Omit<HistoryItem, 'id'>) => {
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
  const showSelect = useCallback(
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
  const showText = useCallback((options: TextOptions): Promise<string | symbol> => {
    return new Promise((resolve) => {
      setPendingItem({
        type: 'text',
        props: options,
        resolve: resolve as (value: unknown) => void,
      });
    });
  }, []);

  // Show confirm prompt
  const showConfirm = useCallback(
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
  const spinnerMessage = useRef<string>('');

  // Show spinner
  const showSpinner = useCallback((): SpinnerInstance => {
    return {
      start: (msg = '') => {
        spinnerMessage.current = msg;
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
          addHistoryItem({ type: 'spinner-result', content: msg });
        }
        setPendingItem(null);
      },
      message: (msg: string) => {
        spinnerMessage.current = msg;
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
  }, [addHistoryItem]);

  // Exit the app
  const exit = useCallback(() => {
    setShouldExit(true);
    onExit?.();
  }, [onExit]);

  // Log functions
  const log = useMemo(
    () => ({
      info: (msg: string) => addHistoryItem({ type: 'log-info', content: msg }),
      warn: (msg: string) => addHistoryItem({ type: 'log-warn', content: msg }),
      error: (msg: string) => addHistoryItem({ type: 'log-error', content: msg }),
      success: (msg: string) => addHistoryItem({ type: 'log-success', content: msg }),
      step: (msg: string) => addHistoryItem({ type: 'log-step', content: msg }),
    }),
    [addHistoryItem],
  );

  // Message functions
  const intro = useCallback(
    (message: string) => addHistoryItem({ type: 'intro', content: message }),
    [addHistoryItem],
  );

  const outro = useCallback(
    (message: string) => addHistoryItem({ type: 'outro', content: message }),
    [addHistoryItem],
  );

  const note = useCallback(
    (message: string, title?: string) =>
      addHistoryItem({ type: 'note', content: message, title }),
    [addHistoryItem],
  );

  const cancelMsg = useCallback(
    (message = 'Operation cancelled') =>
      addHistoryItem({ type: 'cancel', content: message }),
    [addHistoryItem],
  );

  // Show logo
  const showLogo = useCallback(
    () => addHistoryItem({ type: 'logo', content: '' }),
    [addHistoryItem],
  );

  // Combine actions
  const actions = useMemo<WizardActions>(
    () => ({
      addHistoryItem,
      showSelect,
      showText,
      showConfirm,
      showSpinner,
      resolvePending,
      exit,
      log,
      intro,
      outro,
      note,
      cancel: cancelMsg,
      showLogo,
    }),
    [
      addHistoryItem,
      showSelect,
      showText,
      showConfirm,
      showSpinner,
      resolvePending,
      exit,
      log,
      intro,
      outro,
      note,
      cancelMsg,
      showLogo,
    ],
  );

  // Combine state
  const state = useMemo<WizardState>(
    () => ({
      history,
      pendingItem,
      shouldExit,
    }),
    [history, pendingItem, shouldExit],
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
