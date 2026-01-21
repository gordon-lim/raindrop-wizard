# Using Sentry

OTEL v2

npm install raindrop-ai@otelv2

If using Sentry < 10:

npm install raindrop-ai

const raindrop = new Raindrop({
  writeKey: raindropWriteKey,
  debugLogs: true,
  useExternalOtel: true, // ⬅️ REQUIRED
});

Sentry.init({
  dsn: "https://xxx@xxx.ingest.us.sentry.io/xxx",
  tracesSampleRate: 1.0,
  openTelemetrySpanProcessors: [
    raindrop.createSpanProcessor(), // ⬅️ Add Raindrop processor
  ],
});