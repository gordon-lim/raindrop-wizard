/**
 * Select component wrapping ink-select-input
 * Maintains API compatibility with clack.select()
 *
 * Uses dynamic imports to avoid loading ink at module load time
 */

import chalk from 'chalk';
import type { SelectOptions } from '../types';

/**
 * Display a select menu and return the selected value
 * Returns CANCEL_SYMBOL if user presses Ctrl+C
 */
export async function select<T>(
  options: SelectOptions<T>,
): Promise<T | symbol> {
  // Dynamic imports to avoid requiring ink at load time
  const React = await import('react');
  const { render, Box, Text, useInput } = await import('ink');
  const SelectInput = (await import('ink-select-input')).default;
  const { CANCEL_SYMBOL, createCancellationHandler } = await import(
    '../hooks/useCancellation.js'
  );

  return new Promise((resolve) => {
    const SelectComponent = () => {
      // Create the useCancellation hook with useInput from ink
      const useCancellation = createCancellationHandler(useInput);
      useCancellation(() => {
        unmount();
        resolve(CANCEL_SYMBOL);
      });

      // Format items with better styling for descriptions
      const items = options.options.map((opt, index) => {
        const number = `${index + 1}.`;
        let label = `${number} ${opt.label}`;

        if (opt.hint) {
          // Multi-line format with indented description
          label = `${number} ${opt.label}\n   ${chalk.dim(opt.hint)}`;
        }

        return {
          label,
          value: opt.value,
        };
      });

      // Find initial index if initialValue is provided
      const initialIndex =
        options.initialValue !== undefined
          ? options.options.findIndex(
              (opt) => opt.value === options.initialValue,
            )
          : undefined;

      // Custom indicator and item components
      const indicatorComponent = ({ isSelected }: any) =>
        React.createElement(Text, null, isSelected ? chalk.cyan('›') : ' ');

      const itemComponent = ({ isSelected, label }: any) =>
        React.createElement(Text, null, isSelected ? chalk.cyan(label) : label);

      return React.createElement(
        Box,
        { flexDirection: 'column' },
        React.createElement(Text, null, '\n' + options.message + '\n'),
        React.createElement(SelectInput, {
          items,
          initialIndex:
            initialIndex !== undefined && initialIndex >= 0 ? initialIndex : 0,
          indicatorComponent,
          itemComponent,
          onSelect: (item) => {
            unmount();
            resolve(item.value as T);
          },
        }),
      );
    };

    const { unmount } = render(React.createElement(SelectComponent));
  });
}
