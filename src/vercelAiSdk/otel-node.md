## Setting up OpenTelemetry in Node.js

### Install dependencies

**npm**
```bash
npm install raindrop-ai @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/resources @opentelemetry/semantic-conventions @opentelemetry/sdk-trace-base @opentelemetry/exporter-trace-otlp-proto @opentelemetry/sdk-trace-node
```

**pnpm**
```bash
pnpm add raindrop-ai @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/resources @opentelemetry/semantic-conventions @opentelemetry/sdk-trace-base @opentelemetry/exporter-trace-otlp-proto @opentelemetry/sdk-trace-node
```

**bun**
```bash
bun add raindrop-ai @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/resources @opentelemetry/semantic-conventions @opentelemetry/sdk-trace-base @opentelemetry/exporter-trace-otlp-proto @opentelemetry/sdk-trace-node
```

### Configure the OpenTelemetry SDK

```ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "ai-chatbot",
  }),
  spanProcessors: [
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

sdk.start();
```
