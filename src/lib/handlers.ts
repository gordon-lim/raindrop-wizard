/**
 * Tool approval handlers for the Claude agent
 * Handles UI integration for tool approvals and clarifying questions
 */

import ui from '../utils/ui.js';
import type { ToolApprovalResult, AgentQueryHandle } from '../ui/types.js';
import { logToFile } from '../utils/debug.js';
import { createTwoFilesPatch } from 'diff';
import { SAFE_BASH_PATTERNS } from './constants.js';
import { sendSessionUpdate } from '../utils/session.js';

// ============================================================================
// Pending Tool Call Types
// ============================================================================

/**
 * Pending tool call info stored while waiting for result
 */
export interface PendingToolCall {
  toolName: string;
  input: Record<string, unknown>;
  description?: string;
}

// ============================================================================
// Agent Query Handle Factory
// ============================================================================

/**
 * Dependencies required for creating an AgentQueryHandle
 */
export interface AgentQueryHandleDeps {
  isInterruptingRef: { value: boolean };
  waitingForUserInputRef: { value: boolean };
  pendingToolCalls: Map<string, PendingToolCall>;
  getQueryObject: () => { interrupt?: () => Promise<void> } | null;
}

/**
 * Create an AgentQueryHandle for external control of the agent.
 * Handles interrupts by marking pending tool calls (keeps persistent input running).
 */
export function createAgentQueryHandle(
  deps: AgentQueryHandleDeps,
): AgentQueryHandle {
  const {
    isInterruptingRef,
    waitingForUserInputRef,
    pendingToolCalls,
    getQueryObject,
  } = deps;

  return {
    interrupt: async () => {
      logToFile('Soft interrupt requested (Esc)');
      isInterruptingRef.value = true;
      waitingForUserInputRef.value = true;

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

      // Note: Don't stop persistent input here - keep it visible for user to type their message
      // The spinner will be stopped separately, and the input remains for user to submit

      // Call SDK interrupt
      const queryObject = getQueryObject();
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
      logToFile(
        'sendMessage called but not supported - use interrupt and resume',
      );
    },
  };
}

// ============================================================================
// Enhanced canUseTool Handler with UI Integration
// ============================================================================

/**
 * Generate a unified diff for Edit tool inputs (old_string -> new_string)
 */
function generateEditDiff(
  filePath: string,
  oldString: string,
  newString: string,
): string {
  // createTwoFilesPatch generates a unified diff
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
 * Handle tool approval request by showing approval UI
 */
async function handleToolApproval(
  toolName: string,
  input: Record<string, unknown>,
): Promise<ToolApprovalResult> {
  logToFile('Showing tool approval UI:', { toolName, input });

  // Extract file path
  const fileName =
    typeof input.file_path === 'string'
      ? input.file_path
      : typeof input.path === 'string'
      ? input.path
      : undefined;

  // Generate diff content for file modification tools
  let diffContent: string | undefined;
  if (
    toolName === 'Edit' &&
    typeof input.old_string === 'string' &&
    typeof input.new_string === 'string' &&
    fileName
  ) {
    // Edit: show old -> new diff
    diffContent = generateEditDiff(
      fileName,
      input.old_string,
      input.new_string,
    );
  } else if (
    toolName === 'Write' &&
    typeof input.content === 'string' &&
    fileName
  ) {
    // Write: show content as all additions (empty -> content)
    diffContent = generateEditDiff(fileName, '', input.content);
  } else if (typeof input.file_diff === 'string') {
    // Use pre-generated diff if available
    diffContent = input.file_diff;
  }

  // Build props for the approval prompt
  const props = {
    toolName,
    input,
    description:
      typeof input.description === 'string' ? input.description : undefined,
    diffContent,
    fileName,
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
 * Session info for notifications
 */
export interface SessionInfo {
  sessionId: string;
  accessToken: string;
  orgId: string;
}

/**
 * Handle the ExitPlanMode tool by showing plan approval UI.
 * Input contains { plan: "..." } with the plan in markdown format.
 * If user approves, returns allow. If user rejects, returns deny with feedback.
 */
async function handlePlanApproval(
  input: Record<string, unknown>,
  sessionInfo?: SessionInfo,
): Promise<ToolApprovalResult> {
  logToFile('Handling ExitPlanMode:', input);

  const planContent = typeof input.plan === 'string' ? input.plan : '';

  try {
    const result = await ui.planApproval({ planContent });
    logToFile('Plan approval result:', result);

    if (result.approved) {
      // Send session update with approved plan
      if (sessionInfo) {
        sendSessionUpdate(
          sessionInfo.sessionId,
          planContent,
          sessionInfo.accessToken,
          sessionInfo.orgId,
        );
      }

      // User approved the plan - allow the tool
      return {
        behavior: 'allow',
        updatedInput: input,
      };
    } else {
      // User rejected with feedback - deny the tool
      return {
        behavior: 'deny',
        message: result.feedback || 'User rejected plan',
      };
    }
  } catch (error) {
    logToFile('Error in plan approval:', error);
    return {
      behavior: 'deny',
      message: 'Failed to get user response',
    };
  }
}

/**
 * Tools that are automatically approved without user confirmation
 */
const AUTO_APPROVED_TOOLS = new Set([
  'mcp__raindrop-wizard__CompleteIntegration',
  'EnterPlanMode',
]);

/**
 * Check if a bash command matches a safe pattern and can be auto-approved.
 */
function isSafeBashCommand(command: string): boolean {
  const trimmed = command.trim();
  return SAFE_BASH_PATTERNS.some((pattern) => {
    if (pattern.startsWith('*')) {
      // Suffix match (e.g., '*--version')
      return trimmed.endsWith(pattern.slice(1));
    } else if (pattern.endsWith('*')) {
      // Prefix match (e.g., 'npm install*')
      return trimmed.startsWith(pattern.slice(0, -1));
    } else {
      // Exact match
      return trimmed === pattern;
    }
  });
}

/**
 * Create a canUseTool handler that integrates with the UI for approvals.
 * - Handles AskUserQuestion by showing clarifying questions UI
 * - Handles ExitPlanMode by showing plan approval UI
 * - Handles WebSearch by restricting to allowed domains
 * - Shows approval UI for other tools
 */
export function createCanUseToolHandler(sessionInfo?: SessionInfo) {
  return async (
    toolName: string,
    input: unknown,
  ): Promise<ToolApprovalResult> => {
    const inputRecord = input as Record<string, unknown>;
    logToFile('canUseTool called:', { toolName, input: inputRecord });

    if (AUTO_APPROVED_TOOLS.has(toolName)) {
      return {
        behavior: 'allow',
        updatedInput: inputRecord,
      };
    }

    // Auto-approve safe bash commands
    if (toolName === 'Bash' && typeof inputRecord.command === 'string') {
      if (isSafeBashCommand(inputRecord.command)) {
        logToFile('Auto-approving safe bash command:', inputRecord.command);
        return {
          behavior: 'allow',
          updatedInput: inputRecord,
        };
      }
    }

    // Handle WebSearch by adding allowed domains restriction
    if (toolName === 'WebSearch') {
      return {
        behavior: 'allow',
        updatedInput: {
          ...inputRecord,
          allowed_domains: ['raindrop.ai/docs', 'ai-sdk.dev/docs/'],
        },
      };
    }

    // Handle AskUserQuestion specially
    if (toolName === 'AskUserQuestion') {
      return handleClarifyingQuestions(inputRecord);
    }

    // Handle ExitPlanMode specially
    if (toolName === 'ExitPlanMode') {
      return handlePlanApproval(inputRecord, sessionInfo);
    }

    // Show approval UI for other tools
    return handleToolApproval(toolName, inputRecord);
  };
}
