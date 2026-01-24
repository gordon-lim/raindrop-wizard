/**
 * Component to render the currently active prompt or spinner.
 * This re-renders frequently during streaming/active operations.
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { PendingItem } from '../contexts/WizardContext.js';
import { SelectPrompt } from './SelectPrompt.js';
import { TextPrompt } from './TextPrompt.js';
import { ConfirmPrompt } from './ConfirmPrompt.js';
import { SpinnerDisplay } from './SpinnerDisplay.js';
import type { SelectOptions, TextOptions, ConfirmOptions } from '../types.js';

interface PendingPromptProps {
  item: PendingItem;
}

/**
 * Routes to the appropriate prompt component based on type
 */
export function PendingPrompt({ item }: PendingPromptProps): React.ReactElement {
  switch (item.type) {
    case 'select':
      return <SelectPrompt options={item.props as SelectOptions<unknown>} />;

    case 'text':
      return <TextPrompt options={item.props as TextOptions} />;

    case 'confirm':
      return <ConfirmPrompt options={item.props as ConfirmOptions} />;

    case 'spinner':
      return <SpinnerDisplay message={(item.props as { message: string }).message} />;

    default:
      return (
        <Box>
          <Text color="red">Unknown prompt type: {(item as PendingItem).type}</Text>
        </Box>
      );
  }
}

export default PendingPrompt;
