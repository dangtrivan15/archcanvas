/**
 * External Agent Prompt Builder
 *
 * Generates a copyable prompt that users can paste into their external agent
 * (e.g., Claude Code, Cursor, etc.) to analyze a codebase and build an
 * architecture graph via the ArchCanvas MCP server.
 *
 * The prompt includes:
 * - Project path and context (folder name, detected languages/frameworks)
 * - Instructions for connecting to the MCP server
 * - Step-by-step workflow for building the architecture graph
 * - Available MCP tools and their usage
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** Minimal manifest shape used by the prompt builder (avoids coupling to internal types). */
interface ManifestLike {
  name: string;
}

export interface ExternalAgentPromptContext {
  /** Project/folder name */
  projectName: string;
  /** Absolute or display path to the project folder */
  projectPath: string;
  /** Whether source files were detected in the folder */
  hasSourceFiles: boolean;
  /** Optional: detected languages */
  languages?: string[];
  /** Optional: detected frameworks */
  frameworks?: string[];
  /** MCP server connection URL (for SSE-based agents) */
  mcpServerUrl?: string;
}

// ── Prompt Builder ───────────────────────────────────────────────────────────

/**
 * Build a copyable prompt for an external agent to analyze the codebase
 * and build an architecture graph using ArchCanvas MCP tools.
 */
export function buildExternalAgentPrompt(context: ExternalAgentPromptContext): string {
  const sections: string[] = [];

  // Header
  sections.push(
    `# ArchCanvas: Analyze "${context.projectName}" and Build Architecture Graph`,
  );

  // Project context
  sections.push(`## Project Context`);
  sections.push(`- **Project**: ${context.projectName}`);
  sections.push(`- **Path**: ${context.projectPath}`);

  if (context.languages && context.languages.length > 0) {
    sections.push(`- **Languages**: ${context.languages.join(', ')}`);
  }
  if (context.frameworks && context.frameworks.length > 0) {
    sections.push(`- **Frameworks**: ${context.frameworks.join(', ')}`);
  }

  // MCP connection instructions
  sections.push('');
  sections.push(`## Instructions`);
  sections.push('');
  sections.push(
    `You have access to ArchCanvas MCP tools for building an architecture graph. ` +
    `Analyze the codebase at the project path above and use the MCP tools to create ` +
    `a comprehensive, connected architecture diagram.`,
  );

  // Workflow
  sections.push('');
  sections.push(`## Workflow`);
  sections.push('');
  sections.push(`1. **Scan** the project directory structure and identify key files`);
  sections.push(`2. **Initialize** the architecture with \`init_architecture\` (name: "${context.projectName}")`);
  sections.push(`3. **Identify** all architecturally significant components: services, databases, APIs, clients, queues, etc.`);
  sections.push(`4. **Create nodes** using \`add_node\` with appropriate types (e.g., compute/service, storage/database)`);
  sections.push(`5. **Connect nodes** using \`add_edge\` with correct types (sync, async, data-flow) and labels`);
  sections.push(`6. **Attach code references** using \`add_code_ref\` for key implementation files`);
  sections.push(`7. **Review** the graph with \`describe\` and refine as needed`);

  // Available tools summary
  sections.push('');
  sections.push(`## Available MCP Tools`);
  sections.push('');
  sections.push(`### Query`);
  sections.push(`- \`describe\` — View architecture (formats: "structured", "human", "ai")`);
  sections.push(`- \`list_nodedefs\` — List available node types`);
  sections.push(`- \`search\` — Full-text search across nodes/edges/notes`);
  sections.push(`- \`get_edges\` — List all edges`);
  sections.push('');
  sections.push(`### Create`);
  sections.push(`- \`init_architecture\` — Initialize with name and description`);
  sections.push(`- \`add_node\` — Create a node (type, displayName, optional parentId)`);
  sections.push(`- \`add_edge\` — Connect nodes (fromNode, toNode, type, label)`);
  sections.push(`- \`add_code_ref\` — Link source file to node (nodeId, path, role)`);
  sections.push(`- \`add_note\` — Add a note to a node or edge`);
  sections.push('');
  sections.push(`### Modify`);
  sections.push(`- \`update_node\` — Update node name, args, or properties`);
  sections.push(`- \`remove_node\` — Delete a node and its edges`);
  sections.push(`- \`remove_edge\` — Delete an edge`);

  // Guidelines
  sections.push('');
  sections.push(`## Guidelines`);
  sections.push('');
  sections.push(`- Create a **connected graph** — every node should have at least one edge`);
  sections.push(`- Use **specific names** (e.g., "User Auth Service" not "Service 1")`);
  sections.push(`- Choose correct **edge types**: sync (HTTP/gRPC), async (queues/events), data-flow (ETL/streams)`);
  sections.push(`- **Label edges** with protocols (REST, gRPC, Kafka, SQL, etc.)`);
  sections.push(`- Model **data stores** as separate nodes (databases, caches, queues)`);
  sections.push(`- Use **parent-child nesting** for sub-components within a service`);
  sections.push(`- Be **thorough** — model every meaningful component (typically 15-50+ nodes). Prefer completeness over brevity, but avoid dummy nodes`);

  return sections.join('\n');
}

/**
 * Build a minimal context from a project manifest and folder handle.
 */
export function buildPromptContextFromProject(
  manifest: ManifestLike | null,
  directoryHandle: FileSystemDirectoryHandle | null,
  hasSourceFiles: boolean,
): ExternalAgentPromptContext {
  const projectName = manifest?.name || directoryHandle?.name || 'My Project';
  const projectPath = directoryHandle?.name || projectName;

  return {
    projectName,
    projectPath,
    hasSourceFiles,
  };
}
