/**
 * Text input component wrapping ink-text-input
 * Maintains API compatibility with clack.text()
 *
 * Uses dynamic imports to avoid loading ink at module load time
 */

import type { TextOptions } from '../types';
import { log } from './Logger';

/**
 * Display a text input prompt
 * Returns the entered text or CANCEL_SYMBOL if user presses Ctrl+C
 */
export async function text(options: TextOptions): Promise<string | symbol> {
  // Dynamic imports to avoid requiring ink at load time
  const React = await import('react');
  const { render, Box, Text, useInput } = await import('ink');
  const InkTextInput = (await import('ink-text-input')).default;
  const { CANCEL_SYMBOL, createCancellationHandler } = await import(
    '../hooks/useCancellation.js'
  );

  return new Promise((resolve) => {
    const TextComponent = () => {
      const [value, setValue] = React.useState(
        options.defaultValue || options.initialValue || '',
      );

      // Create the useCancellation hook with useInput from ink
      const useCancellation = createCancellationHandler(useInput);
      useCancellation(() => {
        unmount();
        resolve(CANCEL_SYMBOL);
      });

      const handleSubmit = () => {
        if (options.validate) {
          const error = options.validate(value);
          if (error) {
            log.error(error);
            return;
          }
        }
        unmount();
        resolve(value);
      };

      return React.createElement(
        Box,
        { flexDirection: 'column' },
        React.createElement(Text, null, options.message),
        React.createElement(InkTextInput, {
          value,
          onChange: setValue,
          placeholder: options.placeholder,
          onSubmit: handleSubmit,
        }),
      );
    };

    const { unmount } = render(React.createElement(TextComponent));
  });
}
