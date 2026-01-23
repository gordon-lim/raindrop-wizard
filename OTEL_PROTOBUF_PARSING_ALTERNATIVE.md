# OpenTelemetry Protobuf Parsing - Alternative Approach

Since the Buf registry has issues with pnpm, this guide uses the `@opentelemetry/otlp-transformer` library which is already installed in your project.

## Using @opentelemetry/otlp-transformer (Already Installed)

This library is maintained by the OpenTelemetry project and provides utilities to work with OTLP data.

### Dependencies

Your project already has:
```json
{
  "@bufbuild/protobuf": "^2.11.0",
  "@opentelemetry/otlp-transformer": "^0.210.0"
}
```

### Additional Packages Needed

Install the OpenTelemetry API and SDK types:

```bash
pnpm add @opentelemetry/api @opentelemetry/sdk-trace-base @opentelemetry/resources @opentelemetry/semantic-conventions
```

### Implementation

```typescript
import {
  IExportTraceServiceRequest,
  IResourceSpans,
  ISpan,
  createExportTraceServiceRequest,
} from '@opentelemetry/otlp-transformer';
import { ReadableSpan } from '@opentelemetry/sdk-trace-base';

/**
 * Parse binary protobuf OTLP trace data
 */
export function parseOTLPBinary(buffer: Uint8Array): IExportTraceServiceRequest {
  // The otlp-transformer expects JSON format, so we need to decode protobuf first
  // Use protobufjs for decoding
  const protobuf = require('protobufjs');

  // Load the OpenTelemetry proto files
  const root = protobuf.loadSync('path/to/opentelemetry/proto/trace_service.proto');
  const ExportTraceServiceRequest = root.lookupType('opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest');

  // Decode the binary data
  const message = ExportTraceServiceRequest.decode(buffer);
  const object = ExportTraceServiceRequest.toObject(message, {
    longs: String,
    bytes: String,
    defaults: false,
    arrays: true,
    objects: true,
    oneofs: true
  });

  return object as IExportTraceServiceRequest;
}

/**
 * Parse JSON OTLP trace data
 */
export function parseOTLPJson(json: any): IExportTraceServiceRequest {
  // The JSON format can be used directly
  return json as IExportTraceServiceRequest;
}

/**
 * Extract spans from the request
 */
export function extractSpans(request: IExportTraceServiceRequest): ISpan[] {
  const spans: ISpan[] = [];

  for (const resourceSpan of request.resourceSpans || []) {
    for (const scopeSpan of resourceSpan.scopeSpans || []) {
      spans.push(...(scopeSpan.spans || []));
    }
  }

  return spans;
}

/**
 * Process span attributes
 */
export function getSpanAttributes(span: ISpan): Record<string, any> {
  const attributes: Record<string, any> = {};

  for (const attr of span.attributes || []) {
    if (attr.key && attr.value) {
      // Handle different value types
      if ('stringValue' in attr.value) {
        attributes[attr.key] = attr.value.stringValue;
      } else if ('intValue' in attr.value) {
        attributes[attr.key] = attr.value.intValue;
      } else if ('doubleValue' in attr.value) {
        attributes[attr.key] = attr.value.doubleValue;
      } else if ('boolValue' in attr.value) {
        attributes[attr.key] = attr.value.boolValue;
      }
    }
  }

  return attributes;
}

/**
 * Convert trace/span IDs to hex string
 */
export function toHexString(bytes: string | Uint8Array): string {
  if (typeof bytes === 'string') {
    // Already a string, might be base64 or hex
    return bytes;
  }
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

## Solution 2: Use protobufjs Directly

A more lightweight approach using just `protobufjs`:

### Install Dependencies

```bash
pnpm add protobufjs @types/protobufjs
```

### Download Proto Files

```bash
mkdir -p proto/opentelemetry
cd proto/opentelemetry

# Download the proto files
curl -O https://raw.githubusercontent.com/open-telemetry/opentelemetry-proto/main/opentelemetry/proto/collector/trace/v1/trace_service.proto
curl -O https://raw.githubusercontent.com/open-telemetry/opentelemetry-proto/main/opentelemetry/proto/trace/v1/trace.proto
curl -O https://raw.githubusercontent.com/open-telemetry/opentelemetry-proto/main/opentelemetry/proto/common/v1/common.proto
curl -O https://raw.githubusercontent.com/open-telemetry/opentelemetry-proto/main/opentelemetry/proto/resource/v1/resource.proto
```

### Implementation

```typescript
import * as protobuf from 'protobufjs';
import * as path from 'path';

// Load proto definitions
const root = protobuf.loadSync([
  path.join(__dirname, '../proto/opentelemetry/proto/collector/trace/v1/trace_service.proto'),
  path.join(__dirname, '../proto/opentelemetry/proto/trace/v1/trace.proto'),
  path.join(__dirname, '../proto/opentelemetry/proto/common/v1/common.proto'),
  path.join(__dirname, '../proto/opentelemetry/proto/resource/v1/resource.proto'),
]);

const ExportTraceServiceRequest = root.lookupType(
  'opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest'
);

/**
 * Parse binary protobuf data
 */
export function parseTracesFromBinary(buffer: Uint8Array): any {
  const message = ExportTraceServiceRequest.decode(buffer);
  return ExportTraceServiceRequest.toObject(message, {
    longs: String,  // Convert longs to strings to handle BigInt
    bytes: String,  // Convert bytes to base64 strings
    defaults: false,
    arrays: true,
    objects: true,
    oneofs: true,
  });
}

/**
 * Parse JSON protobuf data
 */
export function parseTracesFromJson(json: any): any {
  // Verify the message
  const errMsg = ExportTraceServiceRequest.verify(json);
  if (errMsg) throw Error(errMsg);

  // Create message from JSON
  const message = ExportTraceServiceRequest.fromObject(json);
  return ExportTraceServiceRequest.toObject(message, {
    longs: String,
    bytes: String,
    defaults: false,
    arrays: true,
    objects: true,
    oneofs: true,
  });
}

/**
 * HTTP Handler Example
 */
export async function handleTraceRequest(request: Request): Promise<Response> {
  const contentType = request.headers.get('Content-Type');
  const isJson = contentType?.includes('application/json');

  let traceData: any;

  if (isJson) {
    const jsonBody = await request.json();
    traceData = parseTracesFromJson(jsonBody);
  } else {
    const arrayBuffer = await request.arrayBuffer();
    traceData = parseTracesFromBinary(new Uint8Array(arrayBuffer));
  }

  // Extract and process spans
  const spans = [];
  for (const resourceSpan of traceData.resourceSpans || []) {
    for (const scopeSpan of resourceSpan.scopeSpans || []) {
      spans.push(...(scopeSpan.spans || []));
    }
  }

  console.log(`Received ${spans.length} spans`);

  // Process each span
  for (const span of spans) {
    console.log({
      traceId: span.traceId,
      spanId: span.spanId,
      name: span.name,
      startTime: span.startTimeUnixNano,
      endTime: span.endTimeUnixNano,
      attributes: span.attributes,
    });
  }

  // Return success response
  return Response.json({
    partialSuccess: {
      rejectedSpans: 0,
      errorMessage: '',
    },
  });
}
```

## Solution 3: Generate TypeScript Code from Proto Files

Use `protoc` to generate TypeScript bindings:

### Install Tools

```bash
pnpm add -D @protobuf-ts/plugin @protobuf-ts/runtime @protobuf-ts/runtime-rpc
```

### Generate Code

```bash
# Install protoc compiler
brew install protobuf  # macOS
# or download from https://github.com/protocolbuffers/protobuf/releases

# Generate TypeScript code
npx protoc \
  --ts_out=src/generated \
  --proto_path=proto \
  proto/opentelemetry/proto/collector/trace/v1/trace_service.proto
```

### Use Generated Code

```typescript
import { ExportTraceServiceRequest } from './generated/opentelemetry/proto/collector/trace/v1/trace_service';

// Parse binary
const request = ExportTraceServiceRequest.fromBinary(uint8Array);

// Parse JSON
const request = ExportTraceServiceRequest.fromJson(jsonData);
```

## Recommendation

For your project (using pnpm), I recommend **Solution 2 (protobufjs)** because:

1. ✅ Works with pnpm without registry issues
2. ✅ Lightweight and well-maintained
3. ✅ Direct control over proto files
4. ✅ No complex build steps
5. ✅ Already have @bufbuild/protobuf installed which is similar

The proto files are small and rarely change, so including them in your repo is not a problem.

## Quick Start Script

Here's a quick setup script:

```bash
# Install dependencies
pnpm add protobufjs @types/protobufjs

# Create proto directory and download files
mkdir -p proto/opentelemetry/proto/{collector/trace/v1,trace/v1,common/v1,resource/v1}

# Download proto files
curl -o proto/opentelemetry/proto/collector/trace/v1/trace_service.proto \
  https://raw.githubusercontent.com/open-telemetry/opentelemetry-proto/main/opentelemetry/proto/collector/trace/v1/trace_service.proto

curl -o proto/opentelemetry/proto/trace/v1/trace.proto \
  https://raw.githubusercontent.com/open-telemetry/opentelemetry-proto/main/opentelemetry/proto/trace/v1/trace.proto

curl -o proto/opentelemetry/proto/common/v1/common.proto \
  https://raw.githubusercontent.com/open-telemetry/opentelemetry-proto/main/opentelemetry/proto/common/v1/common.proto

curl -o proto/opentelemetry/proto/resource/v1/resource.proto \
  https://raw.githubusercontent.com/open-telemetry/opentelemetry-proto/main/opentelemetry/proto/resource/v1/resource.proto
```

Then use the implementation code from Solution 2 above.
