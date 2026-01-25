/**
 * Spinner display component for the unified Ink app.
 * Uses ink-spinner and updates via WizardContext.
 */

import React from 'react';
import { Box, Text } from 'ink';
import InkSpinner from 'ink-spinner';

interface SpinnerDisplayProps {
  message: string;
}

/**
 * Spinner display that integrates with the wizard context
 */
export function SpinnerDisplay({ message }: SpinnerDisplayProps): React.ReactElement {
  return (
    <Box>
      <Text color="cyan">
        <InkSpinner type="toggle9" />
      </Text>
      <Text> {message}</Text>
    </Box>
  );
}

export default SpinnerDisplay;
