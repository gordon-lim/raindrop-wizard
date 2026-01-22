# Integrating raindrop.ai with TypeScript Agents

## Overview

raindrop.ai provides tracing and analytics capabilities for your TypeScript/JavaScript applications, including AI agent interactions. This guide focuses on the **AI Tracing (Beta)** feature, which allows you to track detailed AI pipeline execution, capturing step-by-step information of complex multi-model interactions or chained prompts.

## Installation

Install the raindrop-ai package:

```bash
npm install raindrop-ai
# or
yarn add raindrop-ai
# or
pnpm add raindrop-ai
# or
bun add raindrop-ai
```

## Basic Setup

Initialize raindrop.ai in your application:

```typescript
import { Raindrop } from "raindrop-ai";

// Replace with the key from your Raindrop dashboard
const raindrop = new Raindrop({
  writeKey: process.env.RAINDROP_WRITE_KEY || "YOUR_WRITE_KEY",
});
```

## AI Tracing (Beta)

AI tracing is currently in beta. We'd love your feedback while we continue to improve the experience!

AI tracing helps you:
- Visualize the full execution flow of your AI application
- Debug and optimize complex prompt chains
- Understand intermediate steps that led to a specific generated output

### Getting Started with Tracing

Use `withSpan` or `withTool` on an interaction and any LLM calls inside are automatically captured:

```typescript
import { Raindrop } from "raindrop-ai";
import OpenAI from "openai";

const raindrop = new Raindrop({ writeKey: process.env.RAINDROP_WRITE_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Start an interaction
const interaction = raindrop.begin({
  eventId: "my-event-id",
  event: "chat_request",
  userId: "user_123",
  input: "What is the weather today?",
  model: "gpt-4o",
  convoId: "convo_123",
});

// Tracing works automatically - LLM calls are captured
await interaction.withSpan({ name: "generate_response" }, async () => {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: "What is the weather today?" }],
  });
  return response;
});

interaction.finish({ output: response });
```

Make sure you properly deal with streaming:

```typescript
// Wrap the OpenAI call with Raindrop tracing
const result = await interaction.withSpan(
  {
    name: 'generate_response',
    properties: { model: 'gpt-4o-mini' },
    inputParameters: [userInput],
  },
  async () => {
    return await streamText({
      model: openai('gpt-4o-mini'),
      messages,
    });
  }
);

// Collect full text from stream and finish interaction asynchronously
(async () => {
  let fullText = '';
  for await (const delta of result.textStream) {
    fullText += delta;
  }
  interaction.finish({ output: fullText });
})();
```

### Next.js Configuration

**Important for Next.js users:** Add `raindrop-ai` to `serverExternalPackages` in your config:

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

**Important for Anthropic users:** You must use a module namespace import (`import * as ...`) for Anthropic, not the default export.

```typescript
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import * as AnthropicModule from "@anthropic-ai/sdk";  // Module namespace import required!
import { Raindrop } from "raindrop-ai";

const raindrop = new Raindrop({
  writeKey: process.env.RAINDROP_WRITE_KEY,
  instrumentModules: {
    openAI: OpenAI,
    anthropic: AnthropicModule,  // Pass the module namespace, NOT the default export
  },
});
```

Supported modules include: `openAI`, `anthropic`, `cohere`, `bedrock`, `google_vertexai`, `google_aiplatform`, `pinecone`, `together`, `langchain`, `llamaIndex`, `chromadb`, and `qdrant`.

## Using `withSpan` for Task Tracing

The `withSpan` method allows you to trace specific tasks or operations within your AI application. This is especially useful for tracking LLM requests. Any LLM call within the span will be automatically tracked.

### Basic Usage

```typescript
const result = await interaction.withSpan(
  { name: "generate_response" },
  async () => {
    // Task implementation - LLM calls are automatically traced
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello!" }],
    });
    return response.choices[0].message.content;
  }
);
```

### With Properties and Input Parameters

```typescript
const embeddings = await interaction.withSpan(
  {
    name: "embedding_generation",
    properties: { model: "text-embedding-3-large" },
    inputParameters: ["What is the weather today?"]
  },
  async () => {
    // Generate embeddings
    const response = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: "What is the weather today?",
    });
    return response.data[0].embedding;
  }
);
```

### Parameters

| Parameter       | Type                              | Description                                   |
| --------------- | --------------------------------- | --------------------------------------------- |
| `name`          | `string`                          | Name of the task for identification in traces |
| `properties`    | `Record<string, string>` (optional) | Key-value pairs for additional metadata       |
| `inputParameters` | `unknown[]` (optional)            | Array of input parameters for the task        |

## Using `withTool` for Tool Tracing

The `withTool` method allows you to trace any actions your agent takes. This could be as simple as saving or retrieving a memory, or using external services like web search or API calls. Tracing these actions helps you understand your agent's behavior and what led up to the agent's response.

### Basic Usage

```typescript
const result = await interaction.withTool(
  { name: "search_tool" },
  async () => {
    // Call to external API or service
    const response = await fetch("https://api.example.com/search?q=weather");
    return await response.json();
  }
);
```

### With Properties and Input Parameters

```typescript
const calculation = await interaction.withTool(
  {
    name: "calculator",
    properties: { operation: "multiply" },
    inputParameters: { a: 5, b: 10 }
  },
  async () => {
    // Tool implementation
    return { result: 5 * 10 };
  }
);
```

### Parameters

| Parameter       | Type                              | Description                                       |
| --------------- | --------------------------------- | ------------------------------------------------- |
| `name`          | `string`                          | Name of the tool for identification in traces     |
| `version`       | `number` (optional)               | Version number of the tool                        |
| `properties`    | `Record<string, string>` (optional) | Key-value pairs for additional metadata           |
| `inputParameters` | `Record<string, any>` (optional)    | Record of input parameters for the tool           |
| `traceContent`  | `boolean` (optional)              | Flag to control whether content is traced         |
| `suppressTracing` | `boolean` (optional)            | Flag to suppress tracing for this tool invocation |

## Complete Example: OpenAI Agent with Tool Calls

The following example demonstrates a complete agent workflow with tracing:

```typescript
import { Raindrop } from "raindrop-ai";
import OpenAI from "openai";
import { randomUUID } from "crypto";

const raindrop = new Raindrop({ writeKey: process.env.RAINDROP_WRITE_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Tool function
async function getCurrentWeather(location: string, unit: string = "celsius") {
  // This tool call will be automatically traced
  return {
    location,
    temperature: 22,
    unit,
  };
}

async function main() {
  const eventId = randomUUID();
  const message = "What's the weather in Boston, MA today?";

  // Start the interaction
  const interaction = raindrop.begin({
    eventId,
    event: "weather_query",
    userId: "user-001",
    input: message,
    model: "gpt-4o",
    convoId: "convo-weather-001",
  });

  // Trace the main agent task
  const response = await interaction.withSpan(
    { name: "weather_agent" },
    async () => {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are helpful. Use tools when needed." },
          { role: "user", content: message },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "get_current_weather",
              description: "Get the current weather in a given location",
              parameters: {
                type: "object",
                properties: {
                  location: { type: "string" },
                  unit: { type: "string", enum: ["celsius", "fahrenheit"] },
                },
                required: ["location"],
              },
            },
          },
        ],
        tool_choice: "auto",
      });

      const choice = completion.choices[0];
      const toolCalls = choice.message.tool_calls;

      if (toolCalls) {
        // Trace tool execution
        for (const toolCall of toolCalls) {
          if (toolCall.function.name === "get_current_weather") {
            const args = JSON.parse(toolCall.function.arguments);
            await interaction.withTool(
              {
                name: "get_current_weather",
                inputParameters: args,
              },
              async () => {
                return await getCurrentWeather(args.location, args.unit);
              }
            );
          }
        }
      }

      return choice.message.content || "";
    }
  );

  // Finish the interaction
  interaction.finish({ output: response });

  // Cleanup
  await raindrop.close();
}

main();
```

## Additional Resources

- [raindrop.ai TypeScript SDK Documentation](https://www.raindrop.ai/docs/sdk/typescript)
- For questions or feedback, email: founders@raindrop.ai
