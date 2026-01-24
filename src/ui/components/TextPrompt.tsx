/**
 * Text input prompt component for the unified Ink app.
 * Uses ink-text-input and dispatches results through WizardContext.
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useWizardActions } from '../contexts/WizardContext.js';
import { CANCEL_SYMBOL } from '../cancellation.js';
import type { TextOptions } from '../types.js';

interface TextPromptProps {
  options: TextOptions;
}

/**
 * Text input prompt that integrates with the wizard context
 */
export function TextPrompt({ options }: TextPromptProps): React.ReactElement {
  const { resolvePending, addHistoryItem, log } = useWizardActions();
  const [value, setValue] = useState(options.defaultValue || options.initialValue || '');

  // Handle Ctrl+C cancellation
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      addHistoryItem({
        type: 'text-result',
        content: options.message,
        label: '(cancelled)',
      });
      resolvePending(CANCEL_SYMBOL);
    }
  });

  // Handle submission
  const handleSubmit = (submittedValue: string) => {
    // Validate if validator provided
    if (options.validate) {
      const error = options.validate(submittedValue);
      if (error) {
        log.error(error);
        return;
      }
    }

    addHistoryItem({
      type: 'text-result',
      content: options.message,
      label: submittedValue || '(empty)',
    });
    resolvePending(submittedValue);
  };

  return (
    <Box flexDirection="column">
      <Text>{options.message}</Text>
      <Box marginTop={1}>
        <Text color="cyan">› </Text>
        <TextInput
          value={value}
          onChange={setValue}
          placeholder={options.placeholder}
          onSubmit={handleSubmit}
        />
      </Box>
    </Box>
  );
}

export default TextPrompt;
