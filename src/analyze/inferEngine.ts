/**
 * AI Architecture Inference Engine
 *
 * Sends the project profile and key file contents to Claude with a carefully
 * designed prompt that asks it to infer the system architecture. Claude identifies
 * components (services, databases, queues, etc.), their relationships
 * (sync/async/data-flow), and maps them to ArchCanvas node types from the
 * built-in registry.
 *
 * Returns structured JSON that can be directly converted to graph operations.
 * Uses streaming for progress feedback on large codebases.
 */

import { z } from 'zod';
import type { ProjectProfile } from './detector';
import type { KeyFileSet, SelectedFile } from './fileSelector';

// ── Types ────────────────────────────────────────────────────────────────────

/** Edge types matching the protobuf enum */
export type InferredEdgeType = 'SYNC' | 'ASYNC' | 'DATA_FLOW';

/** A code reference inferred by the AI */
export interface InferredCodeRef {
  path: string;
  role: 'SOURCE' | 'API_SPEC' | 'SCHEMA' | 'DEPLOYMENT' | 'CONFIG' | 'TEST';
}

/** An inferred architecture node */
export interface InferredNode {
  id: string;
  type: string; // built-in node type name (e.g., 'service', 'database')
  displayName: string;
  description: string;
  codeRefs: InferredCodeRef[];
  children: InferredNode[];
}

/** An inferred architecture edge */
export interface InferredEdge {
  from: string; // node id
  to: string; // node id
  type: InferredEdgeType;
  label: string;
}

/** Complete inference result from the AI */
export interface InferenceResult {
  architectureName: string;
  architectureDescription: string;
  nodes: InferredNode[];
  edges: InferredEdge[];
}

/** Analysis depth option */
export type AnalysisDepth = 'quick' | 'standard' | 'deep';

/** Progress event emitted during streaming inference */
export interface InferenceProgressEvent {
  step: number;
  totalSteps: number;
  description: string;
  /** Partial result available after this step */
  partialResult?: Partial<InferenceResult>;
}

/** Options for the inference engine */
export interface InferenceOptions {
  /** Analysis depth: 'quick' (single prompt), 'standard' (multi-step), 'deep' (reads additional files) */
  depth?: AnalysisDepth;
  /** Callback for progress events during streaming */
  onProgress?: (event: InferenceProgressEvent) => void;
  /** Callback for streamed text chunks */
  onChunk?: (text: string) => void;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Maximum retries for AI failures (default: 3) */
  maxRetries?: number;
  /** Token limit per AI call (default: 100000) */
  tokenLimitPerCall?: number;
}

/** Abstraction for the AI message sender (allows dependency injection for testing) */
export interface AIMessageSender {
  sendMessage(options: {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    system?: string;
    maxTokens?: number;
    stream?: boolean;
    onChunk?: (text: string) => void;
    signal?: AbortSignal;
  }): Promise<{
    content: string;
    stopReason: string | null;
    usage: { inputTokens: number; outputTokens: number };
  }>;
}

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const codeRefSchema = z.object({
  path: z.string().min(1),
  role: z.enum(['SOURCE', 'API_SPEC', 'SCHEMA', 'DEPLOYMENT', 'CONFIG', 'TEST']),
});

const inferredNodeSchema: z.ZodType<InferredNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    displayName: z.string().min(1),
    description: z.string(),
    codeRefs: z.array(codeRefSchema).default([]),
    children: z.array(inferredNodeSchema).default([]),
  }),
) as z.ZodType<InferredNode>;

const inferredEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  type: z.enum(['SYNC', 'ASYNC', 'DATA_FLOW']),
  label: z.string(),
});

export const inferenceResultSchema = z.object({
  architectureName: z.string().min(1),
  architectureDescription: z.string().min(1),
  nodes: z.array(inferredNodeSchema).min(1),
  edges: z.array(inferredEdgeSchema).default([]),
});

// ── Constants ────────────────────────────────────────────────────────────────

/** Built-in node types available in ArchCanvas */
const BUILTIN_NODE_TYPES = [
  { name: 'service', namespace: 'compute', description: 'A backend service, API server, or microservice' },
  { name: 'function', namespace: 'compute', description: 'A serverless function or lambda' },
  { name: 'worker', namespace: 'compute', description: 'A background worker or job processor' },
  { name: 'api-gateway', namespace: 'compute', description: 'An API gateway or reverse proxy' },
  { name: 'database', namespace: 'data', description: 'A relational or NoSQL database' },
  { name: 'cache', namespace: 'data', description: 'An in-memory cache (Redis, Memcached)' },
  { name: 'object-storage', namespace: 'data', description: 'Blob/object storage (S3, GCS)' },
  { name: 'repository', namespace: 'data', description: 'A code or artifact repository' },
  { name: 'message-queue', namespace: 'messaging', description: 'A message queue (RabbitMQ, SQS)' },
  { name: 'event-bus', namespace: 'messaging', description: 'An event bus or pub/sub system (Kafka, SNS)' },
  { name: 'stream-processor', namespace: 'messaging', description: 'A stream processing system (Flink, Kinesis)' },
  { name: 'load-balancer', namespace: 'network', description: 'A load balancer or traffic distributor' },
  { name: 'cdn', namespace: 'network', description: 'A content delivery network' },
  { name: 'logging', namespace: 'observability', description: 'A logging aggregation system (ELK, CloudWatch)' },
  { name: 'monitoring', namespace: 'observability', description: 'A monitoring/metrics system (Prometheus, Datadog)' },
];

const CHARS_PER_TOKEN = 4;

/** Default max tokens for AI response */
const DEFAULT_MAX_RESPONSE_TOKENS = 4096;

/** Default max retries */
const DEFAULT_MAX_RETRIES = 3;

/** Default token limit per call for file content */
const DEFAULT_TOKEN_LIMIT_PER_CALL = 100_000;

// ── Prompt Construction ──────────────────────────────────────────────────────

function formatNodeTypeList(): string {
  return BUILTIN_NODE_TYPES.map(
    (t) => `  - ${t.name} (${t.namespace}): ${t.description}`,
  ).join('\n');
}

function formatProjectProfile(profile: ProjectProfile): string {
  const parts: string[] = [];

  if (profile.projectType) {
    parts.push(`Project type: ${profile.projectType}`);
  }

  if (profile.languages.length > 0) {
    parts.push(
      `Languages: ${profile.languages.map((l) => `${l.name} (${l.percentage.toFixed(0)}%)`).join(', ')}`,
    );
  }

  if (profile.frameworks.length > 0) {
    parts.push(
      `Frameworks: ${profile.frameworks.map((f) => `${f.name} (${f.confidence})`).join(', ')}`,
    );
  }

  if (profile.buildSystems.length > 0) {
    parts.push(`Build systems: ${profile.buildSystems.join(', ')}`);
  }

  if (profile.infraSignals.length > 0) {
    parts.push(
      `Infrastructure: ${profile.infraSignals.map((s) => `${s.type} (${s.evidence})`).join(', ')}`,
    );
  }

  if (profile.dataStores.length > 0) {
    parts.push(
      `Data stores: ${profile.dataStores.map((d) => `${d.type} (${d.evidence})`).join(', ')}`,
    );
  }

  if (profile.entryPoints.length > 0) {
    parts.push(`Entry points: ${profile.entryPoints.join(', ')}`);
  }

  return parts.join('\n');
}

function formatFileContents(files: SelectedFile[]): string {
  return files
    .map(
      (f) =>
        `--- FILE: ${f.path} (Tier ${f.tier}: ${f.reason}) ---\n${f.content}\n--- END FILE ---`,
    )
    .join('\n\n');
}

const SYSTEM_PROMPT = `You are an expert software architect analyzing a codebase to infer its system architecture.
You will be given a project profile (detected languages, frameworks, infra signals) and key file contents.
Your job is to identify the architectural components (services, databases, queues, etc.) and their relationships.

IMPORTANT: You must respond ONLY with valid JSON matching the specified schema. No markdown, no explanations outside the JSON.`;

function buildQuickPrompt(
  profile: ProjectProfile,
  fileContents: string,
): string {
  return `Analyze this codebase and infer its system architecture.

## Project Profile
${formatProjectProfile(profile)}

## Available Node Types
Map each component to one of these built-in ArchCanvas node types:
${formatNodeTypeList()}

## Key Files
${fileContents}

## Instructions
Identify all major architectural components and their relationships.
Respond with a JSON object matching this schema:
{
  "architectureName": "string - name for this architecture",
  "architectureDescription": "string - brief description of the overall system",
  "nodes": [
    {
      "id": "string - unique kebab-case identifier",
      "type": "string - one of the built-in node types listed above",
      "displayName": "string - human-readable name",
      "description": "string - what this component does",
      "codeRefs": [{"path": "string - file path", "role": "SOURCE|API_SPEC|SCHEMA|DEPLOYMENT|CONFIG|TEST"}],
      "children": []
    }
  ],
  "edges": [
    {
      "from": "string - source node id",
      "to": "string - target node id",
      "type": "SYNC|ASYNC|DATA_FLOW",
      "label": "string - describes the relationship"
    }
  ]
}

Respond ONLY with the JSON object. No markdown code fences, no explanations.`;
}

function buildStep1Prompt(
  profile: ProjectProfile,
  fileContents: string,
): string {
  return `Analyze this codebase and identify all high-level architectural components and their roles.

## Project Profile
${formatProjectProfile(profile)}

## Key Files
${fileContents}

## Instructions
Identify all major architectural components. For each component, describe:
1. What it is (e.g., REST API server, PostgreSQL database, Redis cache)
2. Its role in the system
3. Key files that implement it

Respond with a JSON object:
{
  "components": [
    {
      "id": "string - unique kebab-case identifier",
      "name": "string - human-readable name",
      "role": "string - what this component does",
      "technology": "string - specific technology (e.g., Express.js, PostgreSQL)",
      "keyFiles": ["string - file paths"]
    }
  ],
  "systemOverview": "string - brief description of the overall system"
}

Respond ONLY with the JSON object. No markdown code fences.`;
}

function buildStep2Prompt(step1Response: string): string {
  return `Based on the components identified in Step 1, now identify all relationships and data flows between them.

## Components from Step 1
${step1Response}

## Instructions
For each relationship, identify:
1. Source and target components (by id)
2. Whether the communication is synchronous (HTTP, gRPC), asynchronous (message queue, events), or a data flow (reads/writes)
3. A descriptive label for the relationship

Respond with a JSON object:
{
  "relationships": [
    {
      "from": "string - source component id",
      "to": "string - target component id",
      "type": "SYNC|ASYNC|DATA_FLOW",
      "label": "string - describes the relationship",
      "protocol": "string - optional protocol details (HTTP, gRPC, WebSocket, etc.)"
    }
  ]
}

Respond ONLY with the JSON object. No markdown code fences.`;
}

function buildStep3Prompt(
  step1Response: string,
  step2Response: string,
): string {
  return `Based on the components and relationships identified, now map everything to ArchCanvas node types and suggest a hierarchy.

## Components
${step1Response}

## Relationships
${step2Response}

## Available ArchCanvas Node Types
${formatNodeTypeList()}

## Instructions
Map each component to the most appropriate ArchCanvas node type.
Suggest parent-child groupings where it makes sense (e.g., a "backend" service group containing API server and workers).
Provide code references for each node.

Respond with a JSON object:
{
  "architectureName": "string - name for this architecture",
  "architectureDescription": "string - brief description of the overall system",
  "nodes": [
    {
      "id": "string - unique kebab-case identifier",
      "type": "string - one of the built-in node types listed above",
      "displayName": "string - human-readable name",
      "description": "string - what this component does",
      "codeRefs": [{"path": "string - file path", "role": "SOURCE|API_SPEC|SCHEMA|DEPLOYMENT|CONFIG|TEST"}],
      "children": [
        { "id": "...", "type": "...", "displayName": "...", "description": "...", "codeRefs": [], "children": [] }
      ]
    }
  ],
  "edges": [
    {
      "from": "string - source node id",
      "to": "string - target node id",
      "type": "SYNC|ASYNC|DATA_FLOW",
      "label": "string - describes the relationship"
    }
  ]
}

Respond ONLY with the JSON object. No markdown code fences.`;
}

// ── Zod Schemas for Intermediate Steps ───────────────────────────────────────

const step1Schema = z.object({
  components: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      role: z.string(),
      technology: z.string().optional().default(''),
      keyFiles: z.array(z.string()).default([]),
    }),
  ),
  systemOverview: z.string(),
});

type Step1Result = z.infer<typeof step1Schema>;

const step2Schema = z.object({
  relationships: z.array(
    z.object({
      from: z.string().min(1),
      to: z.string().min(1),
      type: z.enum(['SYNC', 'ASYNC', 'DATA_FLOW']),
      label: z.string(),
      protocol: z.string().optional(),
    }),
  ),
});

type Step2Result = z.infer<typeof step2Schema>;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract JSON from AI response text. Handles cases where the AI
 * wraps JSON in markdown code fences or adds extra text.
 */
export function extractJson(text: string): string {
  // Try to find JSON in markdown code fence
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  // Try to find a JSON object directly
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0];
  }

  // Return as-is, let JSON.parse handle the error
  return text.trim();
}

/**
 * Parse and validate AI response against a Zod schema.
 */
function parseAIResponse<T>(text: string, schema: z.ZodSchema): T {
  const jsonStr = extractJson(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new InferenceError(
      `Failed to parse AI response as JSON: ${e instanceof Error ? e.message : String(e)}`,
      'PARSE_ERROR',
      text,
    );
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new InferenceError(
      `AI response failed validation: ${result.error.message}`,
      'VALIDATION_ERROR',
      text,
    );
  }

  return result.data as T;
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Estimate tokens for a string.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Split files into batches that fit within a token limit.
 */
export function batchFiles(
  files: SelectedFile[],
  tokenLimitPerBatch: number,
): SelectedFile[][] {
  const batches: SelectedFile[][] = [];
  let currentBatch: SelectedFile[] = [];
  let currentTokens = 0;

  for (const file of files) {
    const fileTokens = estimateTokens(file.content);

    // If a single file exceeds the limit, it gets its own batch
    if (fileTokens > tokenLimitPerBatch) {
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
        currentTokens = 0;
      }
      batches.push([file]);
      continue;
    }

    if (currentTokens + fileTokens > tokenLimitPerBatch) {
      batches.push(currentBatch);
      currentBatch = [file];
      currentTokens = fileTokens;
    } else {
      currentBatch.push(file);
      currentTokens += fileTokens;
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * Merge multiple InferenceResults into one by combining nodes and edges,
 * deduplicating by node id.
 */
export function mergeResults(results: InferenceResult[]): InferenceResult {
  if (results.length === 0) {
    throw new InferenceError('No results to merge', 'MERGE_ERROR');
  }

  if (results.length === 1) {
    return results[0];
  }

  const nodeMap = new Map<string, InferredNode>();
  const edgeSet = new Set<string>();
  const edges: InferredEdge[] = [];

  for (const result of results) {
    for (const node of result.nodes) {
      if (!nodeMap.has(node.id)) {
        nodeMap.set(node.id, node);
      }
    }
    for (const edge of result.edges) {
      const key = `${edge.from}→${edge.to}→${edge.type}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push(edge);
      }
    }
  }

  return {
    architectureName: results[0].architectureName,
    architectureDescription: results[0].architectureDescription,
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}

// ── Error ────────────────────────────────────────────────────────────────────

export type InferenceErrorCode =
  | 'PARSE_ERROR'
  | 'VALIDATION_ERROR'
  | 'AI_ERROR'
  | 'MERGE_ERROR'
  | 'ABORTED';

export class InferenceError extends Error {
  constructor(
    message: string,
    public code: InferenceErrorCode,
    public rawResponse?: string,
  ) {
    super(message);
    this.name = 'InferenceError';
  }
}

// ── Core Inference ───────────────────────────────────────────────────────────

/**
 * Send a message with retry logic and exponential backoff.
 */
async function sendWithRetry(
  sender: AIMessageSender,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  system: string,
  options: {
    maxRetries: number;
    maxTokens: number;
    stream?: boolean;
    onChunk?: (text: string) => void;
    signal?: AbortSignal;
  },
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    if (options.signal?.aborted) {
      throw new InferenceError('Inference was aborted', 'ABORTED');
    }

    try {
      const result = await sender.sendMessage({
        messages,
        system,
        maxTokens: options.maxTokens,
        stream: options.stream,
        onChunk: options.onChunk,
        signal: options.signal,
      });
      return result.content;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));

      // Don't retry on abort
      if (options.signal?.aborted) {
        throw new InferenceError('Inference was aborted', 'ABORTED');
      }

      // Don't retry on last attempt
      if (attempt < options.maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        await sleep(delay);
      }
    }
  }

  throw new InferenceError(
    `AI request failed after ${options.maxRetries + 1} attempts: ${lastError?.message}`,
    'AI_ERROR',
  );
}

/**
 * Run quick analysis (single prompt, structure-only).
 */
async function inferQuick(
  sender: AIMessageSender,
  profile: ProjectProfile,
  keyFiles: KeyFileSet,
  options: InferenceOptions,
): Promise<InferenceResult> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const tokenLimit = options.tokenLimitPerCall ?? DEFAULT_TOKEN_LIMIT_PER_CALL;

  options.onProgress?.({
    step: 1,
    totalSteps: 1,
    description: 'Analyzing architecture (quick mode)...',
  });

  const batches = batchFiles(keyFiles.files, tokenLimit);

  if (batches.length <= 1) {
    // Single batch - straightforward
    const fileContents = formatFileContents(keyFiles.files);
    const prompt = buildQuickPrompt(profile, fileContents);

    const response = await sendWithRetry(
      sender,
      [{ role: 'user', content: prompt }],
      SYSTEM_PROMPT,
      {
        maxRetries,
        maxTokens: DEFAULT_MAX_RESPONSE_TOKENS,
        stream: !!options.onChunk,
        onChunk: options.onChunk,
        signal: options.signal,
      },
    );

    return parseAIResponse<InferenceResult>(response, inferenceResultSchema);
  }

  // Multiple batches - run each and merge
  const results: InferenceResult[] = [];
  for (let i = 0; i < batches.length; i++) {
    options.onProgress?.({
      step: i + 1,
      totalSteps: batches.length,
      description: `Analyzing batch ${i + 1}/${batches.length}...`,
    });

    const fileContents = formatFileContents(batches[i]);
    const prompt = buildQuickPrompt(profile, fileContents);

    const response = await sendWithRetry(
      sender,
      [{ role: 'user', content: prompt }],
      SYSTEM_PROMPT,
      {
        maxRetries,
        maxTokens: DEFAULT_MAX_RESPONSE_TOKENS,
        stream: !!options.onChunk,
        onChunk: options.onChunk,
        signal: options.signal,
      },
    );

    results.push(parseAIResponse<InferenceResult>(response, inferenceResultSchema));
  }

  return mergeResults(results);
}

/**
 * Run standard analysis (multi-step: identify → relationships → map).
 */
async function inferStandard(
  sender: AIMessageSender,
  profile: ProjectProfile,
  keyFiles: KeyFileSet,
  options: InferenceOptions,
): Promise<InferenceResult> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const tokenLimit = options.tokenLimitPerCall ?? DEFAULT_TOKEN_LIMIT_PER_CALL;

  const batches = batchFiles(keyFiles.files, tokenLimit);
  const fileContents = formatFileContents(
    batches.length === 1 ? keyFiles.files : batches[0],
  );

  // Step 1: Identify components
  options.onProgress?.({
    step: 1,
    totalSteps: 3,
    description: 'Step 1/3: Identifying architectural components...',
  });

  const step1Prompt = buildStep1Prompt(profile, fileContents);
  const step1Response = await sendWithRetry(
    sender,
    [{ role: 'user', content: step1Prompt }],
    SYSTEM_PROMPT,
    {
      maxRetries,
      maxTokens: DEFAULT_MAX_RESPONSE_TOKENS,
      stream: !!options.onChunk,
      onChunk: options.onChunk,
      signal: options.signal,
    },
  );

  // Validate step 1
  const step1Data = parseAIResponse<Step1Result>(step1Response, step1Schema);

  options.onProgress?.({
    step: 1,
    totalSteps: 3,
    description: `Step 1/3: Found ${step1Data.components.length} components`,
    partialResult: {
      architectureDescription: step1Data.systemOverview,
    },
  });

  // Step 2: Identify relationships
  options.onProgress?.({
    step: 2,
    totalSteps: 3,
    description: 'Step 2/3: Identifying relationships and data flows...',
  });

  const step2Prompt = buildStep2Prompt(extractJson(step1Response));
  const step2Response = await sendWithRetry(
    sender,
    [{ role: 'user', content: step2Prompt }],
    SYSTEM_PROMPT,
    {
      maxRetries,
      maxTokens: DEFAULT_MAX_RESPONSE_TOKENS,
      stream: !!options.onChunk,
      onChunk: options.onChunk,
      signal: options.signal,
    },
  );

  // Validate step 2
  const step2Data = parseAIResponse<Step2Result>(step2Response, step2Schema);

  options.onProgress?.({
    step: 2,
    totalSteps: 3,
    description: `Step 2/3: Found ${step2Data.relationships.length} relationships`,
  });

  // Step 3: Map to ArchCanvas types
  options.onProgress?.({
    step: 3,
    totalSteps: 3,
    description: 'Step 3/3: Mapping to ArchCanvas node types...',
  });

  const step3Prompt = buildStep3Prompt(
    extractJson(step1Response),
    extractJson(step2Response),
  );
  const step3Response = await sendWithRetry(
    sender,
    [{ role: 'user', content: step3Prompt }],
    SYSTEM_PROMPT,
    {
      maxRetries,
      maxTokens: DEFAULT_MAX_RESPONSE_TOKENS,
      stream: !!options.onChunk,
      onChunk: options.onChunk,
      signal: options.signal,
    },
  );

  const result = parseAIResponse<InferenceResult>(step3Response, inferenceResultSchema);

  options.onProgress?.({
    step: 3,
    totalSteps: 3,
    description: `Complete: ${result.nodes.length} nodes, ${result.edges.length} edges`,
    partialResult: result,
  });

  return result;
}

/**
 * Run deep analysis (multi-step + reads additional files + includes notes).
 * Falls back to standard analysis but with more detailed prompts.
 */
async function inferDeep(
  sender: AIMessageSender,
  profile: ProjectProfile,
  keyFiles: KeyFileSet,
  options: InferenceOptions,
): Promise<InferenceResult> {
  // Deep mode runs standard analysis first, then a refinement step
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

  // Run standard analysis first
  const standardResult = await inferStandard(sender, profile, keyFiles, {
    ...options,
    onProgress: (event) => {
      // Re-number steps: standard is steps 1-3, refinement is step 4
      options.onProgress?.({
        ...event,
        totalSteps: 4,
      });
    },
  });

  // Step 4: Refinement - ask AI to add notes and suggestions
  options.onProgress?.({
    step: 4,
    totalSteps: 4,
    description: 'Step 4/4: Adding detailed notes and suggestions...',
  });

  const refinementPrompt = `Review this inferred architecture and enhance it with detailed notes and suggestions.

## Current Architecture
${JSON.stringify(standardResult, null, 2)}

## Instructions
1. Add more detailed descriptions to each node based on what you can infer about the technology choices.
2. Identify any potential architectural concerns (e.g., single points of failure, missing caching, tight coupling).
3. Suggest improvements where applicable.
4. Ensure all code references are accurate based on the files you've seen.

Return the enhanced architecture in the same JSON format:
{
  "architectureName": "string",
  "architectureDescription": "string - enhanced with more detail",
  "nodes": [...],
  "edges": [...]
}

Respond ONLY with the JSON object. No markdown code fences.`;

  const refinedResponse = await sendWithRetry(
    sender,
    [{ role: 'user', content: refinementPrompt }],
    SYSTEM_PROMPT,
    {
      maxRetries,
      maxTokens: DEFAULT_MAX_RESPONSE_TOKENS,
      stream: !!options.onChunk,
      onChunk: options.onChunk,
      signal: options.signal,
    },
  );

  const refined = parseAIResponse<InferenceResult>(refinedResponse, inferenceResultSchema);

  options.onProgress?.({
    step: 4,
    totalSteps: 4,
    description: `Complete: ${refined.nodes.length} nodes, ${refined.edges.length} edges (deep analysis)`,
    partialResult: refined,
  });

  return refined;
}

// ── Main API ─────────────────────────────────────────────────────────────────

/**
 * Infer the system architecture from a project profile and key files.
 *
 * Uses Claude to analyze the codebase and identify components, relationships,
 * and map them to ArchCanvas node types.
 *
 * @param sender - AI message sender (dependency injection for testability)
 * @param projectProfile - Detected project profile from detector.ts
 * @param keyFiles - Selected key files from fileSelector.ts
 * @param options - Configuration options (depth, streaming, retry, etc.)
 * @returns InferenceResult with nodes, edges, and architecture metadata
 */
export async function inferArchitecture(
  sender: AIMessageSender,
  projectProfile: ProjectProfile,
  keyFiles: KeyFileSet,
  options: InferenceOptions = {},
): Promise<InferenceResult> {
  const depth = options.depth ?? 'standard';

  switch (depth) {
    case 'quick':
      return inferQuick(sender, projectProfile, keyFiles, options);
    case 'standard':
      return inferStandard(sender, projectProfile, keyFiles, options);
    case 'deep':
      return inferDeep(sender, projectProfile, keyFiles, options);
    default:
      throw new InferenceError(
        `Unknown analysis depth: ${depth}`,
        'AI_ERROR',
      );
  }
}
