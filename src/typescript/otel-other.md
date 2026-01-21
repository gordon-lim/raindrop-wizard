# Using OTEL Provider other than Sentry

If OTEL v2:

npm install raindrop-ai@otelv2

If OTEL v1:

npm install raindrop-ai

import { NodeSDK } from "@opentelemetry/sdk-node";

const raindrop = new Raindrop({
  writeKey: "xxx",
  useExternalOtel: true, // ⬅️ REQUIRED
});

const sdk = new NodeSDK({
  serviceName: "my-app",
  spanProcessors: [
    raindrop.createSpanProcessor(), // ⬅️ Add Raindrop processor
    yourExistingProcessor,          // Your existing processor
  ],
  instrumentations: raindrop.getInstrumentations(),
});

sdk.start();