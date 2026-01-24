/**
 * React hook for handling Ctrl+C cancellation in Ink components
 * This file has ink dependencies and should only be imported dynamically
 *
 * Note: We don't import useInput at the top level to avoid loading ink
 * before it's needed. Instead, we export a factory function.
 */

// Re-export for convenience in components
export { CANCEL_SYMBOL, isCancel } from '../cancellation.js';

/**
 * Create a cancellation handler hook that uses ink's useInput
 * This must be called after ink is dynamically imported
 * @param useInput - The useInput hook from ink
 * @param onCancel - Callback to invoke when user presses Ctrl+C
 */
export function createCancellationHandler(useInput: any) {
  return function useCancellation(onCancel: () => void): void {
    useInput((input: string, key: any) => {
      if (key.ctrl && input === 'c') {
        onCancel();
      }
    });
  };
}
