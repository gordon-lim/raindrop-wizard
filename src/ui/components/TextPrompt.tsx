/**
 * Text input prompt component for the unified Ink app.
 * Uses ink-text-input and dispatches results through WizardContext.
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useWizardActions } from '../contexts/WizardContext.js';
import { CANCEL_SYMBOL } from '../cancellation.js';
import { PromptContainer } from './PromptContainer.js';
import type { TextOptions } from '../types.js';

interface TextPromptProps {
  options: TextOptions;
}

/**
 * Text input prompt that integrates with the wizard context
 */
export function TextPrompt({ options }: TextPromptProps): React.ReactElement {
  const { resolvePending, addItem } = useWizardActions();
  const [value, setValue] = useState(options.defaultValue || options.initialValue || '');
  const [error, setError] = useState<string | null>(null);

  // Handle Ctrl+C cancellation
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      addItem({
        type: 'text-result',
        text: options.message,
        label: '(cancelled)',
      });
      resolvePending(CANCEL_SYMBOL);
    }
  });

  // Handle submission
  const handleSubmit = (submittedValue: string) => {
    // Validate if validator provided
    if (options.validate) {
      const validationError = options.validate(submittedValue);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    addItem({
      type: 'text-result',
      text: options.message,
      label: submittedValue || '(empty)',
    });
    resolvePending(submittedValue);
  };

  return (
    <PromptContainer>
      {options.message && <Text>{options.message}</Text>}
      <Box marginTop={options.message ? 1 : 0}>
        <Text color="cyan">› </Text>
        <TextInput
          value={value}
          onChange={(newValue) => {
            setValue(newValue);
            if (error) setError(null);
          }}
          placeholder={options.placeholder}
          onSubmit={handleSubmit}
        />
      </Box>
      {error && (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}
    </PromptContainer>
  );
}

export default TextPrompt;
