## Using with Sentry (Next.js)

If you’re already using Sentry for error tracking and tracing in your Next.js app, you can add Raindrop’s trace exporter directly to Sentry’s OpenTelemetry configuration instead of setting up a separate instrumentation file.
First, install the required OpenTelemetry packages alongside your existing Sentry setup:

### Install dependencies

**npm**
```bash
npm install @opentelemetry/exporter-trace-otlp-proto @opentelemetry/sdk-trace-base
```

**pnpm**
```bash
pnpm add @opentelemetry/exporter-trace-otlp-proto @opentelemetry/sdk-trace-base
```

**bun**
```bash
bun add @opentelemetry/exporter-trace-otlp-proto @opentelemetry/sdk-trace-base
```

Then, add the Raindrop exporter to Sentry’s openTelemetrySpanProcessors option in your sentry.server.config.ts:

```ts
// sentry.server.config.ts
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1,
  openTelemetrySpanProcessors: [
    new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: "https://api.raindrop.ai/v1/traces",
        headers: {
          Authorization: `Bearer ${process.env.RAINDROP_WRITE_KEY}`,
        },
      }),
    ),
  ],
});
```

This approach helps avoid issues with OTEL duplicate registration issues eg. Error: @opentelemetry/api: Attempted duplicate registration of API: trace.