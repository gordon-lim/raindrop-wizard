/**
 * Plan approval prompt component.
 * Shows the agent's plan and asks user to approve or provide feedback.
 * Uses the shared FeedbackSelectPrompt for the options/input interaction.
 */

import React, { useCallback } from 'react';
import { Box, Text } from 'ink';
import Markdown from '@inkkit/ink-markdown';
import { useWizard } from '../contexts/WizardContext.js';
import { PromptContainer } from './PromptContainer.js';
import { FeedbackSelectPrompt } from './FeedbackSelectPrompt.js';
import type {
  PlanApprovalProps,
  PlanApprovalResult,
  FeedbackSelectResult,
} from '../types.js';

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

  // Handle result from FeedbackSelectPrompt
  const handleResult = useCallback(
    (result: FeedbackSelectResult<'accept'>) => {
      if (result.type === 'option') {
        // User approved the plan
        addItem({
          type: 'plan-approved',
          text: 'User approved plan',
          planContent,
        });

        const approvalResult: PlanApprovalResult = {
          approved: true,
        };
        resolvePending(approvalResult);
      } else {
        // User provided feedback (rejected)
        addItem({
          type: 'plan-rejected',
          text: 'User rejected plan',
          label: result.value,
          planContent,
        });

        const approvalResult: PlanApprovalResult = {
          approved: false,
          feedback: result.value,
        };
        resolvePending(approvalResult);
      }
    },
    [planContent, resolvePending, addItem],
  );

  const feedbackSelectOptions = {
    message: 'Would you like to proceed?',
    options: [
      { value: 'accept' as const, label: 'Yes, accept plan' },
      { value: 'feedback' as const, label: 'Type something', allowTextInput: true },
    ],
  };

  return (
    <PromptContainer>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold>Ready to execute the plan?</Text>
      </Box>

      {/* Subheader */}
      <Box marginBottom={1}>
        <Text>Here is the wizard's plan:</Text>
      </Box>

      {/* Plan content */}
      <Box marginBottom={1} flexDirection="column">
        <Markdown showSectionPrefix={false}>{planContent}</Markdown>
      </Box>

      {/* Feedback select (embedded, not standalone) */}
      <FeedbackSelectPrompt
        options={feedbackSelectOptions}
        onResult={handleResult}
        standalone={false}
      />
    </PromptContainer>
  );
}

export default PlanApprovalPrompt;
