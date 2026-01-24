/**
 * Re-export ink prompts for consistent usage across the codebase.
 *
 * Note: ink is an ESM-only package with top-level await, but this project compiles to CommonJS.
 * We split components into two groups:
 * - Non-ink components (Message, Logger) can be imported synchronously
 * - Ink-dependent components (Select, Confirm, TextInput, Spinner) need dynamic imports
 */

// Import non-ink components directly (they don't use ink, just console.log)
import { intro, outro, note, cancel } from '../ui/components/Message';
import {
  log,
  logTaskResult,
  logResult,
  logTask,
} from '../ui/components/Logger';
import { isCancel } from '../ui/cancellation';

// Dynamic imports for ink-dependent components
async function select<T>(options: any): Promise<T | symbol> {
  const { select: selectFn } = await import('../ui/components/Select.js');
  return selectFn(options);
}

async function confirm(options: any): Promise<boolean | symbol> {
  const { confirm: confirmFn } = await import('../ui/components/Confirm.js');
  return confirmFn(options);
}

async function text(options: any): Promise<string | symbol> {
  const { text: textFn } = await import('../ui/components/TextInput.js');
  return textFn(options);
}

function spinner(): any {
  // Create a lazy-loading spinner that dynamically imports when start() is called
  let realSpinner: any = null;
  let spinnerPromise: Promise<any> | null = null;

  const ensureSpinner = async () => {
    if (!realSpinner) {
      if (!spinnerPromise) {
        spinnerPromise = (async () => {
          const { spinner: spinnerFn } = await import(
            '../ui/components/Spinner.js'
          );
          realSpinner = await spinnerFn();
          return realSpinner;
        })();
      }
      await spinnerPromise;
    }
    return realSpinner;
  };

  return {
    start: async (msg?: string) => {
      const s = await ensureSpinner();
      s.start(msg);
    },
    stop: (msg?: string) => {
      if (realSpinner) {
        realSpinner.stop(msg);
      }
    },
    message: (msg: string) => {
      if (realSpinner) {
        realSpinner.message(msg);
      }
    },
  };
}

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
};

export default inkPrompts;
