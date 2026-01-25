/**
 * Confirm prompt component for the unified Ink app.
 * Implements Yes/No selection using ink-select-input.
 */

import React from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { useWizardActions } from '../contexts/WizardContext.js';
import { CANCEL_SYMBOL } from '../cancellation.js';
import { PromptContainer } from './PromptContainer.js';
import type { ConfirmOptions } from '../types.js';

interface ConfirmPromptProps {
  options: ConfirmOptions;
}

/**
 * Confirm prompt that integrates with the wizard context
 */
export function ConfirmPrompt({ options }: ConfirmPromptProps): React.ReactElement {
  const { resolvePending, addItem } = useWizardActions();

  // Handle Ctrl+C cancellation
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      addItem({
        type: 'confirm-result',
        text: options.message,
        label: '(cancelled)',
      });
      resolvePending(CANCEL_SYMBOL);
    }
  });

  // Create Yes/No options
  const items = [
    { label: options.active || 'Yes', value: true },
    { label: options.inactive || 'No', value: false },
  ];

  // Determine initial index based on initialValue
  const initialIndex = options.initialValue === false ? 1 : 0;

  // Handle selection
  const handleSelect = (item: { value: boolean; label: string }) => {
    addItem({
      type: 'confirm-result',
      text: options.message,
      label: item.label,
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
  }: {
    isSelected: boolean;
    label: string;
  }) => <Text color={isSelected ? 'cyan' : undefined}>{label}</Text>;

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

export default ConfirmPrompt;
