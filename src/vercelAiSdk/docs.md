# Integrating raindrop.ai with Vercel AI SDK

## Overview

If you’re using the Vercel AI SDK, Raindrop can automatically track AI events and traces using the AI SDK’s OpenTelemetry integration.

To integrate Raindrop with the Vercel AI SDK you’ll complete two steps:
Configure an OpenTelemetry (OTEL) trace exporter (instructions differ for Next.js, Node.js, and Cloudflare Workers).
Instrument your Vercel AI SDK calls and attach Raindrop metadata (common to all).

{configure OTEL trace exporter}

## Instrumenting AI SDK Calls

### Requirements

1. Enable telemetry at **all** AI SDK call sites:
   ```ts
   experimental_telemetry: { isEnabled: true }
   ```
2. Attach Raindrop metadata on the **top-level** user interaction.

### Example

```ts
import { generateText, openai, tool } from "ai";
import { z } from "zod";
import raindrop from "raindrop-ai/otel";

const enhanceStory = tool({
  description: "Enhance a story with additional details",
  parameters: z.object({
    story: z.string(),
  }),
  execute: async ({ story }) => {
    const enhanced = await generateText({
      model: openai("gpt-4o"),
      prompt: `Enhance this story with more vivid details: ${story}`,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "enhance-story",
      },
    });
    return { enhancedStory: enhanced.text };
  },
});

const result = await generateText({
  model: openai("gpt-4o"),
  prompt: "Write a short story about a cat.",
  tools: { enhanceStory },
  experimental_telemetry: {
    isEnabled: true,
    functionId: "generate-text",
    metadata: {
      ...raindrop.metadata({
        userId: "user_123",
        eventName: "story_generation",
        convoId: "convo_123",
      }),
    },
  },
});
```

---

## Troubleshooting

### Enable OTEL debug logging

```bash
OTEL_LOG_LEVEL=debug npm run dev
```

### Missing spans on nested calls

```ts
// ❌ Not traced
await generateText({ ... });

// ✅ Traced
await generateText({
  ...,
  experimental_telemetry: { isEnabled: true },
});
```

### Cloudflare Workers: missing spans

Ensure streaming responses flush spans:

```ts
ctx.waitUntil(result.text);
```
