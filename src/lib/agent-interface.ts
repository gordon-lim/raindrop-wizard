/**
 * Shared agent interface for  wizards
 * Uses Claude Agent SDK directly with streaming input support
 */

import path from 'path';
import { createRequire } from 'module';
import ui from '../utils/ui.js';
import type { AgentQueryHandle } from '../ui/types.js';
import { debug, logToFile, initLogFile, LOG_FILE_PATH } from '../utils/debug.js';
import { createCanUseToolHandler, createAgentQueryHandle, type PendingToolCall, type SessionInfo } from './handlers.js';
import { processSDKMessage } from './sdk-messages.js';
import { createCompletionMcpServer } from './mcp.js';
import type { WizardOptions } from '../utils/types.js';
import { query } from '@anthropic-ai/claude-agent-sdk';

// Create a require function for ESM compatibility
const require = createRequire(import.meta.url);

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
 * Result from runAgentLoop including session ID and query handle
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
    });

    if (options.debug) {
      debug('Agent config:', {
        workingDirectory: agentRunConfig.workingDirectory,
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
 * Configuration for runAgentLoop
 */
export interface RunAgentConfig {
  spinnerMessage?: string;
  successMessage?: string;
  resume?: string;
  accessToken: string;
}

/**
 * Execute an agent with the provided prompt and options.
 * Supports streaming input for user interruption and follow-up messages.
 * Uses a while loop to handle user interactions instead of recursion.
 *
 * @returns Session ID and query handle for controlling the agent
 */
export async function runAgentLoop(
  agentConfig: AgentRunConfig,
  prompt: string,
  options: WizardOptions,
  config?: RunAgentConfig,
): Promise<AgentRunResult> {
  const {
    spinnerMessage = 'Customizing your  setup...',
    successMessage = 'Raindrop integration complete',
    resume,
    accessToken,
  } = config ?? {} as RunAgentConfig;


  // Add header to indicate start of interactive agent phase
  ui.addItem({ type: 'phase', text: '### Agent ###' });

  const cliPath = getClaudeCodeExecutablePath();
  logToFile('Starting agent run');
  logToFile('Claude Code executable:', cliPath);

  // Loop-persistent state
  let currentPrompt = prompt;
  let currentSessionId: string | undefined = resume;
  let handle: AgentQueryHandle;

  while (true) {
    const spinner = ui.spinner();

    logToFile('Prompt:', currentPrompt);
    if (currentSessionId) {
      logToFile('Resuming session:', currentSessionId);
    }

    // Timing and session state
    const startTime = Date.now();
    let sessionId: string | undefined = currentSessionId;
    let queryObject: any = null;

    // Message and tool call collectors
    const collectedText: string[] = [];
    const pendingToolCalls = new Map<string, PendingToolCall>();

    // Shared ref objects for cross-boundary state
    const hasCompletedWorkRef = { value: false };
    const isInterruptingRef = { value: false };
    const waitingForUserInputRef = { value: false };
    const pendingUserMessageRef = { value: null as string | null };

    // Promise resolver for waiting on user input after interrupt
    let resolveUserMessage: ((message: string) => void) | null = null;

    // Query handle for external control (interrupt, etc.)
    handle = createAgentQueryHandle({
      isInterruptingRef,
      waitingForUserInputRef,
      pendingToolCalls,
      getQueryObject: () => queryObject,
    });

    // Create MCP server with CompleteIntegration tool
    const completionMcpServer = createCompletionMcpServer(hasCompletedWorkRef);

    // Define callbacks for persistent input
    const handlePersistentSubmit = async (message: string) => {
      if (isInterruptingRef.value) {
        // Already interrupted - resolve the waiting promise with this message
        logToFile('User submitted message after interrupt:', message);
        pendingUserMessageRef.value = message;
        if (resolveUserMessage) {
          resolveUserMessage(message);
          resolveUserMessage = null;
        }
      } else {
        // Not yet interrupted - store message and trigger interrupt
        pendingUserMessageRef.value = message;
        logToFile('User submitted message while agent running - triggering interrupt');
        handle.interrupt();
      }
    };

    const handlePersistentInterrupt = () => {
      logToFile('User requested interrupt (Esc)');
      // Stop spinner immediately - persistent input stays visible
      spinner.stop();
      handle.interrupt();
    };

    spinner.start(spinnerMessage);
    ui.startPersistentInput({
      onSubmit: handlePersistentSubmit,
      onInterrupt: handlePersistentInterrupt,
    });

    // Session info for notifications
    const sessionInfo: SessionInfo = {
      sessionId: options.sessionId,
      accessToken,
    };

    queryObject = query({
      prompt: currentPrompt,
      options: {
        model: agentConfig.model,
        cwd: agentConfig.workingDirectory,
        permissionMode: 'default',
        mcpServers: {
          'raindrop-wizard': completionMcpServer,
        },
        systemPrompt: "{WIZARD_SYSTEM_PROMPT}",
        env: { ...process.env },
        resume: currentSessionId,
        canUseTool: createCanUseToolHandler(sessionInfo),
        stderr: (data: string) => {
          logToFile('CLI stderr:', data);
          if (options.debug) {
            debug('CLI stderr:', data);
          }
        },
      },
    });

    // Update agent state
    ui.setAgentState({
      isRunning: true,
      queryHandle: handle,
    });

    // Process the query stream
    for await (const message of queryObject) {
      // Capture session_id from any message
      if (message.session_id && !sessionId) {
        sessionId = message.session_id;
        ui.setAgentState({ sessionId });
      }

      processSDKMessage(message, options, collectedText, pendingToolCalls, isInterruptingRef.value);
    }

    const durationMs = Date.now() - startTime;
    logToFile(`Agent run completed in ${Math.round(durationMs / 1000)}s`);
    logToFile('Session ID for resuming:', sessionId);
    logToFile('Completion status:', hasCompletedWorkRef.value);

    // Check if we need user input to continue (either stream ended without completion or interrupted)
    const needsUserInput = !hasCompletedWorkRef.value && !waitingForUserInputRef.value && sessionId;
    const wasInterrupted = waitingForUserInputRef.value && sessionId;

    if (needsUserInput || wasInterrupted) {
      if (needsUserInput) {
        logToFile('Stream ended but agent has not called CompleteIntegration - waiting for user response');
      } else {
        logToFile('Stream ended after interrupt, waiting for user input');
      }

      spinner.stop();
      ui.setAgentState({ isRunning: false });

      // Get the resume message - either from pending submit or wait for user to submit
      let userMessage: string;

      if (pendingUserMessageRef.value) {
        // Message was submitted during execution - use it directly
        userMessage = pendingUserMessageRef.value;
        pendingUserMessageRef.value = null; // Clear for next iteration
        logToFile('Using pending user message:', userMessage);
      } else {
        // No pending message - wait for user to submit via persistent input
        logToFile('Waiting for user to submit message via persistent input...');

        // Persistent input is already visible, spinner already stopped - just wait for user

        userMessage = await new Promise<string>((resolve) => {
          resolveUserMessage = resolve;
        });

        // Check if user cancelled (empty message from Esc)
        if (!userMessage) {
          logToFile('User cancelled input, ending session');
          ui.stopPersistentInput();
          return { sessionId, handle };
        }

        logToFile('Received user message from persistent input:', userMessage);
      }

      // Show user message in UI
      ui.addItem({
        type: 'user-message',
        text: userMessage,
      });

      // Update state for next iteration
      logToFile('Resuming agent with user message:', userMessage);
      currentPrompt = userMessage;
      currentSessionId = sessionId;
      continue;
    }

    // Normal completion - clean up and return
    ui.stopPersistentInput();
    ui.setAgentState({ isRunning: false });
    spinner.stop(successMessage);
    return { sessionId, handle };
  }
}

