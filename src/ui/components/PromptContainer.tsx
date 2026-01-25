/**
 * Reusable container for prompt components.
 * Provides consistent styling with dim horizontal lines above and below.
 */

import React, { type ReactNode } from 'react';
import { Box, Text, useStdout } from 'ink';

interface PromptContainerProps {
  children: ReactNode;
}

/**
 * Container that wraps prompt content with dim horizontal lines.
 * Ensures consistent styling across all input components.
 */
export function PromptContainer({
  children,
}: PromptContainerProps): React.ReactElement {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns || 80;

  return (
    <Box flexDirection="column">
      <Text color="gray">{'─'.repeat(terminalWidth)}</Text>
      {children}
      <Text color="gray">{'─'.repeat(terminalWidth)}</Text>
    </Box>
  );
}

export default PromptContainer;
