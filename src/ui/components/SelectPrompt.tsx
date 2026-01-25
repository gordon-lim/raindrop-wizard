/**
 * Select prompt component for the unified Ink app.
 * Uses ink-select-input and dispatches results through WizardContext.
 */

import React, { useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { useWizardActions } from '../contexts/WizardContext.js';
import { CANCEL_SYMBOL } from '../cancellation.js';
import { PromptContainer } from './PromptContainer.js';
import type { SelectOptions } from '../types.js';

interface SelectPromptProps {
  options: SelectOptions<unknown>;
}

/**
 * Select prompt that integrates with the wizard context
 */
export function SelectPrompt({ options }: SelectPromptProps): React.ReactElement {
  const { resolvePending, addItem } = useWizardActions();

  // Handle Ctrl+C cancellation
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      addItem({
        type: 'select-result',
        text: options.message,
        label: '(cancelled)',
      });
      resolvePending(CANCEL_SYMBOL);
    }
  });

  // Format items for ink-select-input
  const items = useMemo(
    () =>
      options.options.map((opt, index) => {
        const number = `${index + 1}.`;
        const label = `${number} ${opt.label}`;

        return {
          label,
          value: opt.value,
          originalLabel: opt.label,
          hint: opt.hint,
        };
      }),
    [options.options],
  );

  // Find initial index
  const initialIndex = useMemo(() => {
    if (options.initialValue === undefined) return 0;
    const idx = options.options.findIndex(
      (opt) => opt.value === options.initialValue,
    );
    return idx >= 0 ? idx : 0;
  }, [options.options, options.initialValue]);

  // Handle selection
  const handleSelect = (item: { value: unknown; originalLabel?: string }) => {
    addItem({
      type: 'select-result',
      text: options.message,
      label: item.originalLabel || String(item.value),
    });
    resolvePending(item.value);
  };

  // Custom indicator component
  const indicatorComponent = ({ isSelected }: { isSelected: boolean }) => (
    <Text color="cyan">{isSelected ? '›' : ' '}</Text>
  );

  // Custom item component
  const itemComponent = ({
    isSelected,
    label,
    hint,
  }: {
    isSelected: boolean;
    label: string;
    hint?: string;
  }) => (
    <Box flexDirection="column">
      <Text color={isSelected ? 'cyan' : undefined}>{label}</Text>
      {hint && (
        <Text dimColor>   {hint}</Text>
      )}
    </Box>
  );

  return (
    <PromptContainer>
      <Text>{options.message}</Text>
      <Box marginTop={1}>
        <SelectInput
          items={items}
          initialIndex={initialIndex}
          indicatorComponent={indicatorComponent}
          itemComponent={itemComponent}
          onSelect={handleSelect}
        />
      </Box>
    </PromptContainer>
  );
}

export default SelectPrompt;
