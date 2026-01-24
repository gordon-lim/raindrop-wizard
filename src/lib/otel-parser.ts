// Define types locally since internal OTEL types aren't exported properly
interface IKeyValue {
  key: string;
  value?: {
    stringValue?: string;
    intValue?: string | number;
    doubleValue?: number;
    boolValue?: boolean;
    arrayValue?: { values?: Array<IKeyValue['value']> };
    kvlistValue?: { values?: IKeyValue[] };
  };
}

interface ISpan {
  traceId: Uint8Array | string;
  spanId: Uint8Array | string;
  parentSpanId?: Uint8Array | string;
  name: string;
  kind: number;
  startTimeUnixNano: string | number;
  endTimeUnixNano: string | number;
  attributes: IKeyValue[];
  status?: {
    code?: number;
    message?: string;
  };
}

interface IExportTraceServiceRequest {
  resourceSpans: Array<{
    scopeSpans: Array<{
      spans?: ISpan[];
    }>;
  }>;
}

// Dynamic import for protobuf root - loaded at runtime
let _root: any = null;
async function getProtobufRoot(): Promise<any> {
  if (!_root) {
    // @ts-ignore - internal module path
    _root = await import('@opentelemetry/otlp-transformer/build/esm/generated/root');
  }
  return _root;
}

/**
 * Value types that can appear in OTEL key-value pairs
 */
type OtelValue =
  | string
  | number
  | boolean
  | null
  | OtelValue[]
  | Record<string, unknown>;

/**
 * Simplified span format for logging and display
 */
export interface SimpleSpan {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  kind: number;
  startTimeNano: string;
  endTimeNano: string;
  durationNano: string;
  attributes: Record<string, OtelValue>;
  status: {
    code?: number;
    message?: string;
  };
}

/**
 * Extracted AI/LLM attributes from a span
 */
export interface AIAttributes {
  spanId: string;
  name: string;
  // AI SDK attributes (Vercel AI SDK)
  operationId?: string;
  prompt?: string;
  responseText?: string;
  toolCallName?: string;
  toolCallInput?: string;
  toolCallOutput?: string;
  // GenAI semantic conventions (OpenAI, Anthropic, etc.)
  genAiSystem?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  // Legacy Traceloop attributes
  convoId?: string;
  eventId?: string;
  spanKind?: string;
}

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
export function keyValueArrayToObject(
  keyValues: IKeyValue[],
): Record<string, OtelValue> {
  const result: Record<string, OtelValue> = {};

  for (const kv of keyValues) {
    const key = kv.key;
    const value = kv.value;

    if (!value) continue;

    // Handle different value types
    if (value.stringValue !== undefined && value.stringValue !== null) {
      result[key] = value.stringValue;
    } else if (value.intValue !== undefined && value.intValue !== null) {
      result[key] =
        typeof value.intValue === 'string'
          ? parseInt(value.intValue, 10)
          : Number(value.intValue);
    } else if (value.doubleValue !== undefined && value.doubleValue !== null) {
      result[key] = value.doubleValue;
    } else if (value.boolValue !== undefined && value.boolValue !== null) {
      result[key] = value.boolValue;
    } else if (value.arrayValue && value.arrayValue.values) {
      // Recursively convert array values
      result[key] = value.arrayValue.values.map((v: IKeyValue['value']) => {
        if (!v) return null;
        if (v.stringValue !== undefined) return v.stringValue;
        if (v.intValue !== undefined)
          return typeof v.intValue === 'string'
            ? parseInt(v.intValue, 10)
            : Number(v.intValue);
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

  return request.resourceSpans.flatMap((resourceSpan: any) =>
    resourceSpan.scopeSpans.flatMap((scopeSpan: any) => scopeSpan.spans || []),
  );
}

/**
 * Parse spans from binary protobuf format (application/x-protobuf)
 */
export async function parseProtobufBinary(
  requestBinary: Uint8Array,
): Promise<IExportTraceServiceRequest> {
  // Get the ExportTraceServiceRequest type from the generated root
  // Cast to any because the protobuf types are dynamically generated
  const root = await getProtobufRoot();
  const ExportTraceServiceRequest = (root as any).opentelemetry.proto.collector
    .trace.v1.ExportTraceServiceRequest;

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
export function parseProtobufJson(json: unknown): IExportTraceServiceRequest {
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
export async function parseOtelTraces(
  data: Uint8Array | unknown,
  contentType: string | undefined,
): Promise<{
  traceRequest: IExportTraceServiceRequest;
  spans: ISpan[];
  format: 'json' | 'protobuf';
}> {
  const isJson = isJsonContentType(contentType);

  let traceRequest: IExportTraceServiceRequest;
  if (isJson) {
    // Handle JSON-encoded protobuf
    traceRequest = parseProtobufJson(data);
  } else {
    // Handle binary protobuf (default)
    traceRequest = await parseProtobufBinary(data as Uint8Array);
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
export function spanToSimpleFormat(span: ISpan): SimpleSpan {
  const attributes = keyValueArrayToObject(span.attributes);

  // Helper to convert trace/span IDs to hex
  const traceIdHex =
    typeof span.traceId === 'string' ? span.traceId : toHex(span.traceId);
  const spanIdHex =
    typeof span.spanId === 'string' ? span.spanId : toHex(span.spanId);
  const parentSpanIdHex =
    span.parentSpanId &&
    (typeof span.parentSpanId === 'string' || span.parentSpanId.length > 0)
      ? typeof span.parentSpanId === 'string'
        ? span.parentSpanId
        : toHex(span.parentSpanId)
      : null;

  // Handle Fixed64 types (can be string, number, or Long)
  const startTime =
    typeof span.startTimeUnixNano === 'string'
      ? span.startTimeUnixNano
      : String(span.startTimeUnixNano);
  const endTime =
    typeof span.endTimeUnixNano === 'string'
      ? span.endTimeUnixNano
      : String(span.endTimeUnixNano);

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
export function extractAIAttributes(spans: ISpan[]): AIAttributes[] {
  return spans.map((span) => {
    const attributes = keyValueArrayToObject(span.attributes);
    const spanIdHex =
      typeof span.spanId === 'string' ? span.spanId : toHex(span.spanId);

    // Helper to safely cast attribute values to strings
    const asString = (value: OtelValue | undefined): string | undefined => {
      if (typeof value === 'string') return value;
      if (value === null || value === undefined) return undefined;
      return String(value);
    };

    // Helper to safely cast attribute values to numbers
    const asNumber = (value: OtelValue | undefined): number | undefined => {
      if (typeof value === 'number') return value;
      if (value === null || value === undefined) return undefined;
      const num = Number(value);
      return isNaN(num) ? undefined : num;
    };

    return {
      spanId: spanIdHex,
      name: span.name,
      // AI SDK attributes (Vercel AI SDK)
      operationId: asString(attributes['ai.operationId']),
      prompt: asString(attributes['ai.prompt']),
      responseText: asString(attributes['ai.response.text']),
      toolCallName: asString(attributes['ai.toolCall.name']),
      toolCallInput: asString(attributes['ai.toolCall.input']),
      toolCallOutput: asString(attributes['ai.toolCall.output']),
      // GenAI semantic conventions (OpenAI, Anthropic, etc.)
      genAiSystem: asString(attributes['gen_ai.system']),
      model: asString(attributes['gen_ai.response.model']),
      inputTokens:
        asNumber(attributes['gen_ai.usage.input_tokens']) ||
        asNumber(attributes['gen_ai.usage.prompt_tokens']),
      outputTokens:
        asNumber(attributes['gen_ai.usage.output_tokens']) ||
        asNumber(attributes['gen_ai.usage.completion_tokens']),
      // Legacy Traceloop attributes
      convoId: asString(
        attributes['traceloop.association.properties.convo_id'],
      ),
      eventId: asString(
        attributes['traceloop.association.properties.event_id'],
      ),
      spanKind: asString(attributes['traceloop.span.kind']),
    };
  });
}
