/**
 * SDK message processing utilities
 * Handles parsing and displaying SDK messages from the Claude agent
 */

import ui from '../utils/ui.js';
import { debug, logToFile } from '../utils/debug.js';
import type { PendingToolCall } from './handlers.js';
import type { WizardOptions } from '../utils/types.js';
import { createTwoFilesPatch } from 'diff';

// Using `any` because typed imports from ESM modules require import attributes
// syntax which prettier cannot parse.
type SDKMessage = any;

/** Internal SDK tools that should not be stored/displayed */
const INTERNAL_TOOLS = new Set([
  'Task',
  'AskUserQuestion',
  'TodoWrite',
  'mcp__raindrop-wizard__CompleteIntegration',
  'EnterPlanMode',
  'ExitPlanMode',
]);

/**
 * Generate a unified diff for Edit tool inputs (old_string -> new_string)
 */
function generateEditDiff(
  filePath: string,
  oldString: string,
  newString: string,
): string {
  return createTwoFilesPatch(
    filePath,
    filePath,
    oldString,
    newString,
    '', // old header
    '', // new header
    { context: 3 }, // context lines
  );
}

/**
 * Extract summary for Edit tool (line changes)
 */
function extractEditSummary(input: Record<string, unknown>): string {
  const oldString = typeof input.old_string === 'string' ? input.old_string : '';
  const newString = typeof input.new_string === 'string' ? input.new_string : '';

  const oldLines = oldString ? oldString.split('\n').length : 0;
  const newLines = newString ? newString.split('\n').length : 0;

  const added = Math.max(0, newLines - oldLines);
  const removed = Math.max(0, oldLines - newLines);

  // Handle the case where lines are replaced (same count but different content)
  if (added === 0 && removed === 0 && oldString !== newString) {
    return `Updated ${oldLines} line${oldLines === 1 ? '' : 's'}`;
  }

  const parts: string[] = [];
  if (added > 0) parts.push(`Added ${added} line${added === 1 ? '' : 's'}`);
  if (removed > 0) parts.push(`removed ${removed} line${removed === 1 ? '' : 's'}`);

  return parts.length > 0 ? parts.join(', ') : 'No changes';
}

/**
 * Extract summary for Write tool (lines written)
 */
function extractWriteSummary(input: Record<string, unknown>): string {
  const content = typeof input.content === 'string' ? input.content : '';
  const lines = content ? content.split('\n').length : 0;
  const fileName = typeof input.path === 'string'
    ? input.path.split('/').pop()
    : 'file';
  return `Wrote ${lines} line${lines === 1 ? '' : 's'} to ${fileName}`;
}

/**
 * Generate diff content and file name for Edit/Write tools
 */
function extractEditWriteInfo(
  toolName: string,
  input: Record<string, unknown>,
): { diffContent?: string; fileName?: string } {
  const fileName = typeof input.file_path === 'string'
    ? input.file_path
    : typeof input.path === 'string'
      ? input.path
      : undefined;

  if (toolName === 'Edit' && fileName) {
    const oldString = typeof input.old_string === 'string' ? input.old_string : '';
    const newString = typeof input.new_string === 'string' ? input.new_string : '';
    const diffContent = generateEditDiff(fileName, oldString, newString);
    return { diffContent, fileName };
  }

  if (toolName === 'Write' && fileName) {
    const content = typeof input.content === 'string' ? input.content : '';
    const diffContent = generateEditDiff(fileName, '', content);
    return { diffContent, fileName };
  }

  return {};
}

/**
 * Extract result summary from tool result content
 */
export function extractResultSummary(
  toolName: string,
  resultContent: unknown,
  input?: Record<string, unknown>,
): string | undefined {
  // Handle string content
  const content = typeof resultContent === 'string'
    ? resultContent
    : Array.isArray(resultContent)
      ? resultContent.map((c: any) => c.text || '').join('\n')
      : '';

  if (!content) return undefined;

  switch (toolName) {
    case 'Glob': {
      // Count non-empty lines (each line is a file path)
      const lines = content.trim().split('\n').filter((l: string) => l.trim());
      return `Found ${lines.length} files`;
    }
    case 'Read': {
      // Count lines in the file content
      const lineCount = content.split('\n').length;
      return `Read ${lineCount} lines`;
    }
    case 'Grep': {
      // Count match lines
      const lines = content.trim().split('\n').filter((l: string) => l.trim());
      return `Found ${lines.length} matches`;
    }
    case 'Edit': {
      if (input) {
        return extractEditSummary(input);
      }
      return undefined;
    }
    case 'Write': {
      if (input) {
        return extractWriteSummary(input);
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Process SDK messages and provide user feedback.
 * Handles assistant text, tool use, tool results, and system messages.
 */
export function processSDKMessage(
  message: SDKMessage,
  options: WizardOptions,
  collectedText: string[],
  pendingToolCalls: Map<string, PendingToolCall>,
  isInterrupting: boolean,
): void {
  logToFile(`SDK Message: ${message.type}`, JSON.stringify(message, null, 2));

  if (options.debug) {
    debug(`SDK Message type: ${message.type}`);
  }

  switch (message.type) {
    case 'assistant': {
      // Extract text content from assistant messages
      const content = message.message?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text' && typeof block.text === 'string') {
            collectedText.push(block.text);

            // Add agent message to history for visibility
            ui.addItem({
              type: 'agent-message',
              text: block.text,
            });
          }
          // Handle tool_use blocks - store pending, don't add to history yet
          if (block.type === 'tool_use') {
            const toolName = block.name || 'Unknown tool';
            const toolInput = block.input || {};
            const toolUseId = block.id;
            logToFile(`Tool use requested: ${toolName} (id: ${toolUseId})`, toolInput);

            // Skip storing/displaying internal SDK tools
            if (INTERNAL_TOOLS.has(toolName)) {
              continue;
            }

            // Store pending tool call to complete when result arrives
            pendingToolCalls.set(toolUseId, {
              toolName,
              input: toolInput,
              description:
                typeof toolInput.description === 'string'
                  ? toolInput.description
                  : undefined,
            });
          }
        }
      }
      break;
    }

    case 'user': {
      // Tool results come as 'user' messages with tool_result content
      const content = message.message?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'tool_result') {
            const toolUseId = block.tool_use_id;
            const isError = block.is_error === true;
            const resultContent = block.content;

            logToFile(`Tool result for ${toolUseId}:`, {
              isError,
              content: resultContent,
            });

            // Look up the pending tool call
            const pendingCall = pendingToolCalls.get(toolUseId);
            if (pendingCall) {
              pendingToolCalls.delete(toolUseId);

              // Extract result summary based on tool type
              const resultSummary = extractResultSummary(
                pendingCall.toolName,
                resultContent,
                pendingCall.input,
              );

              // Extract diff content and file name for Edit/Write tools
              const { diffContent, fileName } = extractEditWriteInfo(
                pendingCall.toolName,
                pendingCall.input,
              );

              // Add completed tool call to history
              ui.addItem({
                type: 'tool-call',
                text: pendingCall.toolName,
                toolCall: {
                  toolName: pendingCall.toolName,
                  status: isError ? 'error' : 'success',
                  input: pendingCall.input,
                  description: pendingCall.description,
                  result: resultSummary,
                  error: isError ? String(resultContent) : undefined,
                  diffContent,
                  fileName,
                },
              });
            }

            if (isError && options.debug) {
              debug(`Tool error: ${resultContent}`);
            }
          }
        }
      }
      break;
    }

    case 'result': {
      if (message.subtype === 'success') {
        logToFile('Agent completed successfully');
        if (typeof message.result === 'string') {
          collectedText.push(message.result);
          // Note: We intentionally don't display the result message here.
          // The SDK's result.result field contains the same text as the last
          // assistant message, which we already render above. Displaying both
          // would cause duplicate output in the UI.
        }
      } else {
        // Error result - suppress if it's an interrupt-related error
        logToFile('Agent error result:', message.subtype);
        if (message.errors && !isInterrupting) {
          for (const err of message.errors) {
            // Check if error is interrupt-related
            const errStr = String(err);
            const isInterruptError = errStr.includes('aborted') ||
              errStr.includes('interrupted') ||
              errStr.includes('403');
            if (!isInterruptError) {
              ui.addItem({ type: 'error', text: `Error: ${err}` });
            }
            logToFile('ERROR:', err);
          }
        }
      }
      break;
    }

    case 'system': {
      if (message.subtype === 'init') {
        logToFile('Agent session initialized', {
          model: message.model,
          tools: message.tools?.length,
        });
      }
      break;
    }

    default:
      // Log other message types for debugging
      if (options.debug) {
        debug(`Unhandled message type: ${message.type}`);
      }
      break;
  }
}
