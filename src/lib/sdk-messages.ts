/**
 * SDK message processing utilities
 * Handles parsing and displaying SDK messages from the Claude agent
 */

import ui from '../utils/ui.js';
import { debug, logToFile } from '../utils/debug.js';
import type { PendingToolCall } from './handlers.js';
import type { WizardOptions } from '../utils/types.js';

// Using `any` because typed imports from ESM modules require import attributes
// syntax which prettier cannot parse.
type SDKMessage = any;

/**
 * Extract result summary from tool result content
 */
export function extractResultSummary(
  toolName: string,
  resultContent: unknown,
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
            // Skip displaying the first agent message (it's a generic intro that's
            // redundant after the setup phase), but still collect it for logging
            const isFirstMessage = collectedText.length === 0;
            collectedText.push(block.text);

            // Add agent message to history for visibility (skip first message)
            if (!isFirstMessage) {
              ui.addItem({
                type: 'agent-message',
                text: block.text,
              });
            }
          }
          // Handle tool_use blocks - store pending, don't add to history yet
          if (block.type === 'tool_use') {
            const toolName = block.name || 'Unknown tool';
            const toolInput = block.input || {};
            const toolUseId = block.id;
            logToFile(`Tool use requested: ${toolName} (id: ${toolUseId})`, toolInput);

            // Skip storing/displaying internal SDK tools
            if (toolName === 'Task' || toolName === 'AskUserQuestion' || toolName === 'TodoWrite') {
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
              const resultSummary = extractResultSummary(pendingCall.toolName, resultContent);

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
          // Add final result to history
          if (message.result.trim()) {
            ui.addItem({
              type: 'success',
              text: message.result,
            });
          }
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
