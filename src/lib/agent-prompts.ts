/**
 * Agent prompt templates for raindrop.ai integration wizard
 */

interface IntegrationPromptParams {
  frameworkName: string;
  frameworkVersion: string;
  otelProviderInfo: string;
  documentation: string;
}

/**
 * Main integration prompt template
 */
export function integrationPrompt({
  frameworkName,
  frameworkVersion,
  otelProviderInfo,
  documentation,
}: IntegrationPromptParams): string {
  const docsSection = documentation
    ? `\n\nInstallation documentation:\n${documentation}\n`
    : '';

  // Determine SDK description based on framework
  let sdkDescription: string;
  if (frameworkName === 'Vercel AI SDK') {
    sdkDescription = '   - The project uses the Vercel AI SDK to make LLM API calls';
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

Focus on files where LLM API calls are made - these are the files that need to be modified to
integrate raindrop.ai. ${docsSection}

## Testing & Verification

After completing the integration:

1. Signal test readiness: Output exactly "[START_INTEGRATION_TEST]" on its own line
2. Wait for test results containing:
   - Raw event data (JSON or OTEL format)
   - User feedback message
3. Analyze BOTH the data and user's comments:
   - Check if events/traces are being received
   - Verify required fields (model, input, output, tokens, etc.)
   - Consider user's observations
4. Based on analysis:
   - SUCCESS: User confirms + valid events → Report completion
   - ISSUES FOUND: Fix code and output "[START_INTEGRATION_TEST]" again
   - NO EVENTS: Debug endpoint/configuration and retry
5. Maximum 3 test attempts - after that, report issues and request user help`;
}

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

Analyze the events and user feedback:
- If user confirms success ("looks good") AND events are valid → Report completion
- If user reports issues OR events are missing/malformed → Fix code and signal [START_INTEGRATION_TEST] to retest
- If no events received → Debug endpoint configuration and retest

You have ${3 - attemptNumber} attempt(s) remaining.`;
}

/**
 * Format OTEL provider info string
 */
export function formatOtelProviderInfo(otelProvider: string): string {
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
