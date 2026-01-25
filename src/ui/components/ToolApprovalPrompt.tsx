/**
 * Tool approval prompt component.
 * Displays tool details and allows user to approve or deny execution.
 */

import React, { useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { useWizardActions } from '../contexts/WizardContext.js';
import { DiffDisplay } from './DiffDisplay.js';
import { PromptContainer } from './PromptContainer.js';
import type { ToolApprovalProps, ToolApprovalResult } from '../types.js';

interface ToolApprovalPromptComponentProps {
  props: ToolApprovalProps;
}

type ApprovalOption = 'allow' | 'deny' | 'deny-with-feedback';

interface SelectItem {
  label: string;
  value: ApprovalOption;
}

/**
 * Tool approval prompt that shows tool details and approval options.
 */
export function ToolApprovalPrompt({
  props,
}: ToolApprovalPromptComponentProps): React.ReactElement {
  const { toolName, input, diffContent, fileName, description } = props;
  const { resolvePending, addItem } = useWizardActions();

  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackValue, setFeedbackValue] = useState('');

  // Handle Escape to cancel
  useInput((inputKey, key) => {
    if (key.escape) {
      handleSelection({ value: 'deny', label: '' });
    }
  });

  // Approval options
  const items: SelectItem[] = useMemo(
    () => [
      { label: 'Allow', value: 'allow' },
      { label: 'Deny', value: 'deny' },
      { label: 'Deny with feedback', value: 'deny-with-feedback' },
    ],
    [],
  );

  // Handle selection
  const handleSelection = (item: { value: ApprovalOption; label: string }) => {
    if (item.value === 'deny-with-feedback') {
      setShowFeedback(true);
      return;
    }

    const result: ToolApprovalResult =
      item.value === 'allow'
        ? { behavior: 'allow', updatedInput: input }
        : { behavior: 'deny', message: 'User denied this action' };

    addItem({
      type: 'tool-call',
      text: `${toolName}: ${item.value === 'allow' ? 'Approved' : 'Denied'}`,
      toolCall: {
        toolName,
        description,
        status: item.value === 'allow' ? 'success' : 'denied',
        input,
        diffContent,
        fileName,
      },
    });

    resolvePending(result);
  };

  // Handle feedback submission
  const handleFeedbackSubmit = (feedback: string) => {
    const result: ToolApprovalResult = {
      behavior: 'deny',
      message: feedback || 'User denied this action',
    };

    addItem({
      type: 'tool-call',
      text: `${toolName}: Denied with feedback`,
      toolCall: {
        toolName,
        description,
        status: 'denied',
        input,
        diffContent,
        fileName,
      },
    });

    resolvePending(result);
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

  // Render tool-specific details
  const renderToolDetails = () => {
    // For file edits (Write, Edit, StrReplace), show diff
    if (diffContent) {
      return <DiffDisplay diffContent={diffContent} fileName={fileName} maxHeight={15} />;
    }

    // For Bash commands, show the command
    if (toolName === 'Bash' && input.command) {
      const cmdDescription = input.description;
      return (
        <Box flexDirection="column">
          <Text bold>Command:</Text>
          <Box marginLeft={2}>
            <Text color="yellow">{String(input.command)}</Text>
          </Box>
          {cmdDescription != null && (
            <Box marginTop={1}>
              <Text dimColor>Description: {String(cmdDescription)}</Text>
            </Box>
          )}
        </Box>
      );
    }

    // For other tools, show input as JSON
    return (
      <Box flexDirection="column">
        <Text bold>Input:</Text>
        <Box marginLeft={2}>
          <Text dimColor>{JSON.stringify(input, null, 2)}</Text>
        </Box>
      </Box>
    );
  };

  return (
    <PromptContainer>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="yellow" bold>
          Tool Approval Required
        </Text>
      </Box>

      {/* Tool name and description */}
      <Box marginBottom={1}>
        <Text>
          <Text bold>Tool: </Text>
          <Text color="cyan">{toolName}</Text>
        </Text>
      </Box>
      {description && (
        <Box marginBottom={1}>
          <Text dimColor>{description}</Text>
        </Box>
      )}

      {/* Tool details */}
      <Box marginBottom={1} flexDirection="column">
        {renderToolDetails()}
      </Box>

      {/* Feedback input or selection */}
      {showFeedback ? (
        <Box flexDirection="column" marginTop={1}>
          <Text>Provide feedback for the agent:</Text>
          <Box marginTop={1}>
            <Text color="cyan">› </Text>
            <TextInput
              value={feedbackValue}
              onChange={setFeedbackValue}
              placeholder="e.g., Use a different approach..."
              onSubmit={handleFeedbackSubmit}
            />
          </Box>
        </Box>
      ) : (
        <Box marginTop={1}>
          <SelectInput
            items={items}
            indicatorComponent={indicatorComponent}
            itemComponent={itemComponent}
            onSelect={handleSelection}
          />
        </Box>
      )}
    </PromptContainer>
  );
}

export default ToolApprovalPrompt;
