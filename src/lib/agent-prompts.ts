/**
 * Agent prompt templates for raindrop.ai integration wizard
 */

import type { FrameworkConfig } from './framework-config.js';
import { logToFile } from '../utils/debug.js';

/**
 * Build test feedback message for agent
 */
export function buildTestFeedbackMessage(
  events: Array<{ url: string; data: any }>,
  userFeedback: string,
  attemptNumber: number,
): string {
  const eventSummary =
    events.length > 0
      ? events
        .map((event, idx) => {
          const format = event.data.format === 'otel' ? 'OTEL' : 'JSON';
          const spanCount = event.data.spans?.length || 0;
          const aiAttrs = event.data.aiAttributes || event.data;

          return `Event #${idx + 1} at ${event.url}:
Format: ${format}
${spanCount > 0 ? `Spans: ${spanCount}` : ''}
Data: ${JSON.stringify(aiAttrs, null, 2)}`;
        })
        .join('\n\n')
      : 'No events received.';

  return `# Integration Test Results (Attempt ${attemptNumber})

## Events Collected

${eventSummary}

## User Feedback

"${userFeedback}"

## Your Task

Analyze the events and user feedback, then fix the code to address any issues:
1. Review the event data structure and user's comments
2. Identify what's missing or incorrect
3. Update the integration code to fix the problems
4. The wizard will automatically retest after your fixes

You have ${3 - attemptNumber} attempt(s) remaining.`;
}

/**
 * Format OTEL provider info string
 */
function formatOtelProviderInfo(otelProvider: string): string {
  if (otelProvider === 'sentry') {
    return (
      `- OTEL Provider: 'sentry'\n` +
      `Integrate raindrop.ai alongside Sentry. Ensure compatibility with existing Sentry ` +
      `configuration.`
    );
  } else if (otelProvider === 'other') {
    return (
      `- OTEL Provider: 'other'\n` +
      `Integrate raindrop.ai alongside an existing OTEL provider other than Sentry. ` +
      `Ensure compatibility with the existing OTEL setup.`
    );
  }
  return '';
}

/**
 * Build the integration prompt for the agent.
 * Uses shared base prompt with optional framework-specific documentation.
 */
export async function buildIntegrationPrompt(
  config: FrameworkConfig,
  context: {
    frameworkVersion: string;
    otelProvider?: string;
  },
): Promise<string> {
  let documentation = '';
  if (config.prompts.getDocumentation) {
    try {
      documentation = await config.prompts.getDocumentation();
    } catch (error) {
      logToFile('Error loading documentation:', error);
      // Continue without documentation if loading fails
    }
  }

  const otelProviderInfo = context.otelProvider
    ? formatOtelProviderInfo(context.otelProvider)
    : '';

  const frameworkName = config.metadata.name;
  const frameworkVersion = context.frameworkVersion;
  const docsSection = documentation
    ? `\n\nInstallation documentation:\n${documentation}\n`
    : '';

  // Determine SDK description based on framework
  let sdkDescription: string;
  if (frameworkName === 'Vercel AI SDK') {
    sdkDescription =
      '   - The project uses the Vercel AI SDK to make LLM API calls';
  } else if (frameworkName === 'Python') {
    sdkDescription =
      '   - The project uses Python SDKs like openai, anthropic, google-generativeai, litellm, etc. to make LLM API calls';
  } else {
    sdkDescription =
      '   - The project uses TypeScript SDKs like openai, @anthropic-ai/sdk, @google/generative-ai, litellm, etc. to make LLM API calls';
  }

  return `Integrate raindrop.ai into this ${frameworkName} project that makes calls to LLM APIs.

Project context:
- Framework: ${frameworkName} ${frameworkVersion}
${otelProviderInfo}

Instructions:

1. Install the raindrop.ai SDK package using the appropriate package manager for this project:
   - Detect the package manager by checking for lockfiles or configuration files
     (e.g., package-lock.json/yarn.lock/pnpm-lock.yaml for Node.js,
     requirements.txt/poetry.lock/Pipfile for Python, etc.)
   - Use the detected package manager to install the raindrop.ai SDK
     (e.g., npm/yarn/pnpm/bun for Node.js, pip/poetry/pipenv for Python)
   - Do not manually edit package.json, requirements.txt, or lockfiles - use the package manager
     commands instead
   - You will be provided raindrop.ai documentation for this integration below

2. Integrate raindrop.ai where the project makes calls to LLM APIs:
   - Find files that contain LLM API client initialization, API calls, or request handlers
${sdkDescription}
   - Use an existing user ID (from authentication, session, etc.), or generate one if unavailable (e.g., with UUID)

3. Initialize raindrop.ai with the appropriate configuration:
   - Read the RAINDROP_WRITE_KEY environment variable from .env (located at the project root)
   - Use this environment variable where applicable

4. Follow best practices for ${frameworkName} and ensure the integration doesn't break existing
   functionality.

5. Verify the build and check for errors before finishing:
   - After making all changes, test the project to ensure it builds/runs without errors
   - For TypeScript/JavaScript projects: run the build command (npm run build, pnpm build, yarn build, etc.)
   - For Python projects: check for syntax errors by running the main server script (e.g., python app.py, python main.py, uvicorn main:app, flask run, or similar)
   - If you encounter errors (compilation errors, import errors, syntax errors, type mismatches), fix them
   - After fixing, re-run the build/server command to verify the fixes worked
   - Repeat until the project builds or starts successfully without errors
   - Also run type checking if available (tsc --noEmit for TypeScript, mypy for Python)

Focus on files where LLM API calls are made - these are the files that need to be modified to
integrate raindrop.ai. ${docsSection}

## Signaling Completion

CRITICAL: After you have completed all integration steps, you MUST call the CompleteIntegration
tool to signal that you're done.

The CompleteIntegration tool is available to you. Call it with an empty object:
- Tool: CompleteIntegration
- Input: {} (empty)

Do NOT call this tool until you have:
1. Successfully installed the raindrop.ai package
2. Integrated raindrop.ai into all relevant LLM API call sites
3. Verified the project builds/runs without errors

Once you call CompleteIntegration, the wizard will automatically transition to the testing phase
where the integration will be validated.

## Testing & Verification

After completing the integration, the wizard will test it automatically.

If issues are found:
1. Analyze the test results and user feedback
2. Fix the code to address the issues
3. The wizard will automatically test again after you're done

Maximum 3 test attempts will be allowed.`;
}
