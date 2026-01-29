/**
 * Feedback select prompt component.
 * A reusable select prompt where one option can enable inline text input.
 * Used by PlanApprovalPrompt and test-server for "yes/no with feedback" patterns.
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useWizard } from '../contexts/WizardContext.js';
import { PromptContainer } from './PromptContainer.js';
import { CANCEL_SYMBOL } from '../cancellation.js';
import type {
  FeedbackSelectOptions,
  FeedbackSelectResult,
  FeedbackSelectOption,
} from '../types.js';

interface FeedbackSelectPromptProps<T> {
  options: FeedbackSelectOptions<T>;
  /** Optional callback for when result is ready (used by PlanApprovalPrompt) */
  onResult?: (result: FeedbackSelectResult<T>) => void;
  /** If true, this component manages its own resolution via WizardContext */
  standalone?: boolean;
}

/**
 * Feedback select prompt that supports inline text input for specific options.
 * Can be used standalone (resolves via WizardContext) or embedded (via onResult callback).
 */
export function FeedbackSelectPrompt<T>({
  options,
  onResult,
  standalone = true,
}: FeedbackSelectPromptProps<T>): React.ReactElement {
  const { actions } = useWizard();
  const { resolvePending, addItem } = actions;

  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isTypingMode, setIsTypingMode] = useState(false);
  const [customText, setCustomText] = useState('');

  // Handle submitting a result
  const submitResult = useCallback(
    (result: FeedbackSelectResult<T>) => {
      if (onResult) {
        // Embedded mode - call the callback
        onResult(result);
      } else if (standalone) {
        // Standalone mode - resolve via context
        addItem({
          type: 'select-result',
          text: options.message,
          label:
            result.type === 'option'
              ? options.options.find((o) => o.value === result.value)?.label ||
                String(result.value)
              : result.value,
        });
        resolvePending(result);
      }
    },
    [onResult, standalone, addItem, resolvePending, options],
  );

  // Handle selecting a regular option
  const handleOptionSelect = useCallback(
    (option: FeedbackSelectOption<T>) => {
      submitResult({ type: 'option', value: option.value });
    },
    [submitResult],
  );

  // Handle submitting text input
  const handleTextSubmit = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      submitResult({ type: 'text', value: text.trim() });
    },
    [submitResult],
  );

  // Handle keyboard input
  useInput(
    (input, key) => {
      // Handle Ctrl+C cancellation
      if (key.ctrl && input === 'c') {
        if (standalone) {
          addItem({
            type: 'select-result',
            text: options.message,
            label: '(cancelled)',
          });
          resolvePending(CANCEL_SYMBOL);
        }
        return;
      }

      // Escape handling
      if (key.escape) {
        if (isTypingMode) {
          setIsTypingMode(false);
        }
        return;
      }

      // Skip other keys when typing - TextInput handles them
      if (isTypingMode) {
        return;
      }

      // Arrow navigation
      if (key.upArrow) {
        setHighlightedIndex((idx) => Math.max(0, idx - 1));
        return;
      }
      if (key.downArrow) {
        setHighlightedIndex((idx) =>
          Math.min(options.options.length - 1, idx + 1),
        );
        return;
      }

      // Enter to select
      if (key.return) {
        const selected = options.options[highlightedIndex];
        if (selected.allowTextInput) {
          setIsTypingMode(true);
        } else {
          handleOptionSelect(selected);
        }
      }
    },
    { isActive: true },
  );

  return (
    <PromptContainer>
      {/* Message */}
      <Box marginBottom={1}>
        <Text>{options.message}</Text>
      </Box>

      {/* Options */}
      <Box flexDirection="column">
        {options.options.map((option, index) => {
          const isHighlighted = index === highlightedIndex;
          const isTextOption = option.allowTextInput;
          const indicator = isHighlighted ? '› ' : '  ';

          // Text input option in typing mode
          if (isTextOption && isTypingMode && index === highlightedIndex) {
            return (
              <Box key={index}>
                <Text color="cyan">
                  {indicator}
                  {index + 1}.{' '}
                </Text>
                <TextInput
                  value={customText}
                  onChange={setCustomText}
                  onSubmit={handleTextSubmit}
                  focus={true}
                  placeholder=""
                />
              </Box>
            );
          }

          // Regular option display
          return (
            <Box key={index}>
              <Text color={isHighlighted ? 'cyan' : undefined}>
                {indicator}
                {index + 1}. {option.label}
              </Text>
            </Box>
          );
        })}
      </Box>
    </PromptContainer>
  );
}

export default FeedbackSelectPrompt;
