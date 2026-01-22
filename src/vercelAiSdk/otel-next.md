## Setting up OpenTelemetry in Next.js

### Install dependencies

**npm**
```bash
npm install raindrop-ai @opentelemetry/api @opentelemetry/sdk-trace-base @vercel/otel
```

**pnpm**
```bash
pnpm add raindrop-ai @opentelemetry/api @opentelemetry/sdk-trace-base @vercel/otel
```

**bun**
```bash
bun add raindrop-ai @opentelemetry/api @opentelemetry/sdk-trace-base @vercel/otel
```

### Configure instrumentation

```ts
// instrumentation.ts
import { registerOTel, OTLPHttpProtoTraceExporter } from "@vercel/otel";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

export function register() {
  registerOTel({
    serviceName: "ai-chatbot",
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPHttpProtoTraceExporter({
          url: "https://api.raindrop.ai/v1/traces",
          headers: {
            Authorization: `Bearer ${process.env.RAINDROP_WRITE_KEY}`,
          },
        }),
      ),
    ],
  });
}
```

### Troubleshooting

Error: "Cannot execute the operation on ended Span" → Use `runtime = 'nodejs'` instead of `'edge'` when combining experimental_telemetry with @vercel/otel instrumentation.     