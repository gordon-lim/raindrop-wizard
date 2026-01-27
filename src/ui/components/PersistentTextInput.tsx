/**
 * Unified text input component for the wizard.
 * 
 * Two modes:
 * 1. Callback mode: Uses onSubmit/onInterrupt callbacks (for persistent input during agent execution)
 * 2. Context mode: Uses resolvePending from WizardContext (for standalone text prompts)
 * 
 * Note: Spinner is managed separately via ui.spinner() - this component is just the input.
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { PromptContainer } from './PromptContainer.js';
import { useWizardActions } from '../contexts/WizardContext.js';
import { CANCEL_SYMBOL } from '../cancellation.js';
import type { PersistentInputProps } from '../types.js';

interface PersistentTextInputComponentProps {
  props: PersistentInputProps;
}

/**
 * Unified text input component.
 * - With callbacks (onSubmit/onInterrupt): Uses callbacks for submit/interrupt
 * - Without callbacks: Uses resolvePending from context (text prompt mode)
 */
export function PersistentTextInput({
  props,
}: PersistentTextInputComponentProps): React.ReactElement {
  const {
    placeholder,
    message,
    defaultValue,
    validate,
    onSubmit,
    onInterrupt,
  } = props;

  const { resolvePending, addItem } = useWizardActions();
  const [value, setValue] = useState(defaultValue || '');
  const [error, setError] = useState<string | null>(null);

  // Handle Escape and Ctrl+C
  useInput((input, key) => {
    if (key.escape || input === '\x1b' || (key.ctrl && input === 'c')) {
      if (onInterrupt) {
        // Has interrupt callback - use it
        onInterrupt();
      } else {
        // No callback - cancel via resolvePending (text prompt mode)
        addItem({
          type: 'text-result',
          text: message || '',
          label: '(cancelled)',
        });
        resolvePending(CANCEL_SYMBOL);
      }
    }
  });

  // Handle submission
  const handleSubmit = (submittedValue: string) => {
    // Validate if validator provided
    if (validate) {
      const validationError = validate(submittedValue);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    if (onSubmit) {
      // Has submit callback - use it
      if (submittedValue.trim()) {
        onSubmit(submittedValue.trim());
        setValue('');
      }
    } else {
      // No callback - resolve via context (text prompt mode)
      resolvePending(submittedValue);
    }
  };

  return (
    <PromptContainer>
      {/* Message */}
      {message && <Text>{message}</Text>}

      {/* Text input */}
      <Box marginTop={message ? 1 : 0}>
        <Text color="cyan">› </Text>
        <TextInput
          value={value}
          onChange={(newValue) => {
            setValue(newValue);
            if (error) setError(null);
          }}
          placeholder={placeholder || 'Type a message or Esc to interrupt...'}
          onSubmit={handleSubmit}
        />
      </Box>

      {/* Validation error */}
      {error && (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}
    </PromptContainer>
  );
}

export default PersistentTextInput;
