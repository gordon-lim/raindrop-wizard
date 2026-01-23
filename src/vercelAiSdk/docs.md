To integrate Raindrop with the Vercel AI SDK you'll complete two steps:

1. Configure an OpenTelemetry (OTEL) trace exporter (instructions differ for Next.js, Node.js, and Cloudflare Workers).
2. Instrument your Vercel AI SDK calls and attach Raindrop metadata (common to all).

{configure OTEL trace exporter}

## Instrumenting AI SDK Calls

To instrument your AI SDK calls:

1. Enable `experimental_telemetry: { isEnabled: true }` at all AI SDK call sites
2. Add Raindrop metadata at the top-level call that handles user input and produces the final output using `raindrop.metadata()` 

```typescript
import { generateText, openai, tool } from 'ai';
import { z } from 'zod';
import raindrop from 'raindrop-ai/otel';

const enhanceStory = tool({
  description: 'Enhance a story with additional details',
  parameters: z.object({
    story: z.string().describe('The story to enhance'),
  }),
  execute: async ({ story }) => {
    // This nested call only needs isEnabled: true, no metadata
    const enhanced = await generateText({
      model: openai('gpt-4o'),
      prompt: `Enhance this story with more vivid details: ${story}`,
      experimental_telemetry: {
        isEnabled: true, // Required at all call sites
        functionId: 'enhance-story',
      },
    });
    return { enhancedStory: enhanced.text };
  },
});

const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Write a short story about a cat.',
  tools: {
    enhanceStory,
  },
  experimental_telemetry: {
    isEnabled: true, // Required
    functionId: 'generate-text',
    metadata: {
      ...raindrop.metadata({
        userId: 'user_123', // Required
        eventName: 'story_generation',
        convoId: 'convo_123',
      }),
    },
  },
});
```

## Troubleshooting

### Enable OpenTelemetry Debug Logging

If traces aren't appearing in the Raindrop dashboard, enable debug logging to see what's happening under the hood:

```bash
OTEL_LOG_LEVEL=debug npm run dev
```

This will output detailed logs about span creation, export attempts, and any errors during trace transmission.

### Ensure Telemetry is Enabled at All Call Sites

A common issue is forgetting to add `experimental_telemetry: { isEnabled: true }` to nested AI SDK calls. **Every** `generateText`, `streamText`, `generateObject`, etc. call must have telemetry enabled for traces to be captured:

```typescript
// ❌ Won't be traced - missing experimental_telemetry
const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Hello world',
});

// ✅ Will be traced
const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Hello world',
  experimental_telemetry: { isEnabled: true },
});
```

### Cloudflare Workers: Spans Incomplete or Missing

**Streaming responses require `waitUntil`**

The `instrument()` wrapper flushes spans when the handler returns. With streaming, the handler returns immediately while the LLM is still generating. Without `waitUntil`, spans get flushed before they complete:

```typescript
// ❌ Spans will be incomplete
const result = streamText({ ... });
return result.toTextStreamResponse();

// ✅ Spans will be complete
const result = streamText({ ... });
ctx.waitUntil(result.text);  // Delays flush until stream completes
return result.toTextStreamResponse();
```

If your spans show 1ms durations or are missing child spans, this is likely the cause.