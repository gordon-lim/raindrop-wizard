/**
 * Shared agent interface for raindrop.ai wizards
 * Uses Claude Agent SDK directly with streaming input support
 */

import path from 'path';
import { createRequire } from 'module';
import ui from '../utils/ui.js';
import type {
  SpinnerInstance,
  AgentQueryHandle,
  ToolApprovalResult,
} from '../ui/types.js';
import { debug, logToFile, initLogFile, LOG_FILE_PATH } from '../utils/debug.js';
import type { WizardOptions } from '../utils/types.js';

// Create a require function for ESM compatibility
const require = createRequire(import.meta.url);

// Dynamic import cache for ESM module
let _sdkModule: any = null;
async function getSDKModule(): Promise<any> {
  if (!_sdkModule) {
    _sdkModule = await import('@anthropic-ai/claude-agent-sdk');
  }
  return _sdkModule;
}

/**
 * Get the path to the bundled Claude Code CLI from the SDK package.
 * This ensures we use the SDK's bundled version rather than the user's installed Claude Code.
 */
function getClaudeCodeExecutablePath(): string {
  // require.resolve finds the package's main entry, then we get cli.js from same dir
  const sdkPackagePath = require.resolve('@anthropic-ai/claude-agent-sdk');
  return path.join(path.dirname(sdkPackagePath), 'cli.js');
}

// Using `any` because typed imports from ESM modules require import attributes
// syntax which prettier cannot parse. See PR discussion for details.
type SDKMessage = any;
type McpServersConfig = any;

// Re-export AgentQueryHandle for external use
export type { AgentQueryHandle };

export type AgentConfig = {
  workingDirectory: string;
};

/**
 * Result from runAgent including session ID and query handle
 */
export interface AgentRunResult {
  sessionId?: string;
  handle: AgentQueryHandle;
}

/**
 * Internal configuration object returned by initializeAgent
 */
export type AgentRunConfig = {
  workingDirectory: string;
  mcpServers: McpServersConfig;
  model: string;
};

/**
 * Wrap a query stream to handle interrupt errors gracefully.
 * When interrupt() is called, the SDK may throw errors, but we want the
 * stream to continue so the user can send new messages.
 */
async function* wrapQueryStream(
  queryStream: AsyncIterable<SDKMessage>,
  isInterruptingRef: { value: boolean },
): AsyncGenerator<SDKMessage> {
  const iterator = queryStream[Symbol.asyncIterator]();

  while (true) {
    try {
      const result = await iterator.next();
      if (result.done) {
        break;
      }
      yield result.value;
    } catch (error) {
      const errorMsg = (error as Error).message || '';
      const isInterruptError = isInterruptingRef.value ||
        errorMsg.includes('aborted') ||
        errorMsg.includes('interrupted') ||
        errorMsg.includes('403');

      if (isInterruptError) {
        // Interrupt error - log but don't throw, allow stream to continue
        logToFile('Interrupt error in stream, continuing:', errorMsg);
        isInterruptingRef.value = false; // Reset flag
        // Continue the while loop to get the next message after interrupt
        continue;
      } else {
        // Real error - rethrow
        throw error;
      }
    }
  }
}

// ============================================================================
// Enhanced canUseTool Handler with UI Integration
// ============================================================================

/**
 * Handle tool approval request by showing approval UI
 */
async function handleToolApproval(
  toolName: string,
  input: Record<string, unknown>,
): Promise<ToolApprovalResult> {
  logToFile('Showing tool approval UI:', { toolName, input });

  // Build props for the approval prompt
  const props = {
    toolName,
    input,
    description: typeof input.description === 'string' ? input.description : undefined,
    // For file edits, extract diff and filename
    diffContent: typeof input.file_diff === 'string' ? input.file_diff : undefined,
    fileName: typeof input.file_path === 'string'
      ? input.file_path
      : typeof input.path === 'string'
        ? input.path
        : undefined,
  };

  try {
    const result = await ui.toolApproval(props);
    logToFile('Tool approval result:', result);
    return result;
  } catch (error) {
    logToFile('Error in tool approval:', error);
    return {
      behavior: 'deny',
      message: 'Failed to get user approval',
    };
  }
}

/**
 * Handle the AskUserQuestion tool by showing clarifying questions UI.
 * Input already contains { questions: [...] } in the correct format.
 * Returns { questions, answers } as expected by the SDK.
 */
async function handleClarifyingQuestions(
  input: Record<string, unknown>,
): Promise<ToolApprovalResult> {
  logToFile('Handling AskUserQuestion:', input);

  try {
    // Input is already in ClarifyingQuestionsProps format
    const result = await ui.clarifyingQuestions(input as any);
    logToFile('Clarifying questions result:', result);

    // Return questions + answers as expected by SDK
    return {
      behavior: 'allow',
      updatedInput: {
        questions: result.questions,
        answers: result.answers,
      },
    };
  } catch (error) {
    logToFile('Error in clarifying questions:', error);
    return {
      behavior: 'deny',
      message: 'Failed to get user answers',
    };
  }
}

/**
 * Create a canUseTool handler that integrates with the UI for approvals.
 * - Handles AskUserQuestion by showing clarifying questions UI
 * - Shows approval UI for other tools
 */
function createCanUseToolHandler() {
  return async (
    toolName: string,
    input: unknown,
  ): Promise<ToolApprovalResult> => {
    const inputRecord = input as Record<string, unknown>;
    logToFile('canUseTool called:', { toolName, input: inputRecord });

    // Handle AskUserQuestion specially
    if (toolName === 'AskUserQuestion') {
      return handleClarifyingQuestions(inputRecord);
    }

    // Show approval UI for other tools
    return handleToolApproval(toolName, inputRecord);
  };
}

/**
 * Initialize agent configuration for the Claude agent
 */
export function initializeAgent(
  config: AgentConfig,
  options: WizardOptions,
): AgentRunConfig {
  // Initialize log file for this run
  initLogFile();
  logToFile('Agent initialization starting');
  logToFile('Install directory:', options.installDir);

  try {
    // ANTHROPIC_API_KEY is required
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        'ANTHROPIC_API_KEY environment variable is required. Please set it before running the wizard.',
      );
    }

    // Use direct Claude API key (standard SDK authentication)
    logToFile(
      'Using direct Claude API key from ANTHROPIC_API_KEY environment variable',
    );
    // SDK will use ANTHROPIC_API_KEY automatically - no need to set ANTHROPIC_BASE_URL or ANTHROPIC_AUTH_TOKEN
    process.env.CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS = 'true';

    // MCP servers not used - pass empty config for SDK compatibility
    const mcpServers: McpServersConfig = {};

    const agentRunConfig: AgentRunConfig = {
      workingDirectory: config.workingDirectory,
      mcpServers,
      model: 'claude-sonnet-4-5-20250929',
    };

    logToFile('Agent config:', {
      workingDirectory: agentRunConfig.workingDirectory,
      apiKeyPresent: !!process.env.ANTHROPIC_API_KEY,
    });

    if (options.debug) {
      debug('Agent config:', {
        workingDirectory: agentRunConfig.workingDirectory,
        apiKeyPresent: !!process.env.ANTHROPIC_API_KEY,
      });
    }

    ui.addItem({ type: 'step', text: `I'll keep verbose logs for this session at: ${LOG_FILE_PATH}` });
    return agentRunConfig;
  } catch (error) {
    ui.addItem({ type: 'error', text: `Failed to initialize agent: ${(error as Error).message}` });
    logToFile('Agent initialization error:', error);
    debug('Agent initialization error:', error);
    throw error;
  }
}

/**
 * Configuration for runAgent
 */
export interface RunAgentConfig {
  spinnerMessage?: string;
  successMessage?: string;
  errorMessage?: string;
  resume?: string;
  /** Enable streaming input with persistent text input (default: false) */
  streamingInput?: boolean;
}

/**
 * Execute an agent with the provided prompt and options.
 * Supports streaming input for user interruption and follow-up messages.
 *
 * @returns Session ID and query handle for controlling the agent
 */
export async function runAgent(
  agentConfig: AgentRunConfig,
  prompt: string,
  options: WizardOptions,
  spinner: SpinnerInstance,
  config?: RunAgentConfig,
): Promise<AgentRunResult> {
  const {
    spinnerMessage = 'Customizing your raindrop.ai setup...',
    successMessage = 'raindrop.ai integration complete',
    errorMessage = 'Integration failed',
    resume,
    streamingInput = false,
  } = config ?? {};

  const { query } = await getSDKModule();

  spinner.start(spinnerMessage);

  const cliPath = getClaudeCodeExecutablePath();
  logToFile('Starting agent run');
  logToFile('Claude Code executable:', cliPath);
  logToFile('Prompt:', prompt);
  logToFile('Streaming input:', streamingInput);
  if (resume) {
    logToFile('Resuming session:', resume);
  }

  const startTime = Date.now();
  const collectedText: string[] = [];
  const pendingToolCalls = new Map<string, PendingToolCall>();
  let sessionId: string | undefined = resume;

  // Track interrupt state as ref object so it can be shared with wrapper
  const isInterruptingRef = { value: false };
  // Track if we're waiting for user input after Esc interrupt
  let waitingForUserInput = false;

  // Create the query handle for external control
  let queryObject: any = null;
  const handle: AgentQueryHandle = {
    interrupt: async () => {
      logToFile('Soft interrupt requested (Esc)');
      isInterruptingRef.value = true;
      waitingForUserInput = true;

      // Mark all pending tool calls as interrupted and show them in history
      if (pendingToolCalls.size > 0) {
        for (const [toolUseId, pendingCall] of pendingToolCalls) {
          ui.addItem({
            type: 'tool-call',
            text: pendingCall.toolName,
            toolCall: {
              toolName: pendingCall.toolName,
              status: 'interrupted',
              input: pendingCall.input,
              description: pendingCall.description,
            },
          });
          pendingToolCalls.delete(toolUseId);
        }
      } else {
        // Only show generic "Interrupted" if no pending tool calls to display
        ui.addItem({
          type: 'error',
          text: 'Interrupted',
        });
      }

      // Stop the persistent input (removes the spinner)
      if (streamingInput) {
        ui.stopPersistentInput();
      }

      // Call SDK interrupt
      if (queryObject?.interrupt) {
        logToFile('Calling queryObject.interrupt()');
        await queryObject.interrupt();
        logToFile('queryObject.interrupt() completed');
      } else {
        logToFile('No queryObject.interrupt available');
      }
    },
    sendMessage: () => {
      // No-op: use interrupt + resume pattern instead of streaming messages
      logToFile('sendMessage called but not supported - use interrupt and resume');
    },
  };

  try {
    queryObject = query({
      prompt,
      options: {
        model: agentConfig.model,
        cwd: agentConfig.workingDirectory,
        permissionMode: 'default',
        mcpServers: agentConfig.mcpServers,
        systemPrompt: { preset: "claude_code" },
        env: { ...process.env },
        resume,
        canUseTool: createCanUseToolHandler(),
        // Permission rules to protect sensitive files
        permissions: {
          allow: [
            'Bash(npm run lint)',
            'Bash(npm run test:*)',
          ],
          deny: [
            'Bash(curl:*)',
            'Read(./.env)',
            'Read(./.env.*)',
            'Read(./secrets/**)',
          ],
        },
        // Capture stderr from CLI subprocess for debugging
        stderr: (data: string) => {
          logToFile('CLI stderr:', data);
          if (options.debug) {
            debug('CLI stderr:', data);
          }
        },
      },
    });

    // Set up persistent input if streaming input is enabled
    if (streamingInput) {
      // Stop the spinner since we're replacing it with persistent input (which has its own spinner)
      spinner.stop();

      ui.startPersistentInput({
        onSubmit: async () => {
          // Submitting while agent is running triggers interrupt
          // The user's message will be collected after the interrupt completes
          logToFile('User submitted while agent running - triggering interrupt');
          handle.interrupt();
        },
        onInterrupt: () => {
          logToFile('User requested interrupt (Esc)');
          handle.interrupt();
        },
        spinnerMessage: spinnerMessage,
      });

      // Update agent state
      ui.setAgentState({
        isRunning: true,
        queryHandle: handle,
      });
    }

    // Process the query stream
    for await (const message of wrapQueryStream(queryObject, isInterruptingRef)) {
      // Capture session_id from any message
      if (message.session_id && !sessionId) {
        sessionId = message.session_id;
        logToFile('Captured session_id:', sessionId);

        // Update agent state with session ID
        if (streamingInput) {
          ui.setAgentState({ sessionId });
        }
      }

      handleSDKMessage(message, options, spinner, collectedText, pendingToolCalls, isInterruptingRef.value);

      // Check for completion
      if (message.type === 'result') {
        if (message.subtype === 'success') {
          logToFile('Received successful result');
        } else {
          logToFile('Received non-success result:', message.subtype);
        }
        break;
      }
    }

    const durationMs = Date.now() - startTime;
    logToFile(`Agent run completed in ${Math.round(durationMs / 1000)}s`);
    logToFile('Session ID for resuming:', sessionId);

    // Check if we were interrupted and need to prompt for user input
    if (waitingForUserInput && streamingInput && sessionId) {
      logToFile('Stream ended after interrupt, waiting for user input');
      spinner.stop();

      // Prompt user for their next message
      const userMessage = await ui.text({
        message: 'What would you like the agent to do?',
        placeholder: 'Type your message...',
      });

      // Check if user cancelled
      if (typeof userMessage === 'symbol') {
        logToFile('User cancelled input, ending session');
        ui.setAgentState({ isRunning: false });
        return { sessionId, handle };
      }

      // Show user message in UI
      ui.addItem({
        type: 'user-message',
        text: userMessage,
      });

      // Resume the agent with the user's message using the SDK's resume feature
      logToFile('Resuming agent after user input with message:', userMessage);
      return await runAgent(
        agentConfig,
        userMessage,
        options,
        spinner,
        {
          ...config,
          resume: sessionId,
          streamingInput: true,
        },
      );
    }

    // Clean up streaming input
    if (streamingInput) {
      ui.stopPersistentInput();
      ui.setAgentState({ isRunning: false });
    }

    spinner.stop(successMessage);
    return { sessionId, handle };
  } catch (error) {
    // Suppress error display during interrupt - the SDK throws errors when interrupted
    // which is expected behavior, not an actual error condition
    const errorMsg = (error as Error).message || '';
    const isInterruptError = isInterruptingRef.value ||
      errorMsg.includes('aborted') ||
      errorMsg.includes('interrupted') ||
      errorMsg.includes('403');

    // Only show error message and throw if it's not an interrupt-related error
    if (!isInterruptError) {
      // Clean up on real error
      if (streamingInput) {
        ui.stopPersistentInput();
        ui.setAgentState({ isRunning: false });
      }
      spinner.stop(errorMessage);
      ui.addItem({ type: 'error', text: `Error: ${errorMsg}` });
      logToFile('Agent run failed:', error);
      debug('Full error:', error);
      throw error;
    }

    // Handle interrupt error
    spinner.stop();
    logToFile('Agent interrupted (errors suppressed):', errorMsg);

    // If user pressed Esc and is waiting for input, show the text prompt
    if (waitingForUserInput && streamingInput && sessionId) {
      logToFile('Waiting for user input after Esc interrupt');

      // Prompt user for their next message
      const userMessage = await ui.text({
        message: 'What would you like the agent to do?',
        placeholder: 'Type your message...',
      });

      // Check if user cancelled
      if (typeof userMessage === 'symbol') {
        logToFile('User cancelled input, ending session');
        ui.setAgentState({ isRunning: false });
        return { sessionId, handle };
      }

      // Show user message in UI
      ui.addItem({
        type: 'user-message',
        text: userMessage,
      });

      // Resume the agent with the user's message using the SDK's resume feature
      logToFile('Resuming agent after user input with message:', userMessage);
      return await runAgent(
        agentConfig,
        userMessage,
        options,
        spinner,
        {
          ...config,
          resume: sessionId,
          streamingInput: true,
        },
      );
    }

    // Clean up on interrupt without waiting for input
    if (streamingInput) {
      ui.stopPersistentInput();
      ui.setAgentState({ isRunning: false });
    }
    return { sessionId, handle };
  }
}

/**
 * Pending tool call info stored while waiting for result
 */
interface PendingToolCall {
  toolName: string;
  input: Record<string, unknown>;
  description?: string;
}

/**
 * Extract result summary from tool result content
 */
function extractResultSummary(
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
 * Handle SDK messages and provide user feedback.
 * Handles assistant text, tool use, tool results, and system messages.
 */
function handleSDKMessage(
  message: SDKMessage,
  options: WizardOptions,
  spinner: SpinnerInstance,
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
