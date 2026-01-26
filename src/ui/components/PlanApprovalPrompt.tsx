/**
 * Plan approval prompt component.
 * Shows the agent's plan and asks user to approve or provide feedback.
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Markdown from '@inkkit/ink-markdown';
import { useWizard } from '../contexts/WizardContext.js';
import { PromptContainer } from './PromptContainer.js';
import type { PlanApprovalProps, PlanApprovalResult } from '../types.js';

interface PlanApprovalPromptComponentProps {
  props: PlanApprovalProps;
}

/**
 * Plan approval prompt for the ExitPlanMode tool.
 * Displays plan content and allows user to approve or provide feedback.
 */
export function PlanApprovalPrompt({
  props,
}: PlanApprovalPromptComponentProps): React.ReactElement {
  const { planContent } = props;
  const { actions } = useWizard();
  const { resolvePending, addItem } = actions;

  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isTypingMode, setIsTypingMode] = useState(false);
  const [customFeedback, setCustomFeedback] = useState('');

  const options = [
    { label: 'Yes, accept plan', value: 'accept' },
    { label: 'Type something', value: 'feedback' },
  ];

  // Handle keyboard input
  useInput(
    (input, key) => {
      // Escape handling
      if (key.escape) {
        if (isTypingMode) {
          setIsTypingMode(false);
        } else {
          // Default to feedback option
          setHighlightedIndex(1);
        }
        return;
      }

      // Skip other keys when typing
      if (isTypingMode) {
        return;
      }

      // Arrow navigation
      if (key.upArrow) {
        setHighlightedIndex((idx) => Math.max(0, idx - 1));
        return;
      }
      if (key.downArrow) {
        setHighlightedIndex((idx) => Math.min(options.length - 1, idx + 1));
        return;
      }

      // Enter to select
      if (key.return) {
        const selected = options[highlightedIndex];
        if (selected.value === 'accept') {
          handleApprove();
        } else {
          setIsTypingMode(true);
        }
      }
    },
    { isActive: true }
  );

  const handleApprove = useCallback(() => {
    addItem({
      type: 'plan-approved',
      text: 'User approved plan',
      planContent,
    });

    const result: PlanApprovalResult = {
      approved: true,
    };
    resolvePending(result);
  }, [planContent, resolvePending, addItem]);

  const handleFeedbackSubmit = useCallback(
    (feedback: string) => {
      if (!feedback.trim()) return;

      addItem({
        type: 'plan-rejected',
        text: 'User rejected plan',
        label: feedback.trim(),
        planContent,
      });

      const result: PlanApprovalResult = {
        approved: false,
        feedback: feedback.trim(),
      };
      resolvePending(result);
    },
    [planContent, resolvePending, addItem]
  );

  return (
    <PromptContainer>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold>Ready to code?</Text>
      </Box>

      {/* Subheader */}
      <Box marginBottom={1}>
        <Text>Here is Claude's plan:</Text>
      </Box>

      {/* Plan content */}
      <Box marginBottom={1} flexDirection="column">
        <Markdown>{planContent}</Markdown>
      </Box>

      {/* Question */}
      <Box marginBottom={1}>
        <Text>Would you like to proceed?</Text>
      </Box>

      {/* Options */}
      <Box flexDirection="column">
        {options.map((option, index) => {
          const isHighlighted = index === highlightedIndex;
          const isTypeOption = option.value === 'feedback';

          if (isTypeOption && isTypingMode) {
            return (
              <Box key={option.value}>
                <Text color={isHighlighted ? 'cyan' : undefined}>
                  {isHighlighted ? '› ' : '  '}
                  {index + 1}.
                </Text>
                <TextInput
                  value={customFeedback}
                  onChange={setCustomFeedback}
                  onSubmit={handleFeedbackSubmit}
                  focus={isTypingMode}
                  placeholder=""
                />
              </Box>
            );
          }

          return (
            <Box key={option.value}>
              <Text color={isHighlighted ? 'cyan' : undefined}>
                {isHighlighted ? '› ' : '  '}
                {index + 1}. {option.label}
              </Text>
            </Box>
          );
        })}
      </Box>
    </PromptContainer>
  );
}

export default PlanApprovalPrompt;
