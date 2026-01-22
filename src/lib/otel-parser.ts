import type {
  IExportTraceServiceRequest,
  ISpan,
} from '@opentelemetry/otlp-transformer/build/esm/trace/internal-types';
import type { IKeyValue } from '@opentelemetry/otlp-transformer/build/esm/common/internal-types';
import * as root from '@opentelemetry/otlp-transformer/build/esm/generated/root';

/**
 * Convert binary ID (Uint8Array) to hex string
 */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert KeyValue array to a plain object
 */
export function keyValueArrayToObject(keyValues: IKeyValue[]): Record<string, any> {
  const result: Record<string, any> = {};

  for (const kv of keyValues) {
    const key = kv.key;
    const value = kv.value;

    if (!value) continue;

    // Handle different value types
    if (value.stringValue !== undefined && value.stringValue !== null) {
      result[key] = value.stringValue;
    } else if (value.intValue !== undefined && value.intValue !== null) {
      result[key] = typeof value.intValue === 'string' ? parseInt(value.intValue, 10) : Number(value.intValue);
    } else if (value.doubleValue !== undefined && value.doubleValue !== null) {
      result[key] = value.doubleValue;
    } else if (value.boolValue !== undefined && value.boolValue !== null) {
      result[key] = value.boolValue;
    } else if (value.arrayValue && value.arrayValue.values) {
      // Recursively convert array values
      result[key] = value.arrayValue.values.map((v: any) => {
        if (v.stringValue !== undefined) return v.stringValue;
        if (v.intValue !== undefined) return typeof v.intValue === 'string' ? parseInt(v.intValue, 10) : Number(v.intValue);
        if (v.doubleValue !== undefined) return v.doubleValue;
        if (v.boolValue !== undefined) return v.boolValue;
        return null;
      });
    } else if (value.kvlistValue && value.kvlistValue.values) {
      result[key] = keyValueArrayToObject(value.kvlistValue.values);
    }
  }

  return result;
}

/**
 * Extract all spans from a trace request
 */
export function extractSpans(request: IExportTraceServiceRequest): ISpan[] {
  if (!request.resourceSpans) return [];

  return request.resourceSpans.flatMap((resourceSpan) =>
    resourceSpan.scopeSpans.flatMap((scopeSpan) => scopeSpan.spans || [])
  );
}

/**
 * Parse spans from binary protobuf format (application/x-protobuf)
 */
export function parseProtobufBinary(requestBinary: Uint8Array): IExportTraceServiceRequest {
  // Get the ExportTraceServiceRequest type from the generated root
  // Cast to any because the protobuf types are dynamically generated
  const ExportTraceServiceRequest =
    (root as any).opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest;

  // Decode the binary data
  const message = ExportTraceServiceRequest.decode(requestBinary);

  // Convert to plain object
  return ExportTraceServiceRequest.toObject(message, {
    longs: String,
    enums: String,
    bytes: String,
    defaults: false,
    arrays: true,
    objects: true,
    oneofs: true,
  }) as IExportTraceServiceRequest;
}

/**
 * Parse spans from JSON format (application/json)
 * Follows OTLP/HTTP JSON encoding: https://opentelemetry.io/docs/specs/otlp/#otlphttp
 */
export function parseProtobufJson(json: any): IExportTraceServiceRequest {
  // JSON format is already in the correct structure for OTLP
  // Just need to ensure it matches the interface
  return json as IExportTraceServiceRequest;
}

/**
 * Check if the content type indicates JSON
 */
export function isJsonContentType(contentType: string | undefined): boolean {
  if (!contentType) return false;
  return contentType.includes('application/json');
}

/**
 * Parse OpenTelemetry traces from either binary protobuf or JSON format
 * This is the main function to use in createTestServer
 */
export function parseOtelTraces(
  data: Uint8Array | any,
  contentType: string | undefined
): {
  traceRequest: IExportTraceServiceRequest;
  spans: ISpan[];
  format: 'json' | 'protobuf';
} {
  const isJson = isJsonContentType(contentType);

  let traceRequest: IExportTraceServiceRequest;
  if (isJson) {
    // Handle JSON-encoded protobuf
    traceRequest = parseProtobufJson(data);
  } else {
    // Handle binary protobuf (default)
    traceRequest = parseProtobufBinary(data as Uint8Array);
  }

  // Extract spans
  const spans = extractSpans(traceRequest);

  return {
    traceRequest,
    spans,
    format: isJson ? 'json' : 'protobuf',
  };
}

/**
 * Convert span to a simplified, loggable format
 */
export function spanToSimpleFormat(span: ISpan): any {
  const attributes = keyValueArrayToObject(span.attributes);

  // Helper to convert trace/span IDs to hex
  const traceIdHex = typeof span.traceId === 'string' ? span.traceId : toHex(span.traceId);
  const spanIdHex = typeof span.spanId === 'string' ? span.spanId : toHex(span.spanId);
  const parentSpanIdHex =
    span.parentSpanId && (typeof span.parentSpanId === 'string' || span.parentSpanId.length > 0)
      ? typeof span.parentSpanId === 'string'
        ? span.parentSpanId
        : toHex(span.parentSpanId)
      : null;

  // Handle Fixed64 types (can be string, number, or Long)
  const startTime = typeof span.startTimeUnixNano === 'string' ? span.startTimeUnixNano : String(span.startTimeUnixNano);
  const endTime = typeof span.endTimeUnixNano === 'string' ? span.endTimeUnixNano : String(span.endTimeUnixNano);

  return {
    traceId: traceIdHex,
    spanId: spanIdHex,
    parentSpanId: parentSpanIdHex,
    name: span.name,
    kind: span.kind,
    startTimeNano: startTime,
    endTimeNano: endTime,
    durationNano: String(BigInt(endTime) - BigInt(startTime)),
    attributes,
    status: {
      code: span.status?.code,
      message: span.status?.message,
    },
  };
}

/**
 * Extract relevant AI/LLM attributes from spans
 */
export function extractAIAttributes(spans: ISpan[]): any[] {
  return spans.map((span) => {
    const attributes = keyValueArrayToObject(span.attributes);
    const spanIdHex = typeof span.spanId === 'string' ? span.spanId : toHex(span.spanId);

    return {
      spanId: spanIdHex,
      name: span.name,
      // AI SDK attributes (Vercel AI SDK)
      operationId: attributes['ai.operationId'],
      prompt: attributes['ai.prompt'],
      responseText: attributes['ai.response.text'],
      toolCallName: attributes['ai.toolCall.name'],
      toolCallInput: attributes['ai.toolCall.input'],
      toolCallOutput: attributes['ai.toolCall.output'],
      // GenAI semantic conventions (OpenAI, Anthropic, etc.)
      genAiSystem: attributes['gen_ai.system'],
      model: attributes['gen_ai.response.model'],
      inputTokens: attributes['gen_ai.usage.input_tokens'] || attributes['gen_ai.usage.prompt_tokens'],
      outputTokens: attributes['gen_ai.usage.output_tokens'] || attributes['gen_ai.usage.completion_tokens'],
      // Legacy Traceloop attributes
      convoId: attributes['traceloop.association.properties.convo_id'],
      eventId: attributes['traceloop.association.properties.event_id'],
      spanKind: attributes['traceloop.span.kind'],
    };
  });
}
