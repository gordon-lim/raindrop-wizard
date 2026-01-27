### **Installation**

Install with your package manager of choice:

<CodeGroup>

```bash npm
npm install raindrop-ai
```


```bash yarn
yarn add raindrop-ai
```


```bash pnpm
pnpm add raindrop-ai
```


```bash bun
bun add raindrop-ai
```

</CodeGroup>

```typescript
import { Raindrop } from "raindrop-ai";

// Replace with the key from your Raindrop dashboard
const raindrop = new Raindrop({ writeKey: RAINDROP_API_KEY },
                                wizardSession='__WIZARD_SESSION_UUID__' // Required
);
```

### **Features**

- [Attachments](#attachments) - Include rich context (code, text, images, iframes) with events
- [Identifying Users](#identifying-users) - Associate traits and properties with users
- [Tracking Signals](#tracking-signals-feedback) - Attach user feedback (thumbs up/down, comments, edits) to events
- [PII Redaction](#pii-redaction) - Client-side PII redaction for privacy
- [AI Tracing (Beta)](#ai-tracing-beta) - Trace tool calls, tasks, and workflows with spans

---

## Quick-start: the **Interaction** API

The new interaction workflow is a three-step pattern:

1. **`begin()`** - creates an _interaction_ object and logs the initial user input.
2. **Update** - optionally call `setProperty`, `setProperties`, or `addAttachments`.
3. **`finish()`** - records the AI's final output and closes the interaction.

<Info>
  **Using Vercel AI SDK?** If you're using the Vercel AI SDK, you can use our easy integration [here](/sdk/auto-vercel-ai) to automatically track AI events and traces.
  It is currently in beta and we'd love your feedback while we continue to improve the experience!
</Info>

### Example: chat completion with the `ai` SDK

```typescript
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai'
import { randomUUID } from "crypto";
import { Raindrop } from "raindrop-ai";

const raindrop = new Raindrop({ writeKey: RAINDROP_API_KEY });

const message = "What is love?"
const eventId = randomUUID() // generate your own ID so you can correlate logs

// 1. Start the interaction
const interaction = raindrop.begin({
  eventId,
  event: "chat_message",
  userId : "user_123",
  input: message,
  model: "gpt-4o",
  convoId: "convo_123",
  properties: {
    tool_call: "reasoning_engine",
    system_prompt: "you are a helpful...",
    experiment: "experiment_a",
  },
});

const { text } = await generateText({
  model: openai("gpt-4o"),
  prompt: message
})

// 3. Finish and ship the event
interaction.finish({
  output: text,
});
```

### Updating an interaction

You can update an interaction at any time using `setProperty`, `setProperties`, or `addAttachments`.

```typescript
interaction.setProperty("stage", "embedding");
interaction.addAttachments([
  {
    type: "text",
    name: "Additional Info",
    value: "A very long document",
    role: "input",
  },
  { type: "image", value: "https://example.com/image.png", role: "output" },
  {
    type: "iframe",
    name: "Generated UI",
    value: "https://newui.generated.com",
    role: "output",
  },
]);
```

### Resuming an interaction

If you don't have access to the interaction object that was returned from `begin()`, you can resume an interaction by calling `resumeInteraction()`.

```typescript
const interaction = raindrop.resumeInteraction(eventId);
```

<Warning>
  Interactions are subject to the global 1 MB event limit; oversized payloads will be truncated. [Contact us](mailto:founders@raindrop.ai) if you have custom requirements.
</Warning>

---

## Single-shot tracking (**legacy** `trackAi`)

If your interaction is atomic (e.g. "user asked, model answered" in one function) you can still call `trackAi()` directly:

```typescript
raindrop.trackAi({
  event: "user_message",
  userId: "user123",
  model: "gpt-4o-mini",
  input: "Who won the 2023 AFL Grand Final?",
  output: "Collingwood by four points!",
  properties: {
    tool_call: "reasoning_engine",
    system_prompt: "you are a helpful...",
    experiment: "experiment_a",
  },
});
```

> **Heads‑up:** We recommend migrating to `begin()` → `finish()` for all new code so you gain partial‑event buffering, tracing helpers, and upcoming features such as automatic token counts.

---

## Tracking Signals (feedback)

Signals capture explicit or implicit quality ratings on an earlier AI event. Use `trackSignal()` with the **same** `eventId` you used in `begin()` or `trackAi()`.

| Parameter | Type                                   | Description                                   |
| --------- | -------------------------------------- | --------------------------------------------- |
| `eventId` | `string`                               | The ID of the AI event you're evaluating      |
| `name`    | `"thumbs_up", "thumbs_down"`,  `string` | Name of the signal (e.g. `"thumbs_up"`)       |
| `type`    | `"default", "feedback", "edit"`      | Optional, defaults to `"default"`             |
| `comment` | `string`                               | For `feedback` signals                        |
| `after`   | `string`                               | For `edit` signals – the user's final content |
| `sentiment` | `"POSITIVE", "NEGATIVE"`                          | Indicates whether the signal is positive (default is NEGATIVE)                        |
| _…others_ |                                        | See API reference                             |

```typescript
// User clicks a thumbs‑down button
await raindrop.trackSignal({
  eventId: "my_event_id",
  name: "thumbs_down",
  comment: "Answer was off-topic",
});
```

---

## Attachments

Attachments allow you to include context from the user or that the model outputted. These could be documents, generated images, code, or even an entire web page. They work the same way in `begin()` interactions and in single‑shot `trackAi` calls.

 Each attachment is an object with the following properties:

- `type` (string): The type of attachment. Can be "code", "text", "image", or "iframe".
- `name` (optional string): A name for the attachment. 
- `value` (string): The content or URL of the attachment.
- `role` (string): Either "input" or "output", indicating whether the attachment is part of the user input or AI output. 
- `language` (optional string): For code attachments, specifies the programming language.

```typescript
interaction.addAttachments([
  {
    type: "code",
    role: "input",
    language: "typescript",
    name: "example.ts",
    value: "console.log('hello');",
  },
  {
    type: "text",
    name: "Additional Info",
    value: "Some extra text",
    role: "input",
  },
  { type: "image", value: "https://example.com/image.png", role: "output" },
  { type: "iframe", value: "https://example.com/embed", role: "output" },
]);
```

Supported types: `code`, `text`, `image`, `iframe`.

---

## Identifying users

```typescript
raindrop.setUserDetails({
  userId: "user123",
  traits: {
    name: "Jane",
    email: "jane@example.com",
    plan: "pro",
    os: "macOS",
  },
});
```

---

## PII redaction

Read more on how Raindrop handles privacy and PII redaction [here](/security/pii-redaction). Note that this doesn't apply to beta features like tracing. You can enable client-side PII redaction when initializing the `Analytics` class like so:

```typescript
new Raindrop({
  writeKey: RAINDROP_API_KEY,
  redactPii: true,
});
```

---

## **Error Handling**

If an error occurs while sending events to Raindrop, an exception will be raised. Make sure to handle exceptions appropriately in your application.

---

## Configuration & helpers

- **Debug logs** – `debugLogs: true` prints every queued event.
- **Disabled** – `disabled: true` completely disables event sending and tracing (useful for dev/test).
- **Closing** – call `await raindrop.close()` before your process exits to flush buffers.

```typescript
new Raindrop({
  writeKey: RAINDROP_API_KEY,
  debugLogs: process.env.NODE_ENV !== "production",
  disabled: process.env.NODE_ENV === "test",
});
```

---

## AI Tracing (Beta)

<Warning>
  AI tracing is currently in beta. We'd love your feedback while we continue to improve the experience!
</Warning>

AI tracing allows you to track detailed AI pipeline execution, capturing step-by-step information of complex multi-model interactions or chained prompts. This helps you:

* Visualize the full execution flow of your AI application
* Debug and optimize complex prompt chains
* Understand intermediate steps that led to a specific generated output

### Getting Started with Tracing

Use `withSpan` or `withTool` on an interaction and any LLM calls inside are automatically captured.

```typescript
import { Raindrop } from "raindrop-ai";

const raindrop = new Raindrop({ writeKey: RAINDROP_API_KEY });

// Tracing works automatically - LLM calls are captured
const interaction = raindrop.begin({ ... });
await interaction.withSpan({ name: "my_task" }, async () => {
  // Any LLM calls here are automatically traced
});
```

**Next.js users:** Add `raindrop-ai` to [`serverExternalPackages`](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages) in your config:

```typescript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['raindrop-ai'],
}
 
module.exports = nextConfig
```

### Explicit Module Instrumentation

In some environments, automatic instrumentation of AI libraries may not work correctly due to module loading order or bundler behavior. You can use the `instrumentModules` option to explicitly specify which modules to instrument.

<Warning>
  **Important for Anthropic users:** You must use a module namespace import (`import * as ...`) for Anthropic, not the default export. See the example below.
</Warning>

```typescript
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import * as AnthropicModule from "@anthropic-ai/sdk";  // Module namespace import required!
import { Raindrop } from "raindrop-ai";

const raindrop = new Raindrop({
  writeKey: RAINDROP_API_KEY,
  instrumentModules: {
    openAI: OpenAI,
    anthropic: AnthropicModule,  // Pass the module namespace, NOT the default export
  },
});
```

Pass the module constructors or namespaces you want to instrument. Supported modules include `openAI`, `anthropic`, `cohere`, `bedrock`, `google_vertexai`, `google_aiplatform`, `pinecone`, `together`, `langchain`, `llamaIndex`, `chromadb`, `qdrant`, and `mcp`.

### Using `withSpan` for Task Tracing (Beta)

The `withSpan` method allows you to trace specific tasks or operations within your AI application. This is especially useful for tracking LLM requests. Any LLM call within the span will be automatically tracked, no further work required.

```typescript
// Basic task tracing
const result = await interaction.withSpan(
  { name: "generate_response" },
  async () => {
    // Task implementation
    return "Generated response";
  }
);

// Task with properties and input parameters
const result = await interaction.withSpan(
  {
    name: "embedding_generation",
    properties: { model: "text-embedding-3-large" },
    inputParameters: ["What is the weather today?"]
  },
  async () => {
    // Generate embeddings
    return [0.1, 0.2, 0.3, 0.4];
  }
);
```

#### Parameters

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `name` | `string` | Name of the task for identification in traces |
| `properties` | `Record<string, string>` (optional) | Key-value pairs for additional metadata |
| `inputParameters` | `unknown[]` (optional) | Array of input parameters for the task |

### Using `withTool` for Tool Tracing (Beta)

The `withTool` method allows you to trace any actions your agent takes. This could be as simple as saving or retrieving a memory, or using external services like web search or API calls. Tracing these actions helps you understand your agent's behavior and what led up to the agent's response.

```typescript
// Basic tool usage
const result = await interaction.withTool(
  { name: "search_tool" },
  async () => {
    // Call to external API or service
    return "Search results";
  }
);

// Tool with properties and input parameters
const result = await interaction.withTool(
  {
    name: "calculator",
    properties: { operation: "multiply" },
    inputParameters: { a: 5, b: 10 }
  },
  async () => {
    // Tool implementation
    return "Result: 50";
  }
);
```

#### Parameters

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `name` | `string` | Name of the tool for identification in traces |
| `version` | `number` (optional) | Version number of the tool |
| `properties` | `Record<string, string>` (optional) | Key-value pairs for additional metadata |
| `inputParameters` | `Record<string, any>` (optional) | Record of input parameters for the tool |
| `traceContent` | `boolean` (optional) | Flag to control whether content is traced |
| `suppressTracing` | `boolean` (optional) | Flag to suppress tracing for this tool invocation |

---

### Using with Existing OpenTelemetry Setup

If you already have an OpenTelemetry setup (e.g., Sentry, Datadog, Honeycomb), you can integrate Raindrop alongside your existing tracing infrastructure using `useExternalOtel`.

When `useExternalOtel: true`:
- Raindrop won't create its own OpenTelemetry SDK (avoids conflicts with your setup)
- You add Raindrop's span processor to your existing `NodeSDK`
- LLM calls and `withSpan`/`withTool` traces are sent to **both** Raindrop and your existing backend

```typescript
import { NodeSDK } from "@opentelemetry/sdk-node";
import * as AnthropicModule from "@anthropic-ai/sdk";  // Use namespace import for instrumentation
import Anthropic from "@anthropic-ai/sdk";
import { Raindrop } from "raindrop-ai";

// 1. Create Raindrop with useExternalOtel
const raindrop = new Raindrop({
  writeKey: RAINDROP_API_KEY,
  useExternalOtel: true,
  instrumentModules: { anthropic: AnthropicModule },  // Optional - specify modules to instrument
});

// 2. Create NodeSDK with Raindrop's processor and instrumentations
const sdk = new NodeSDK({
  spanProcessors: [
    raindrop.createSpanProcessor(),  // → Sends traces to Raindrop
    sentryProcessor,                  // → Your existing processor (Sentry, Datadog, etc.)
  ],
  instrumentations: raindrop.getInstrumentations(),  // AI library instrumentations
});
sdk.start();

// 3. Create AI clients AFTER SDK starts (required for instrumentation)
const anthropic = new Anthropic({ apiKey: "..." });

// 4. Use Raindrop normally - LLM input/output is captured!
const interaction = raindrop.begin({
  eventId: "my-event",
  event: "chat_request",
  userId: "user_123",
  input: "Hello!",
});

await interaction.withSpan({ name: "generate_response" }, async () => {
  const response = await anthropic.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 100,
    messages: [{ role: "user", content: "Hello!" }],
  });
  return response;
});

interaction.finish({ output: "Response from Claude" });
```

#### Key Methods

| Method | Description |
| ------ | ----------- |
| `createSpanProcessor()` | Returns a span processor that sends traces to Raindrop. Add this to your NodeSDK's `spanProcessors` array. |
| `getInstrumentations()` | Returns pre-configured OpenTelemetry instrumentations for AI libraries (Anthropic, OpenAI, Cohere, etc.). Add these to your NodeSDK's `instrumentations` array. |

<Info>
  If you don't specify `instrumentModules`, `getInstrumentations()` returns instrumentations for all supported AI libraries. Specify `instrumentModules` to only instrument specific libraries.
</Info>

---