## Setting up OpenTelemetry in Cloudflare Workers

Cloudflare’s native tracing does not support custom spans. Use `@microlabs/otel-cf-workers`.

### Install dependencies

**npm**
```bash
npm install raindrop-ai @opentelemetry/api @microlabs/otel-cf-workers
```

**pnpm**
```bash
pnpm add raindrop-ai @opentelemetry/api @microlabs/otel-cf-workers
```

**bun**
```bash
bun add raindrop-ai @opentelemetry/api @microlabs/otel-cf-workers
```

### Wrangler config

```toml
compatibility_flags = ["nodejs_compat"]
```

### OTEL config

```ts
// src/otel.ts
import { instrument, type ResolveConfigFn } from "@microlabs/otel-cf-workers";

export interface Env {
  RAINDROP_WRITE_KEY: string;
  [key: string]: unknown;
}

export const otelConfig: ResolveConfigFn<Env> = (env, _trigger) => ({
  exporter: {
    url: "https://api.raindrop.ai/v1/traces",
    headers: {
      Authorization: `Bearer ${env.RAINDROP_WRITE_KEY}`,
    },
  },
  service: {
    name: "my-worker",
  },
});

export { instrument };
```

### Instrument handler

```ts
// src/index.ts
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import raindrop from "raindrop-ai/otel";
import { instrument, otelConfig, Env } from "./otel";

const handler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
    const { prompt } = await request.json();

    const result = streamText({
      model: openai("gpt-4o"),
      prompt,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "chat",
        metadata: {
          ...raindrop.metadata({ userId: "user_123" }),
        },
      },
    });

    ctx.waitUntil(result.text);
    return result.toTextStreamResponse();
  },
};

export default instrument(handler, otelConfig);
```