/**
 * Diff display component for showing file changes.
 * Renders unified diff format with syntax highlighting.
 */

import React, { useMemo } from 'react';
import { Box, Text, useStdout } from 'ink';

interface DiffLine {
  type: 'add' | 'del' | 'context' | 'hunk' | 'header';
  lineNumber?: number;
  content: string;
}

interface DiffDisplayProps {
  /** The diff content in unified diff format */
  diffContent: string;
  /** The filename being modified */
  fileName?: string;
  /** Maximum height in lines (for scrollable content) */
  maxHeight?: number;
}

/**
 * Parse unified diff format into structured lines
 */
function parseDiff(diffContent: string): DiffLine[] {
  const lines = diffContent.split('\n');
  const result: DiffLine[] = [];
  let newLineNumber = 0;
  const hunkHeaderRegex = /^@@ -\d+,?\d* \+(\d+),?\d* @@/;

  for (const line of lines) {
    // Skip git header lines
    if (line.startsWith('diff --git') || line.startsWith('index ')) {
      continue;
    }

    // File header lines
    if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      result.push({ type: 'header', content: line });
      continue;
    }

    // Hunk header
    const hunkMatch = line.match(hunkHeaderRegex);
    if (hunkMatch) {
      newLineNumber = parseInt(hunkMatch[1], 10) - 1;
      result.push({ type: 'hunk', content: line });
      continue;
    }

    // Added line
    if (line.startsWith('+')) {
      newLineNumber++;
      result.push({
        type: 'add',
        lineNumber: newLineNumber,
        content: line.substring(1),
      });
      continue;
    }

    // Deleted line
    if (line.startsWith('-')) {
      result.push({
        type: 'del',
        content: line.substring(1),
      });
      continue;
    }

    // Context line
    if (line.startsWith(' ')) {
      newLineNumber++;
      result.push({
        type: 'context',
        lineNumber: newLineNumber,
        content: line.substring(1),
      });
      continue;
    }
  }

  return result;
}

/**
 * Display a unified diff with colored lines
 */
export function DiffDisplay({
  diffContent,
  fileName,
  maxHeight,
}: DiffDisplayProps): React.ReactElement {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns || 80;

  const parsedLines = useMemo(() => {
    if (!diffContent || typeof diffContent !== 'string') {
      return [];
    }
    return parseDiff(diffContent);
  }, [diffContent]);

  // Calculate gutter width based on max line number
  const maxLineNum = useMemo(() => {
    return Math.max(
      0,
      ...parsedLines
        .filter((l) => l.lineNumber !== undefined)
        .map((l) => l.lineNumber as number),
    );
  }, [parsedLines]);
  const gutterWidth = Math.max(4, maxLineNum.toString().length + 1);

  if (parsedLines.length === 0) {
    return (
      <Box>
        <Text dimColor>No changes to display</Text>
      </Box>
    );
  }

  // Limit lines if maxHeight is specified
  const displayLines = maxHeight
    ? parsedLines.slice(0, maxHeight)
    : parsedLines;
  const truncated = maxHeight && parsedLines.length > maxHeight;

  return (
    <Box flexDirection="column" width={terminalWidth}>
      {/* File name header */}
      {fileName && (
        <Box marginBottom={1}>
          <Text bold color="cyan">
            {fileName}
          </Text>
        </Box>
      )}

      {/* Diff lines */}
      {displayLines.map((line, index) => {
        const key = `diff-line-${index}`;

        switch (line.type) {
          case 'header':
            return (
              <Box key={key}>
                <Text dimColor>{line.content}</Text>
              </Box>
            );

          case 'hunk':
            return (
              <Box key={key} marginTop={1}>
                <Text color="cyan">{line.content}</Text>
              </Box>
            );

          case 'add':
            return (
              <Box key={key}>
                <Text dimColor>
                  {(line.lineNumber?.toString() || '').padStart(gutterWidth)}
                </Text>
                <Text color="green" backgroundColor="greenBright">
                  {' '}
                  +{' '}
                </Text>
                <Text color="green">{line.content}</Text>
              </Box>
            );

          case 'del':
            return (
              <Box key={key}>
                <Text dimColor>{''.padStart(gutterWidth)}</Text>
                <Text color="red" backgroundColor="redBright">
                  {' '}
                  -{' '}
                </Text>
                <Text color="red">{line.content}</Text>
              </Box>
            );

          case 'context':
            return (
              <Box key={key}>
                <Text dimColor>
                  {(line.lineNumber?.toString() || '').padStart(gutterWidth)}
                </Text>
                <Text> </Text>
                <Text>{line.content}</Text>
              </Box>
            );

          default:
            return null;
        }
      })}

      {/* Truncation indicator */}
      {truncated && (
        <Box marginTop={1}>
          <Text dimColor>
            ... {parsedLines.length - (maxHeight || 0)} more lines
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default DiffDisplay;
