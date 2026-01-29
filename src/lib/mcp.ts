/**
 * MCP server utilities for the Claude agent
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { logToFile } from '../utils/debug.js';

/**
 * Create an in-process MCP server with the CompleteIntegration tool
 */
export function createCompletionMcpServer(hasCompletedWorkRef: {
  value: boolean;
}): any {
  const completionTool = tool(
    'CompleteIntegration',
    'Signals that the Raindrop integration is complete. Call this tool ONLY after you have: 1) Successfully installed the Raindrop package, 2) Integrated Raindrop into all relevant LLM API call sites, and 3) Verified the project builds/runs without errors.',
    z.object({}), // No input parameters
    (_args: Record<string, never>, _extra: unknown): any => {
      logToFile(
        'Agent called CompleteIntegration tool - integration is complete',
      );

      // Set the completion flag
      hasCompletedWorkRef.value = true;

      return {
        content: [
          {
            type: 'text',
            text: 'Integration completion acknowledged. Transitioning to testing phase...',
          },
        ],
      };
    },
  );

  return createSdkMcpServer({
    name: 'raindrop-wizard',
    version: '1.0.0',
    tools: [completionTool],
  });
}
