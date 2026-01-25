/**
 * Persistent text input component for agent execution.
 * Shown during agent execution when no approval prompt is active.
 * Allows users to send follow-up messages or interrupt the agent.
 * Includes a spinner to show the agent is working.
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import InkSpinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import { PromptContainer } from './PromptContainer.js';
import type { PersistentInputProps } from '../types.js';

interface PersistentTextInputComponentProps {
  props: PersistentInputProps;
}

/**
 * Persistent text input that remains visible during agent execution.
 * - Shows spinner indicating agent is working
 * - Submit messages with Enter
 * - Interrupt agent with Escape or Ctrl+C
 */
export function PersistentTextInput({
  props,
}: PersistentTextInputComponentProps): React.ReactElement {
  const { onSubmit, onInterrupt, placeholder, spinnerMessage } = props;
  const [value, setValue] = useState('');
  const [lastKey, setLastKey] = useState('');

  // Handle Escape and Ctrl+C for interruption
  // Note: Escape key sends '\x1b' (ASCII 27) in some terminals
  useInput((input, key) => {
    // Debug: track last key for visibility
    setLastKey(key.escape ? 'ESC' : key.ctrl ? `Ctrl+${input}` : input || '?');
    
    if (key.escape || input === '\x1b' || (key.ctrl && input === 'c')) {
      onInterrupt();
    }
  });

  // Handle submission
  const handleSubmit = (submittedValue: string) => {
    if (submittedValue.trim()) {
      onSubmit(submittedValue.trim());
      setValue('');
    }
  };

  return (
    <Box flexDirection="column">
      {/* Spinner above the container */}
      <Box marginBottom={1}>
        <Text color="cyan">
          <InkSpinner type="dots" />
        </Text>
        <Text> {spinnerMessage || 'Agent is working...'}</Text>
        {lastKey && <Text dimColor> [key: {lastKey}]</Text>}
      </Box>

      <PromptContainer>
        {/* Text input */}
        <Box>
          <Text color="cyan">› </Text>
          <TextInput
            value={value}
            onChange={setValue}
            placeholder={placeholder || 'Type a message or Esc to interrupt...'}
            onSubmit={handleSubmit}
          />
        </Box>
      </PromptContainer>
    </Box>
  );
}

export default PersistentTextInput;
