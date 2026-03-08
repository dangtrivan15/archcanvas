/**
 * Agentic Architecture Building Prompts
 *
 * System prompt and user prompt builder that instruct Claude to iteratively
 * analyze a codebase and build an architecture graph using MCP tools
 * (add_node, add_edge, add_code_ref, etc.).
 *
 * Unlike the passive inference engine (which returns JSON for post-processing),
 * these prompts guide an agentic Claude session that directly invokes MCP tools
 * to construct a connected, meaningful architecture graph.
 */

import type { NodeDef } from '@/types/nodedef';
import type { RegistryManagerCore } from '@/core/registry/registryCore';
import { NODE_TYPE_REGISTRY_TEXT } from '@/analyze/prompts/shared';

// ── Types ────────────────────────────────────────────────────────────────────

/** Metadata about the project to include in the user prompt */
export interface ProjectMetadata {
  /** Project/folder name */
  name: string;
  /** Directory listing (tree output or flat list) */
  directoryListing: string;
  /** Key file contents (e.g., package.json, config files, entry points) */
  keyFiles: KeyFileContent[];
  /** Optional description or README excerpt */
  description?: string;
  /** Optional detected languages with percentages */
  languages?: LanguageInfo[];
  /** Optional detected frameworks */
  frameworks?: string[];
  /** Optional detected infrastructure signals */
  infraSignals?: string[];
}

/** A key file's path and content, used in the user prompt */
export interface KeyFileContent {
  /** Relative file path (e.g., "package.json", "src/main.ts") */
  path: string;
  /** File content (may be truncated for large files) */
  content: string;
}

/** Language usage info */
export interface LanguageInfo {
  name: string;
  percentage: number;
}

// ── System Prompt ────────────────────────────────────────────────────────────

/**
 * Build the system prompt for an agentic architecture-building session.
 *
 * The system prompt explains the available MCP tools, node types, edge types,
 * and the iterative workflow Claude should follow to build a connected graph.
 *
 * @param registry - Optional registry to dynamically list node types.
 *                   Falls back to the static NODE_TYPE_REGISTRY_TEXT.
 */
export function buildSystemPrompt(registry?: RegistryManagerCore): string {
  const nodeTypesSection = registry
    ? buildDynamicNodeTypes(registry)
    : NODE_TYPE_REGISTRY_TEXT;

  return `You are an expert software architect using ArchCanvas, a visual architecture design tool.
Your task is to analyze a codebase and build a comprehensive architecture graph by calling MCP tools.
You will work iteratively: scan the project, identify components, create nodes, establish connections,
and attach code references.

## Your Goal

Build a **connected, meaningful architecture graph** that accurately represents the system's
components and their relationships. The graph should help a developer understand the system
at a glance. Avoid shallow, disconnected nodes — every node should be connected to at least
one other node via an edge.

## Available MCP Tools

### Query Tools
- **describe**: View the current architecture state (format: "structured", "human", or "ai")
- **list_nodedefs**: List available node types (optionally filter by namespace)
- **search**: Full-text search across nodes, edges, and notes
- **get_edges**: List all edges in the architecture
- **file_info**: Get metadata about the loaded .archc file

### Mutation Tools
- **init_architecture**: Reset to empty graph (use at start if needed)
  - Parameters: name (string), description (string)

- **add_node**: Create a new architecture node
  - Parameters: type (string, e.g., "compute/service"), displayName (string),
    parentId (string, optional — for nesting), args (object, optional)
  - Returns: the created node with its generated ID
  - For composite subsystems, use type "meta/canvas-ref" with args:
    { filePath: "./subsystem.archc" } for local references, or
    { repoUrl: "https://github.com/org/repo.git", ref: "v1.0.0" } for remote git repos

- **add_edge**: Connect two nodes
  - Parameters: fromNode (string — node ID), toNode (string — node ID),
    type ("sync" | "async" | "data-flow"), label (string, optional)

- **add_code_ref**: Link a source file to a node
  - Parameters: nodeId (string), path (string — relative file path),
    role ("source" | "api-spec" | "schema" | "deployment" | "config" | "test")

- **add_note**: Annotate a node or edge with a note
  - Parameters: nodeId or edgeId (string), author (string), content (string)

- **update_node**: Modify a node's display name, args, or properties
  - Parameters: nodeId (string), displayName (string, optional), args (object, optional)

- **remove_node**: Delete a node and its connected edges
  - Parameters: nodeId (string)

- **remove_edge**: Delete an edge
  - Parameters: edgeId (string)

### Export Tools
- **export_markdown**: Generate markdown summary
- **export_mermaid**: Generate Mermaid diagram

${nodeTypesSection}

## Edge Types

Choose the appropriate edge type based on the relationship:

| Type | When to Use | Examples |
|------|-------------|---------|
| **sync** | Synchronous request-response | HTTP REST calls, gRPC, SQL queries, function calls |
| **async** | Asynchronous fire-and-forget or pub/sub | Message queues, event buses, webhooks, background jobs |
| **data-flow** | Data movement or ETL pipelines | File transfers, data replication, stream processing |

## Code Reference Roles

When attaching file paths to nodes, use the appropriate role:

| Role | When to Use |
|------|-------------|
| **source** | Implementation files (the actual code for this component) |
| **api-spec** | OpenAPI/Swagger specs, GraphQL schemas |
| **schema** | Data schemas (protobuf, JSON Schema, DB migrations) |
| **deployment** | Docker, Kubernetes, Terraform, CI/CD configs |
| **config** | Configuration files (env, yaml, json settings) |
| **test** | Test files for this component |

## Iterative Workflow

Follow these steps in order. After each step, verify your work with the \`describe\` tool.

### Step 1: Scan & Understand
- Read the directory structure and key files provided
- Identify the project type (web app, microservices, data pipeline, CLI, etc.)
- Note the primary languages, frameworks, and infrastructure

### Step 2: Plan the Architecture
- Identify ALL architecturally significant components, not just the top-level ones
- Determine which node type best fits each component
- Sketch out the connections between components
- Plan parent-child relationships for nested components

### Step 2.5: Identify Composite Subsystems (Canvas References)
- Look for subsystems that warrant their own separate architecture canvas
- Use **meta/canvas-ref** nodes when a subsystem:
  - Has **5+ internal components** that form a cohesive unit
  - Represents a **separate bounded context** (e.g., a microservice with its own domain)
  - Is **maintained by a different team** or has an independent release cycle
  - Already has (or should have) its **own .archc file** or git repository
- **children vs canvas-ref**: Use \`parentId\` (children) for internal decomposition within the same architecture file. Use \`meta/canvas-ref\` when the subsystem deserves its own architecture file — it represents a true architectural boundary.
- canvas-ref args: \`filePath\` for local .archc references, or \`repoUrl\` + \`ref\` for remote git repositories
- **Only use canvas-ref when complexity warrants it** — not every analysis needs composite nodes. A simple project with a single team and domain should use flat or nested nodes instead.

### Step 3: Create Nodes (Top-Down)
- Start with the highest-level components (entry points, main services)
- Use \`add_node\` for each component with the correct type from the registry
- For composite systems, use parentId to nest child components
- For subsystems identified in Step 2.5, use \`add_node\` with type \`meta/canvas-ref\` and appropriate args (filePath or repoUrl)
- Model every architecturally significant component. Be thorough — a typical project produces 15-50+ nodes across multiple levels. Prefer completeness over brevity.

### Step 4: Establish Edges
- Connect related nodes with \`add_edge\`
- Use the correct edge type (sync/async/data-flow) based on the actual communication pattern
- Add descriptive labels (e.g., "REST API", "Kafka events", "SQL queries")
- Every node should have at least one connection

### Step 5: Attach Code References
- Use \`add_code_ref\` to link relevant files to each node
- Prioritize: entry points, main implementation files, config files
- Use the correct role (source, config, deployment, etc.)

### Step 6: Review & Refine
- Use \`describe\` with format "human" to review the full architecture
- Check for disconnected nodes and add missing edges
- Verify node types are appropriate
- Add notes to complex nodes explaining key decisions

## Guidelines

- **Be specific**: Use concrete names ("User Auth Service") not vague ones ("Service 1")
- **Be connected**: No orphan nodes — everything connects to something
- **Be accurate**: Match node types to actual component roles
- **Be thorough**: Model every meaningful component — prefer completeness over brevity, but don't create dummy or placeholder nodes
- **Be hierarchical**: Use parent-child nesting for sub-components within a service
- **Capture data stores**: Always model databases, caches, and message queues as separate nodes
- **Label edges**: Include protocol or method in edge labels (HTTP, gRPC, SQL, Kafka, etc.)
`;
}

// ── User Prompt Builder ──────────────────────────────────────────────────────

/**
 * Build the initial user prompt that provides project context and kicks off
 * the architecture building session.
 *
 * @param metadata - Project metadata (name, directory listing, key files, etc.)
 */
export function buildUserPrompt(metadata: ProjectMetadata): string {
  const sections: string[] = [];

  // Header
  sections.push(
    `Please analyze the following codebase and build a complete architecture graph for **${metadata.name}**.`,
  );

  // Description
  if (metadata.description) {
    sections.push(`## Project Description\n${metadata.description}`);
  }

  // Languages
  if (metadata.languages && metadata.languages.length > 0) {
    const langList = metadata.languages
      .map((l) => `- ${l.name}: ${l.percentage}%`)
      .join('\n');
    sections.push(`## Detected Languages\n${langList}`);
  }

  // Frameworks
  if (metadata.frameworks && metadata.frameworks.length > 0) {
    sections.push(`## Detected Frameworks\n- ${metadata.frameworks.join('\n- ')}`);
  }

  // Infrastructure
  if (metadata.infraSignals && metadata.infraSignals.length > 0) {
    sections.push(`## Infrastructure Signals\n- ${metadata.infraSignals.join('\n- ')}`);
  }

  // Directory listing
  sections.push(`## Directory Structure\n\`\`\`\n${metadata.directoryListing}\n\`\`\``);

  // Key files
  if (metadata.keyFiles.length > 0) {
    const filesSection = metadata.keyFiles
      .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
      .join('\n\n');
    sections.push(`## Key File Contents\n\n${filesSection}`);
  }

  // Instructions
  sections.push(`## Instructions

1. Start by calling \`init_architecture\` with name "${metadata.name}" and a brief description
2. Analyze the directory structure and file contents above
3. Identify the major architectural components (services, databases, queues, clients, etc.)
4. Create nodes for each component using \`add_node\` with the most appropriate node type
5. Connect the nodes using \`add_edge\` with correct edge types and descriptive labels
6. Attach code references using \`add_code_ref\` for key implementation files
7. Review with \`describe\` (format: "human") and refine as needed

Focus on creating a **connected graph** that tells the story of how this system works.
Every node should have at least one edge connecting it to another node.`);

  return sections.join('\n\n');
}

// ── Dynamic Node Types ───────────────────────────────────────────────────────

/**
 * Build a formatted string of all available node types from a live registry.
 * Used when a registry instance is available (e.g., in the web app or MCP server).
 */
export function buildDynamicNodeTypes(registry: RegistryManagerCore): string {
  const namespaces = registry.listNamespaces();
  if (namespaces.length === 0) {
    return NODE_TYPE_REGISTRY_TEXT; // Fallback to static text
  }

  const lines: string[] = [
    '## Available ArchCanvas Node Types',
    'Map each component to one of these built-in node types (namespace/name):',
    '',
  ];

  for (const ns of namespaces.sort()) {
    lines.push(`### ${capitalize(ns)}`);
    const defs = registry.listByNamespace(ns);
    for (const def of defs) {
      const key = `${def.metadata.namespace}/${def.metadata.name}`;
      const desc = def.metadata.description;
      const aiContext = def.spec.ai?.context;
      const line = aiContext
        ? `  - ${key}: ${desc} (${aiContext})`
        : `  - ${key}: ${desc}`;
      lines.push(line);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Format a NodeDef array into a human-readable type list.
 * Useful for testing or embedding in custom prompts.
 */
export function formatNodeTypes(defs: NodeDef[]): string {
  return defs
    .map((d) => `- ${d.metadata.namespace}/${d.metadata.name}: ${d.metadata.description}`)
    .join('\n');
}
