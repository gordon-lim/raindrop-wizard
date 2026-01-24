/**
 * Confirm component for Yes/No prompts
 * Maintains API compatibility with clack.confirm()
 */

import type { ConfirmOptions } from '../types';

/**
 * Display a confirmation prompt (Yes/No)
 * Returns true for Yes, false for No, or CANCEL_SYMBOL if user presses Ctrl+C
 */
export async function confirm(
  options: ConfirmOptions,
): Promise<boolean | symbol> {
  // Dynamic import to avoid loading Select at module load time
  const { select } = await import('./Select.js');

  return select({
    message: options.message,
    options: [
      { value: true, label: options.active || 'Yes' },
      { value: false, label: options.inactive || 'No' },
    ],
    initialValue: options.initialValue ?? true,
  });
}
