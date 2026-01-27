/**
 * Tool call display component for history items.
 * Shows tool execution status, name, and optional details.
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { ToolCallInfo, ToolCallStatus } from '../types.js';
import { DiffDisplay } from './DiffDisplay.js';

interface ToolCallDisplayProps {
  toolCall: ToolCallInfo;
}

/**
 * Get status indicator based on tool call status
 */
function getStatusIndicator(status: ToolCallStatus): {
  symbol: string;
  color: string;
} {
  switch (status) {
    case 'pending':
      return { symbol: '○', color: 'gray' };
    case 'executing':
      return { symbol: '◐', color: 'yellow' };
    case 'success':
      return { symbol: '●', color: 'green' };
    case 'error':
      return { symbol: '●', color: 'red' };
    case 'denied':
      return { symbol: '○', color: 'red' };
    case 'interrupted':
      return { symbol: '●', color: 'red' };
    default:
      return { symbol: '○', color: 'gray' };
  }
}

/**
 * Get relative path by extracting filename or last path segments
 */
function getRelativePath(fullPath: unknown): string {
  if (typeof fullPath !== 'string') return '...';
  // Get the last 2-3 path segments for context
  const parts = fullPath.split('/').filter(Boolean);
  if (parts.length <= 2) return fullPath;
  return parts.slice(-2).join('/');
}

/**
 * Format tool display name and parameters separately
 */
function formatToolDisplay(
  toolName: string,
  input?: Record<string, unknown>,
): { name: string; params: string | null } {
  switch (toolName) {
    case 'Glob': {
      const pattern = input?.glob_pattern ?? input?.pattern ?? '*';
      return { name: 'Search', params: `(pattern: "${pattern}")` };
    }
    case 'Grep': {
      const pattern = input?.pattern ?? input?.regex ?? '...';
      return { name: 'Search', params: `(pattern: "${pattern}")` };
    }
    case 'Read': {
      const filePath = getRelativePath(input?.file_path ?? input?.path);
      return { name: 'Read', params: `(${filePath})` };
    }
    case 'Edit': {
      const filePath = getRelativePath(input?.file_path ?? input?.path);
      return { name: 'Update', params: `(${filePath})` };
    }
    case 'Write': {
      const filePath = getRelativePath(input?.file_path ?? input?.path);
      return { name: 'Write', params: `(${filePath})` };
    }
    default:
      return { name: toolName, params: null };
  }
}

/**
 * Display a tool call in the history
 */
export function ToolCallDisplay({
  toolCall,
}: ToolCallDisplayProps): React.ReactElement {
  const { toolName, status, result, error, input, diffContent } = toolCall;
  const { symbol, color } = getStatusIndicator(status);
  const { name, params } = formatToolDisplay(toolName, input);

  // For Bash, show the command instead of description
  const subtitle = toolName === 'Bash' 
    ? (typeof input?.command === 'string' ? input.command : null)
    : null;

  // Check if this is an Edit or Write tool that should show diff
  const shouldShowDiff = (toolName === 'Edit' || toolName === 'Write') && 
    status === 'success' && 
    diffContent;

  return (
    <Box flexDirection="column">
      {/* Main line with status and tool name */}
      <Box>
        <Text color={color}>{symbol}</Text>
        <Text> </Text>
        <Text bold>{name}</Text>
        {params && <Text>{params}</Text>}
      </Box>

      {/* For Bash, show the command */}
      {subtitle && (
        <Box marginLeft={2}>
          <Text dimColor>{subtitle}</Text>
        </Box>
      )}

      {/* Result summary (e.g., "Added 1 line, removed 1 line") */}
      {status === 'success' && result && (
        <Box marginLeft={2}>
          <Text dimColor>└─ </Text>
          <Text color="green">{result}</Text>
        </Box>
      )}

      {/* Diff content for Edit/Write tools */}
      {shouldShowDiff && (
        <Box marginLeft={2} marginTop={1}>
          <DiffDisplay diffContent={diffContent} maxHeight={15} />
        </Box>
      )}

      {status === 'error' && error && (
        <Box marginLeft={2}>
          <Text dimColor>└─ </Text>
          <Text color="red">{error}</Text>
        </Box>
      )}

      {status === 'denied' && (
        <Box marginLeft={2}>
          <Text dimColor>└─ </Text>
          <Text color="yellow">Denied by user</Text>
        </Box>
      )}

      {status === 'interrupted' && (
        <Box marginLeft={2}>
          <Text dimColor>└─ </Text>
          <Text color="red">Interrupted</Text>
        </Box>
      )}
    </Box>
  );
}

export default ToolCallDisplay;
