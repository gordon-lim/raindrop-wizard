/**
 * Component to display a completed history item in the Static section.
 * Each item type has its own styled rendering.
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { HistoryItem } from '../contexts/WizardContext.js';
import { Logo } from './Logo.js';

interface HistoryItemDisplayProps {
  item: HistoryItem;
}

/**
 * Renders a single history item based on its type
 */
export function HistoryItemDisplay({
  item,
}: HistoryItemDisplayProps): React.ReactElement {
  switch (item.type) {
    case 'logo':
      return <Logo />;

    case 'intro':
      return (
        <Box>
          <Text color="white">●</Text>
          <Text> {item.content}</Text>
        </Box>
      );

    case 'outro':
      return (
        <Box>
          <Text dimColor>└─</Text>
          <Text> {item.content}</Text>
        </Box>
      );

    case 'note':
      return <NoteDisplay content={item.content} title={item.title} />;

    case 'cancel':
      return (
        <Box>
          <Text color="red">●</Text>
          <Text color="red"> {item.content}</Text>
        </Box>
      );

    case 'log-info':
      return (
        <Box>
          <Text color="white">●</Text>
          <Text dimColor> {item.content}</Text>
        </Box>
      );

    case 'log-warn':
      return (
        <Box>
          <Text color="yellow">●</Text>
          <Text color="yellow"> {item.content}</Text>
        </Box>
      );

    case 'log-error':
      return (
        <Box>
          <Text color="red">●</Text>
          <Text color="red"> {item.content}</Text>
        </Box>
      );

    case 'log-success':
      return (
        <Box>
          <Text color="green">●</Text>
          <Text> {item.content}</Text>
        </Box>
      );

    case 'log-step':
      return (
        <Box>
          <Text color="white">●</Text>
          <Text> {item.content}</Text>
        </Box>
      );

    case 'select-result':
      return (
        <Box flexDirection="column">
          <Box>
            <Text color="cyan">›</Text>
            <Text> {item.content}</Text>
          </Box>
          {item.label && (
            <Box marginLeft={2}>
              <Text dimColor>└─ </Text>
              <Text color="cyan">{item.label}</Text>
            </Box>
          )}
        </Box>
      );

    case 'text-result':
      return (
        <Box flexDirection="column">
          <Box>
            <Text color="cyan">›</Text>
            <Text> {item.content}</Text>
          </Box>
          {item.label && (
            <Box marginLeft={2}>
              <Text dimColor>└─ </Text>
              <Text color="cyan">{item.label}</Text>
            </Box>
          )}
        </Box>
      );

    case 'confirm-result':
      return (
        <Box>
          <Box>
            <Text color="cyan">›</Text>
            <Text> {item.content}</Text>
          </Box>
          {item.label && (
            <Box marginLeft={1}>
              <Text color="cyan">{item.label}</Text>
            </Box>
          )}
        </Box>
      );

    case 'spinner-result':
      return (
        <Box>
          <Text color="green">✓</Text>
          <Text> {item.content}</Text>
        </Box>
      );

    default:
      return (
        <Box>
          <Text>{item.content}</Text>
        </Box>
      );
  }
}

/**
 * Note display with optional title and tree-style formatting
 */
function NoteDisplay({
  content,
  title,
}: {
  content: string;
  title?: string;
}): React.ReactElement {
  const lines = content.split('\n');

  if (title) {
    return (
      <Box flexDirection="column">
        <Box>
          <Text dimColor>┌─</Text>
          <Text bold> {title}</Text>
        </Box>
        {lines.map((line, i) => {
          const prefix = i === lines.length - 1 ? '└─' : '├─';
          return (
            <Box key={i}>
              <Text dimColor>{prefix}</Text>
              <Text dimColor> {line}</Text>
            </Box>
          );
        })}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {lines.map((line, i) => (
        <Box key={i}>
          <Text dimColor>│ </Text>
          <Text dimColor>{line}</Text>
        </Box>
      ))}
    </Box>
  );
}

export default HistoryItemDisplay;
