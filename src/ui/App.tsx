/**
 * Main unified Ink app component.
 * Uses the Static + pending items pattern for efficient rendering.
 *
 * Architecture:
 * - <Static> renders completed history items once and "freezes" them
 * - activeSpinner renders above the pending item when agent is working
 * - pendingItem re-renders frequently during active prompts
 */

import React, { useMemo } from 'react';
import { Box, Static, Text } from 'ink';
import InkSpinner from 'ink-spinner';
import { useWizardState } from './contexts/WizardContext.js';
import { HistoryItemDisplay } from './components/HistoryItemDisplay.js';
import { PendingPrompt } from './components/PendingPrompt.js';
import type { HistoryItem } from './contexts/WizardContext.js';

/**
 * Main wizard app component
 */
export function WizardApp(): React.ReactElement {
  const { history, pendingItem, activeSpinner } = useWizardState();

  // Memoize history items to prevent unnecessary re-renders
  const historyItems = useMemo(
    () =>
      history.map((item: HistoryItem) => (
        <Box key={item.id} marginBottom={1}>
          <HistoryItemDisplay item={item} />
        </Box>
      )),
    [history],
  );

  return (
    <Box flexDirection="column">
      {/* Static section: completed items rendered once */}
      <Static items={historyItems}>{(item) => item}</Static>

      {/* Spinner: shown above pending item when active */}
      {activeSpinner && (
        <Box marginBottom={1}>
          <Text color="cyan">
            <InkSpinner type="dots" />
          </Text>
          <Text> {activeSpinner}</Text>
        </Box>
      )}

      {/* Pending section: actively updating content */}
      {pendingItem && <PendingPrompt item={pendingItem} />}
    </Box>
  );
}

export default WizardApp;
