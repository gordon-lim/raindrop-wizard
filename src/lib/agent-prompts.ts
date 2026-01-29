/**
 * Agent prompt templates for Raindrop integration wizard
 */

import type { FrameworkConfig } from './framework-config.js';
import type { WizardOptions } from '../utils/types.js';
import { logToFile } from '../utils/debug.js';

/**
 * Build test feedback message for agent
 */
export function buildTestFeedbackMessage(
  events: Array<{ url: string; data: any }>,
  userFeedback: string,
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

  return `# Integration Test Results

## Events Collected

${eventSummary}

## User Feedback

"${userFeedback}"

## Your Task

Analyze the events and user feedback, then fix the code to address any issues:
1. Review the event data structure and user's comments
2. Identify what's missing or incorrect
3. Update the integration code to fix the problems
4. Verify the build still succeeds after your fixes
5. Call CompleteIntegration with \`{}\` when done`;
}

/**
 * Format OTEL provider info string
 */
function formatOtelProviderInfo(otelProvider: string): string {
  if (otelProvider === 'sentry') {
    return (
      `- OTEL Provider: 'sentry'\n` +
      `Integrate Raindrop alongside Sentry. Ensure compatibility with existing Sentry ` +
      `configuration.`
    );
  } else if (otelProvider === 'other') {
    return (
      `- OTEL Provider: 'other'\n` +
      `Integrate Raindrop alongside an existing OTEL provider other than Sentry. ` +
      `Ensure compatibility with the existing OTEL setup.`
    );
  }
  return '';
}

/**
 * Plan schema template for structured integration plans
 */
export const PLAN_SCHEMA_TEMPLATE = `
## Plan Format

When creating a plan, use this structure. The goal is a high-level overview the user can quickly glance at to confirm: "yes, this looks right." Keep it short and scannable—not a detailed spec.

---

### Project Overview

**Description:** [1-2 sentences about what this project does and its tech stack]

**Package Manager:** [npm/yarn/pnpm/poetry/pip]

---

### AI Integration Points

Files where LLM/AI logic lives:

| File | Purpose | SDK Used |
|------|---------|----------|
| \`path/to/file.ts\` | [What this file does with AI] | [openai/anthropic/etc] |

---

### Integration Plan

#### 1. Install Raindrop SDK
- [ ] Install \`@raindrop/sdk\` using [package manager]
- [ ] Add RAINDROP_WRITE_KEY to .env

#### 2. Core Integration
- [ ] [Specific file]: Wrap LLM client initialization
- [ ] [Specific file]: Add tracing to API calls

#### 3. Feature: [Feature Name]
**What it does:** [Brief explanation of this Raindrop feature]
**Where to add it:** \`path/to/file.ts\`
**Implementation:**
- [ ] [Step 1]
- [ ] [Step 2]

[Repeat Section 3 for each feature]

#### 4. Verify Build
- [ ] Run build command
- [ ] Fix any type errors

---
`;

/**
 * Format first action instructions for the agent based on framework
 */
function formatFirstActionInstructions(frameworkName: string): string {
  if (frameworkName === 'TypeScript' || frameworkName === 'Python') {
    return `## First Action

Your first action MUST be to discover which optional features to integrate:

1. **Review the ### Features section** in the documentation below to understand all optional features Raindrop supports (e.g., Attachments, Identifying Users, Tracking Signals, Tracing, etc.)

2. **Detect existing feature usage** in the project:
   - Search for existing user feedback mechanisms (thumbs up/down, ratings) → relevant to Signals
   - Search for user identification/auth patterns → relevant to Identifying Users
   - Search for file/image handling in LLM calls → relevant to Attachments
   - Search for existing tracing/observability setup → relevant to Tracing

3. **Call AskUserQuestion** to confirm which detected features to integrate:
   - Only ask about features you actually detected in the project
   - Phrase it as: "I found (some) features in your project. Which features would you like to integrate with Raindrop?"
   - The recommended option should be all of them.

4. **Then call EnterPlanMode** to create a plan based on their answers`;
  }

  // Default for other frameworks (e.g., Vercel AI SDK)
  return `## First Action

Your first action MUST be to call the EnterPlanMode tool. This will allow you to:
- Explore the codebase to understand the project structure and LLM API usage
- Use AskUserQuestion to clarify details (e.g., which features to integrate)
- Create a plan before making any changes`;
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
    sessionId: string;
  },
  options: WizardOptions,
): Promise<string> {
  let documentation = '';
  if (config.prompts.getDocumentation) {
    try {
      documentation = await config.prompts.getDocumentation(options);
    } catch (error) {
      logToFile('Error loading documentation:', error);
      // Continue without documentation if loading fails
    }
  }

  // Replace wizardSession placeholder with the actual session ID
  if (documentation) {
    documentation = documentation.replace(
      /__WIZARD_SESSION_UUID__/g,
      context.sessionId,
    );
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

  return `Integrate Raindrop into this ${frameworkName} project.

## Context
- Framework: ${frameworkName} ${frameworkVersion}
${otelProviderInfo}
${sdkDescription}

## Instructions

1. **Install Raindrop SDK**
   - Detect the package manager from lockfiles (package-lock.json, yarn.lock, pnpm-lock.yaml, poetry.lock, etc.)
   - Use the package manager to install - do NOT manually edit dependency files
   - Documentation is provided below

2. **Integrate at LLM API call sites**
   - Find files with LLM client initialization or API calls
   - Use an existing user ID from auth/session, or generate one with UUID if unavailable
   - Use RAINDROP_WRITE_KEY from environment variables (already loaded - DO NOT read .env file directly)

3. **Verify the build**
   - Run the build/type-check command and fix any errors
   - Repeat until the project builds successfully

Follow ${frameworkName} best practices. Focus on files where LLM API calls are made.${docsSection}



## Completion

Only call CompleteIntegration after you have:
1. Installed the Raindrop package
2. Integrated at all LLM API call sites
3. Verified the build succeeds

${formatFirstActionInstructions(frameworkName)}

${PLAN_SCHEMA_TEMPLATE}`;
}
