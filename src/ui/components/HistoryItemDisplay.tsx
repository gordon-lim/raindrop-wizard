/**
 * Component to display a completed history item in the Static section.
 * Each item type has its own styled rendering.
 */

import React from 'react';
import { Box, Text } from 'ink';
import Markdown from '@inkkit/ink-markdown';
import type { HistoryItem, ReceivedEventData } from '../contexts/WizardContext.js';
import { Logo } from './Logo.js';
import { ToolCallDisplay } from './ToolCallDisplay.js';

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

    case 'outro':
      return (
        <Box>
          <Text dimColor>└─</Text>
          <Text> {item.text}</Text>
        </Box>
      );

    case 'note':
      return <NoteDisplay text={item.text} title={item.title} />;

    case 'cancel':
      return (
        <Box>
          <Text color="red">●</Text>
          <Text color="red"> {item.text}</Text>
        </Box>
      );

    case 'response':
      return (
        <Box>
          <Text color="white">●</Text>
          <Text color="white"> {item.text}</Text>
        </Box>
      );

    case 'warning':
      return (
        <Box>
          <Text color="yellow">●</Text>
          <Text color="yellow"> {item.text}</Text>
        </Box>
      );

    case 'error':
      return (
        <Box>
          <Text color="red">●</Text>
          <Text color="red"> {item.text}</Text>
        </Box>
      );

    case 'success':
      return (
        <Box>
          <Text color="green">●</Text>
          <Text> {item.text}</Text>
        </Box>
      );

    case 'step':
      return (
        <Box>
          <Text color="white">●</Text>
          <Text> {item.text}</Text>
        </Box>
      );

    case 'phase':
      return (
        <Box>
          <Text backgroundColor="#C6C7FF">{item.text}</Text>
        </Box>
      );

    case 'select-result':
      return (
        <Box flexDirection="column">
          <Box>
            <Text color="cyan">›</Text>
            <Text> {item.text}</Text>
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
            <Text> {item.text}</Text>
          </Box>
          {item.label && (
            <Box marginLeft={2}>
              <Text dimColor>└─ </Text>
              <Text color="cyan">{item.label}</Text>
            </Box>
          )}
        </Box>
      );

    case 'spinner-result':
      return (
        <Box>
          <Text color="green">✓</Text>
          <Text> {item.text}</Text>
        </Box>
      );

    case 'tool-call':
      if (item.toolCall) {
        return <ToolCallDisplay toolCall={item.toolCall} />;
      }
      return (
        <Box>
          <Text color="cyan">●</Text>
          <Text> {item.text}</Text>
        </Box>
      );

    case 'agent-message':
      return (
        <Box>
          <Text color="magenta">◆ </Text>
          <Markdown showSectionPrefix={false}>{item.text}</Markdown>
        </Box>
      );

    case 'user-message':
      return (
        <Box>
          <Text backgroundColor="gray" color="white"> › {item.text} </Text>
        </Box>
      );

    case 'clarifying-questions-result':
      return (
        <Box flexDirection="column">
          <Box>
            <Text color="white">● </Text>
            <Text>{item.text}</Text>
          </Box>
          {item.questionsAndAnswers && item.questionsAndAnswers.map((qa, i) => {
            const isLast = i === item.questionsAndAnswers!.length - 1;
            const prefix = isLast ? '└' : '├';
            return (
              <Box key={i} marginLeft={2}>
                <Text dimColor>{prefix} · </Text>
                <Text>{qa.question}</Text>
                <Text dimColor> → </Text>
                <Text color="green">{qa.answer}</Text>
              </Box>
            );
          })}
        </Box>
      );

    case 'declined-questions':
      return (
        <Box>
          <Text color="yellow">⏺ </Text>
          <Text>{item.text}</Text>
        </Box>
      );

    case 'received-event':
      if (item.receivedEvent) {
        return <ReceivedEventDisplay event={item.receivedEvent} />;
      }
      return (
        <Box>
          <Text>{item.text}</Text>
        </Box>
      );

    case 'plan-approved':
      return (
        <Box flexDirection="column">
          <Box>
            <Text color="green">●</Text>
            <Text> {item.text}</Text>
          </Box>
          {item.planContent && (
            <Box marginLeft={2} marginTop={1} flexDirection="column">
              <Markdown showSectionPrefix={false}>{item.planContent}</Markdown>
            </Box>
          )}
        </Box>
      );

    case 'plan-rejected':
      return (
        <Box flexDirection="column">
          <Box>
            <Text color="red">●</Text>
            <Text color="red"> {item.text}</Text>
          </Box>
          {item.label && (
            <Box marginLeft={2}>
              <Text dimColor>└─ </Text>
              <Text color="red">{item.label}</Text>
            </Box>
          )}
        </Box>
      );

    default:
      return (
        <Box>
          <Text>{item.text}</Text>
        </Box>
      );
  }
}

/**
 * Truncate text to a maximum length with ellipsis
 */
function truncate(text: string | undefined, maxLength: number): string {
  if (!text) return 'N/A';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Display for received events from the API
 */
function ReceivedEventDisplay({
  event,
}: {
  event: ReceivedEventData;
}): React.ReactElement {
  const eventUrl = `https://app.raindrop.ai/home?event=${event.id}`;

  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text color="cyan">◆ </Text>
        <Text bold color="cyan">{event.eventName}</Text>
      </Box>
      <Box marginLeft={2} flexDirection="column">
        <Box>
          <Text dimColor>Timestamp: </Text>
          <Text>{event.timestamp || 'N/A'}</Text>
        </Box>
        <Box>
          <Text dimColor>Model: </Text>
          <Text color="yellow">{event.model || 'N/A'}</Text>
        </Box>
        <Box>
          <Text dimColor>User: </Text>
          <Text>{event.userId || 'N/A'}</Text>
        </Box>
        <Box>
          <Text dimColor>Input: </Text>
          <Text color="green">{truncate(event.input, 80)}</Text>
        </Box>
        <Box>
          <Text dimColor>Output: </Text>
          <Text color="white">{truncate(event.output, 80)}</Text>
        </Box>
        <Box>
          <Text dimColor>View: </Text>
          <Text color="blue">{eventUrl}</Text>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Note display with optional title and tree-style formatting
 */
function NoteDisplay({
  text,
  title,
}: {
  text: string;
  title?: string;
}): React.ReactElement {
  const lines = text.split('\n');

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
