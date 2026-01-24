/**
 * Single render entry point for the unified Ink app.
 * Only one render() call is made for the entire wizard session.
 */

import React from 'react';
import { render } from 'ink';
import { WizardApp } from './App.js';
import {
  WizardProvider,
  useWizardActions as useActions,
  type WizardActions,
} from './contexts/WizardContext.js';

/**
 * Instance returned by startWizardUI
 */
export interface WizardInstance {
  /** Wait for the wizard to exit */
  waitUntilExit: () => Promise<void>;
  /** Unmount the wizard UI */
  unmount: () => void;
  /** Clear the screen */
  clear: () => void;
  /** Get the wizard actions for programmatic control */
  actions: WizardActions | null;
  /** Wait for the wizard to be ready (actions available) */
  waitUntilReady: () => Promise<void>;
}

// Global reference to the current wizard actions
let currentActions: WizardActions | null = null;

// Promise that resolves when actions are ready
let actionsReadyResolve: (() => void) | null = null;
let actionsReadyPromise: Promise<void> | null = null;

/**
 * Get the current wizard actions.
 * Returns null if the wizard hasn't been started yet.
 */
export function getWizardActions(): WizardActions | null {
  return currentActions;
}

/**
 * Set the current wizard actions (called from WizardActionsCapture)
 */
function setWizardActions(actions: WizardActions): void {
  currentActions = actions;
  // Resolve the ready promise when actions are available
  if (actionsReadyResolve) {
    actionsReadyResolve();
    actionsReadyResolve = null;
  }
}

/**
 * Component that captures actions from context and exposes them globally
 */
function WizardActionsCapture({
  children,
  onActions,
}: {
  children: React.ReactNode;
  onActions: (actions: WizardActions) => void;
}): React.ReactElement {
  const actions = useActions();

  // Call onActions synchronously during render to ensure it's set before returning
  React.useMemo(() => {
    onActions(actions);
  }, [actions, onActions]);

  return <>{children}</>;
}

/**
 * Start the wizard UI with a single Ink render call.
 * All prompts and spinners will use this single instance.
 */
export function startWizardUI(): WizardInstance {
  // Create the ready promise
  actionsReadyPromise = new Promise<void>((resolve) => {
    actionsReadyResolve = resolve;
  });

  let resolveExit: () => void;
  const exitPromise = new Promise<void>((resolve) => {
    resolveExit = resolve;
  });

  const handleExit = () => {
    resolveExit();
  };

  // Create the app with WizardProvider that captures actions
  const App = () => (
    <WizardProvider onExit={handleExit}>
      <WizardActionsCapture onActions={setWizardActions}>
        <WizardApp />
      </WizardActionsCapture>
    </WizardProvider>
  );

  const instance = render(<App />, {
    exitOnCtrlC: false, // We handle Ctrl+C in components
  });

  return {
    waitUntilExit: async () => {
      await exitPromise;
      instance.unmount();
    },
    unmount: () => {
      currentActions = null;
      actionsReadyPromise = null;
      actionsReadyResolve = null;
      instance.unmount();
    },
    clear: () => {
      instance.clear();
    },
    get actions() {
      return currentActions;
    },
    waitUntilReady: async () => {
      if (actionsReadyPromise) {
        await actionsReadyPromise;
      }
    },
  };
}

/**
 * Check if the wizard UI is running
 */
export function isWizardRunning(): boolean {
  return currentActions !== null;
}
