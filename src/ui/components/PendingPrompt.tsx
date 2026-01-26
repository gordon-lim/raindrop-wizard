/**
 * Component to render the currently active prompt or spinner.
 * This re-renders frequently during streaming/active operations.
 *
 * Only one input component is visible at a time - this component routes
 * to the appropriate prompt based on pendingItem.type.
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { PendingItem } from '../contexts/WizardContext.js';
import { SelectPrompt } from './SelectPrompt.js';
import { TextPrompt } from './TextPrompt.js';
import { SpinnerDisplay } from './SpinnerDisplay.js';
import { PersistentTextInput } from './PersistentTextInput.js';
import { ToolApprovalPrompt } from './ToolApprovalPrompt.js';
import { ClarifyingQuestionsPrompt } from './ClarifyingQuestionsPrompt.js';
import { PlanApprovalPrompt } from './PlanApprovalPrompt.js';
import type {
  SelectOptions,
  TextOptions,
  PersistentInputProps,
  ToolApprovalProps,
  ClarifyingQuestionsProps,
  PlanApprovalProps,
} from '../types.js';

interface PendingPromptProps {
  item: PendingItem;
}

/**
 * Routes to the appropriate prompt component based on type.
 * Ensures only one input component is visible at a time.
 */
export function PendingPrompt({ item }: PendingPromptProps): React.ReactElement {
  switch (item.type) {
    case 'select':
      return <SelectPrompt options={item.props as SelectOptions<unknown>} />;

    case 'text':
      return <TextPrompt options={item.props as TextOptions} />;

    case 'spinner':
      return <SpinnerDisplay message={(item.props as { message: string }).message} />;

    case 'persistent-input':
      return <PersistentTextInput props={item.props as PersistentInputProps} />;

    case 'tool-approval':
      return <ToolApprovalPrompt props={item.props as ToolApprovalProps} />;

    case 'clarifying-questions':
      return <ClarifyingQuestionsPrompt props={item.props as ClarifyingQuestionsProps} />;

    case 'plan-approval':
      return <PlanApprovalPrompt props={item.props as PlanApprovalProps} />;

    default:
      return (
        <Box>
          <Text color="red">Unknown prompt type: {(item as PendingItem).type}</Text>
        </Box>
      );
  }
}

export default PendingPrompt;
