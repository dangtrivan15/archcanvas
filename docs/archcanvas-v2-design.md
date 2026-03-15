# ArchCanvas v2 — Product & Architecture Design

> **Status**: Approved design spec for full rewrite
> **Date**: 2026-03-11
> **Audience**: Implementors (engineers), managers (task planning & splitting)

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Design Principles](#2-design-principles)
3. [Three Pillars: Software, Connections, Data](#3-three-pillars-software-connections-data)
4. [Data Model & File Format](#4-data-model--file-format)
5. [NodeDef System & Registry](#5-nodedef-system--registry)
6. [Application Architecture](#6-application-architecture)
7. [AI Integration](#7-ai-integration)
8. [Onboarding Flow](#8-onboarding-flow)
9. [Command Palette](#9-command-palette)
10. [Roadmap & Deferred Decisions](#10-roadmap--deferred-decisions)

---

## 1. Product Vision

ArchCanvas is a visual architecture design tool for **engineers and architects**. It renders software systems as interactive, nestable graphs on a canvas.

**The core loop**: AI uses ArchCanvas as the source of truth for code implementation and maintenance. Humans work only with the visualization. The architecture and codebase evolve together.

### Target Users

- Software engineers designing systems
- Architects documenting and evolving existing architectures
- AI agents that read/write architecture to drive code generation

### Platforms

| Platform | Technology | Timeline |
|----------|-----------|----------|
| **Mac desktop app** | Tauri 2.0 | v1 |
| **Web app** | Same React codebase, served in browser | v1 |
| **iPad app** | Tauri 2.0 mobile | v2 |

### What ArchCanvas IS

- A visual architecture design tool backed by human-readable YAML files
- An AI-native tool where AI interacts via CLI (same interface as humans)
- A community-extensible platform through NodeDef definitions and a registry

### What ArchCanvas is NOT

- Not a runtime monitoring dashboard (no health/status indicators)
- Not a code editor (it links to code, doesn't contain it)
- Not a database modeling tool (it references entities, doesn't define schemas)

---

## 2. Design Principles

| Principle | Meaning |
|-----------|---------|
| **YAML is truth** | Human-readable files in `.archcanvas/`, committed to git alongside source code. |
| **Closed-source app, open format** | The file format is open (YAML). The app, CLI, and ecosystem are the product. |
| **Nodes are everything** | Every architectural concept is a node. Infrastructure, services, databases, queues — all nodes. Edges are just arrows between ports. |
| **Nestable by default** | Any node can contain child nodes. A canvas IS a node. Systems contain subsystems recursively. |
| **AI-native** | AI doesn't use a special API. It uses the same CLI humans can use. Two AI backends (API key, Claude Code CLI) behind one chat UI. |
| **Community-extensible** | NodeDefs define what types of nodes exist. Built-in set for onboarding. Community registry for sharing custom definitions. |
| **Git-friendly** | One YAML file per canvas scope. Meaningful diffs in PRs. Visual graph diff on roadmap. |

---

## 3. Three Pillars: Software, Connections, Data

Everything in ArchCanvas maps to one of three concepts:

| Pillar | Representation | Examples |
|--------|---------------|----------|
| **Software** | Nodes — services, databases, queues, functions, anything that runs or stores | Order Service, PostgreSQL, Kafka |
| **Connections** | Edges — direction, protocol, label, how software talks to each other | HTTP call, SQL query, Kafka publish |
| **Data** | Entities — logical domain objects that flow through connections | User, Order, Payment |

This keeps the conceptual surface small and easy to explain to users.

---

## 4. Data Model & File Format

### File Structure

```
project-root/
  .archcanvas/
    main.yaml                        ← root canvas (entrypoint)
    svc-order-service.yaml           ← subsystem canvas (diveable)
    svc-user-service.yaml            ← subsystem canvas (diveable)
    nodedefs/                        ← project-local custom NodeDef types
      my-custom-node.yaml
```

### Core Rule: One File Per Canvas

A node gets its own file **only if it's a canvas** — a subsystem the user can dive into and see a separate view. Leaf nodes (functions, databases, queues) are **always inline** in their parent canvas file.

This maps 1:1 to the user experience: each file = one zoom level.

| Project Size | Approximate File Count |
|-------------|----------------------|
| Small (5 services) | ~6 files |
| Medium (20 services, some nested) | ~25 files |
| Large (50+ services, 3 layers deep) | ~60 files |

### Loading Strategy

**Recursive per layer.** The app loads `main.yaml` first, then resolves `ref:` pointers to subsystem files. Each subsystem is loaded on demand when the user dives into it (or eagerly for search/AI purposes).

### Root Canvas File (`main.yaml`)

```yaml
# Project metadata (only in main.yaml)
project:
  name: E-commerce Platform
  description: Online marketplace with order management
  version: "1.0.0"

# Software — nodes in this scope
nodes:
  - id: svc-order-service
    ref: svc-order-service             # separate file (subsystem canvas)
  - id: svc-user-service
    ref: svc-user-service              # separate file (subsystem canvas)
  - id: db-postgres                    # inline leaf node
    type: data/database
    displayName: PostgreSQL
    args:
      engine: PostgreSQL
      version: "16"
  - id: mq-kafka                      # inline leaf node
    type: messaging/message-queue
    displayName: Kafka
    args:
      engine: Kafka

# Data — entities used in this scope
entities:
  - name: Order
    description: Purchase order with line items and payment
    codeRefs: [src/domain/order/]
  - name: User
    description: System user with profile and authentication
    codeRefs: [src/domain/user/]

# Connections — edges between nodes in this scope
edges:
  - from: { node: svc-order-service, port: publish-out }
    to: { node: mq-kafka, port: publish-in }
    protocol: Kafka
    label: publish order events
    entities: [Order]
  - from: { node: svc-order-service, port: http-out }
    to: { node: db-postgres, port: query-in }
    protocol: SQL
    label: persist orders
    entities: [Order]
```

### Subsystem Canvas File (`svc-order-service.yaml`)

```yaml
id: svc-order-service
type: compute/service
displayName: Order Service
description: Handles order lifecycle — creation, validation, fulfillment
args:
  language: TypeScript
  framework: Express
  replicas: 2

# Optional instance-level metadata
codeRefs:
  - path: src/services/order/
    role: source
notes:
  - author: van
    content: "Needs circuit breaker for payment calls"
    tags: [reliability]

# --- Internal structure (this node is a subsystem canvas) ---

# Software
nodes:
  - id: api-handler
    type: compute/function
    displayName: API Handler
  - id: order-validator
    type: compute/function
    displayName: Order Validator
  - id: order-processor
    type: compute/function
    displayName: Order Processor

# Data
entities:
  - name: CreateOrderRequest
    description: Inbound order creation payload
    codeRefs: [src/services/order/dto/]

# Connections
edges:
  - from: { node: api-handler, port: out }
    to: { node: order-validator, port: in }
    label: validate order
    entities: [CreateOrderRequest]
  - from: { node: order-processor, port: db-out }
    to: { node: @root/db-postgres, port: query-in }
    protocol: SQL
    label: persist order
    entities: [Order]
```

### Leaf Node (Inline)

Leaf nodes have no `nodes`, `entities`, or `edges` sections — just their identity and configuration:

```yaml
- id: db-postgres
  type: data/database
  displayName: PostgreSQL
  args:
    engine: PostgreSQL
    version: "16"
    storageGB: 100
    replication: primary-replica
  codeRefs:
    - path: src/db/migrations/
      role: schema
```

### Cross-Scope References

A child subsystem's edges can reference nodes in the parent scope using `@root/`:

```yaml
# Inside svc-order-service.yaml
edges:
  - from: { node: order-processor, port: db-out }
    to: { node: @root/db-postgres, port: query-in }    # parent scope
    protocol: SQL
```

`@root/` means "resolve from the root scope." The app resolves these at load time by scanning the project. Broken references show a warning.

### Key Rules Summary

1. **`main.yaml` is the entrypoint.** The app loads it first, then resolves `ref:` pointers.
2. **One file per canvas.** A file only exists for subsystem nodes that users can dive into.
3. **Leaf nodes are inline.** No file explosion for trivial components.
4. **Flat directory.** No subdirectories regardless of nesting depth.
5. **Edges are scoped.** Each file contains only the edges for its canvas level.
6. **Cross-scope via `@root/`.** Child scopes can reference parent nodes.
7. **Entities are scoped.** Defined per canvas file, referenced by name on edges.

---

## 5. NodeDef System & Registry

### What is a NodeDef?

A NodeDef defines a **type** of node — its identity, visual appearance, configurable properties, connection points, nesting rules, and AI hints. It's a YAML file that acts as a blueprint.

When a user drops a "Database" on the canvas, the app looks up the `data/database` NodeDef to know what shape to draw, what properties to show in the panel, and what ports are available for connections.

### NodeDef Structure

```yaml
kind: NodeDef
apiVersion: v1

metadata:
  name: service                    # machine key (unique within namespace)
  namespace: compute               # registry grouping + palette category
  version: "1.0.0"                 # semver for update tracking
  displayName: Service             # what users see
  description: "A deployable backend service that handles business logic"
  icon: Server                     # Lucide icon name
  tags: [backend, microservice]    # searchable labels for command palette
  shape: rectangle                 # visual shape on canvas

spec:
  args:                            # configurable properties per instance
    - name: language
      type: enum
      required: true
      options: [TypeScript, Python, Go, Java, Rust, "C#"]
      default: TypeScript
      description: Primary programming language
    - name: framework
      type: string
      description: Web framework used
      default: Express
    - name: replicas
      type: number
      description: Number of running instances
      default: 1

  ports:                           # connection points for edges
    - name: http-in
      direction: inbound
      protocol: [HTTP, HTTPS]
      description: Incoming HTTP requests
    - name: http-out
      direction: outbound
      protocol: [HTTP, HTTPS]
      description: Outgoing HTTP requests
    - name: grpc-in
      direction: inbound
      protocol: [gRPC]
      description: Incoming gRPC calls
    - name: grpc-out
      direction: outbound
      protocol: [gRPC]
      description: Outgoing gRPC calls

  children:                        # what node types can nest inside
    - nodedef: compute/function
      min: 0
      max: 50

  ai:                              # guidance for AI reasoning
    context: "This is a backend service. Consider its API surface, dependencies, scaling needs, and failure modes."
    reviewHints:
      - Check for single points of failure
      - Verify health check endpoint exists
      - Consider circuit breakers for outbound calls

variants:                          # quick-start presets
  - name: REST API
    description: RESTful HTTP service
    args:
      framework: Express
  - name: gRPC Service
    description: gRPC-based microservice
    args:
      framework: gRPC
```

### NodeDef Attribute Reference

| Group | Fields | Purpose |
|-------|--------|---------|
| **metadata** | name, namespace, version, displayName, description, icon, tags, shape | Identity and visual appearance |
| **spec.args** | name, type, required, options, default, description | Configurable properties shown in the detail panel |
| **spec.ports** | name, direction, protocol, description | Connection points — edges attach to ports |
| **spec.children** | nodedef, min, max | What node types can nest inside (makes it a canvas) |
| **spec.ai** | context, reviewHints | Injected into AI prompts when reasoning about this node |
| **variants** | name, description, args | Pre-filled configurations for quick creation |

#### Arg types

| Type | Description |
|------|-------------|
| `string` | Free text |
| `number` | Numeric value |
| `boolean` | True/false toggle |
| `enum` | Pick from `options` list |
| `duration` | Time duration (e.g., "30s", "5m") |

#### Port directions

| Direction | Meaning |
|-----------|---------|
| `inbound` | Receives connections from other nodes |
| `outbound` | Sends connections to other nodes |

#### Shapes

| Shape | Typical Use |
|-------|-------------|
| `rectangle` | Services, functions, generic components |
| `cylinder` | Databases, storage |
| `hexagon` | Processors, transformers |
| `parallelogram` | Message queues, streams |
| `cloud` | External/third-party services |
| `stadium` | Gateways, load balancers |
| `document` | Config, schemas |
| `badge` | Small utility nodes |
| `container` | Canvas-ref nodes (subsystems) |

### Built-in NodeDefs

Ships with the app. Covers the most common architecture components:

| Namespace | Nodes |
|-----------|-------|
| **compute** | service, function, worker, container, cron-job |
| **data** | database, cache, object-storage, search-index |
| **messaging** | message-queue, event-bus, stream-processor, notification |
| **network** | api-gateway, load-balancer, cdn |
| **client** | web-app, mobile-app, cli |
| **integration** | third-party-api, webhook, etl-pipeline |
| **security** | auth-provider, vault, waf |
| **observability** | logging, monitoring, tracing |
| **ai** | llm-provider, vector-store, agent, rag-pipeline |

~40 built-in types. Enough to model most systems without custom definitions.

### Registry Architecture

Three layers, loaded in priority order:

```
1. Project-local (.archcanvas/nodedefs/)   ← highest priority (team overrides)
2. Built-in (ships with app)               ← always available
3. Remote registry (network)               ← community-shared, fetched on demand
```

#### Project-Local NodeDefs

```
.archcanvas/
  nodedefs/
    my-custom-node.yaml
    internal-service.yaml
```

Loaded on project open. If a project-local NodeDef has the same `namespace/name` as a built-in, the project-local version wins.

#### Remote Registry

Community-extensible via HTTP API:

```
GET  /nodedefs                    ← list / search
GET  /nodedefs/:namespace/:name   ← fetch a single NodeDef
POST /nodedefs                    ← publish (authenticated)
```

User workflow:
1. Search "kubernetes" in command palette
2. App queries remote registry
3. Results: `kubernetes/pod`, `kubernetes/deployment`, `kubernetes/ingress`
4. User installs → downloaded to `.archcanvas/nodedefs/` and cached
5. Available in the project from now on

Registry hosting, governance, and publishing are deferred to v2.

### Protocol Compatibility Matrix

Defined **globally in the app**, not per NodeDef. Controls which ports can connect.

When a user drags an edge from `http-out` (protocol: HTTP) to `query-in` (protocol: SQL), the app checks the matrix. If the protocols aren't compatible, it warns.

The matrix is a simple lookup table shipped with the app and updatable in future versions.

---

## 6. Application Architecture

### Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **UI framework** | React 19 | Proven, large ecosystem, current team knowledge |
| **Build** | Vite 6 | Fast HMR, good Tauri integration |
| **Canvas** | @xyflow/react v12 | Best React graph library, handles pan/zoom/edges |
| **Layout engine** | elkjs | Automatic graph layout (ELK compiled to JS) |
| **Styling** | Tailwind CSS 4 + shadcn/ui | Utility-first, consistent component library |
| **State** | Zustand | Lightweight, focused stores, no boilerplate |
| **Desktop + iPad** | Tauri 2.0 | Mac + iPad + Web from one codebase |
| **CLI** | Node.js (commander) | Same TS codebase, AI agents call it |
| **Serialization** | YAML (yaml package) | Human-readable source of truth |
| **Validation** | Zod | Schema validation at all boundaries |
| **Icons** | Lucide React | Clean icon set, NodeDefs reference by name |
| **Testing** | Vitest + Playwright | Unit + e2e |

### Module Architecture

Strict layering. Each layer only depends on the one below it.

```
┌─────────────────────────────────────────────┐
│              Presentation Layer              │
│  React components, hooks, Tailwind styles   │
│  Canvas, panels, dialogs, command palette   │
├─────────────────────────────────────────────┤
│               State Layer                   │
│  Zustand stores (thin, delegate to core)    │
├─────────────────────────────────────────────┤
│                Core Layer                   │
│  Pure TypeScript — no React, no DOM, no UI  │
│  Graph engine, registry, layout, history    │
├─────────────────────────────────────────────┤
│              Storage Layer                  │
│  YAML read/write, file resolution, cache    │
├─────────────────────────────────────────────┤
│             Platform Layer                  │
│  Tauri APIs, Web APIs, file system adapter  │
└─────────────────────────────────────────────┘
```

**Critical rule**: The Core Layer has **zero** dependency on React, DOM, Tauri, or any platform API. It is pure TypeScript functions. This is the most important architectural constraint.

### Core Layer

```
core/
  graph/
    engine.ts          ← CRUD operations on the graph (pure functions)
    query.ts           ← search, filter, traverse, flatten
    validation.ts      ← graph integrity checks
  registry/
    core.ts            ← NodeDef registry (resolve, search, list)
    validator.ts       ← Zod schema for NodeDef validation
    loader.ts          ← load from builtin / project-local / remote
  layout/
    elk.ts             ← auto-layout via elkjs
  history/
    undoManager.ts     ← action-level undo/redo (patch-based via Immer)
  ai/
    chatProvider.ts    ← ChatProvider interface
    apiKeyProvider.ts  ← direct Anthropic API backend
    claudeCodeProvider.ts ← Claude Code CLI backend
  entity/
    resolver.ts        ← resolve entity references, cross-scope lookup
```

### State Layer (Zustand Stores)

Thin stores that delegate business logic to core functions. Each has a single responsibility.

| Store | Responsibility |
|-------|---------------|
| **graphStore** | Current graph state, delegates mutations to `core/graph/engine` |
| **fileStore** | Open/save/watch YAML files, dirty tracking |
| **registryStore** | Reactive bridge to `core/registry` |
| **historyStore** | Undo/redo stack, delegates to `core/history/undoManager` |
| **canvasStore** | Viewport, selection, draft edges (UI-only state) |
| **navigationStore** | Breadcrumb, dive-in/go-up between canvas layers |
| **uiStore** | Panel sizes, dialog state, command palette open/closed |
| **chatStore** | AI conversation state, active provider, messages |

**Cross-store communication**: Stores read each other via `getState()`. Side effects (notifications, auto-save triggers) flow through a lightweight event bus, not direct store-to-store calls.

### Presentation Layer

```
components/
  canvas/
    Canvas.tsx                ← thin wrapper, delegates to hooks
    hooks/
      useCanvasRenderer.ts    ← core graph → React Flow nodes/edges
      useCanvasInteractions.ts
      useCanvasKeyboard.ts
      useCanvasNavigation.ts  ← dive-in / go-up
  nodes/
    NodeRenderer.tsx          ← resolves NodeDef → shape, icon, ports
  edges/
    EdgeRenderer.tsx          ← renders based on protocol
  panels/
    NodeDetailPanel.tsx
    ChatPanel.tsx             ← single AI chat UI (both backends)
    EntityPanel.tsx           ← browse entities in current scope
  shared/
    CommandPalette.tsx        ← Cmd+K unified search (pluggable providers)
    Toast.tsx
  dialogs/
    registry.ts              ← self-registering dialog pattern
    DialogHost.tsx
```

### Platform Layer

```
platform/
  fileSystem.ts     ← interface for read/write/watch files
  tauri.ts          ← Tauri implementation (Mac, iPad)
  web.ts            ← Web implementation (File System Access API + fallback)
  clipboard.ts
  shell.ts          ← spawn CLI processes (for AI Claude Code backend)
```

### CLI Architecture

The CLI shares the Core Layer with the app. No code duplication.

```
cli/
  index.ts          ← entry point (commander)
  commands/
    init.ts         ← create .archcanvas/ with main.yaml
    add-node.ts     ← add a node to a scope
    add-edge.ts     ← connect two nodes
    remove-node.ts  ← remove a node
    list.ts         ← list nodes, edges, entities in a scope
    describe.ts     ← describe a node or the whole architecture
    search.ts       ← search across all scopes
    import.ts       ← bulk import from YAML
  context.ts        ← loads .archcanvas/, initializes core layer
  output.ts         ← JSON (for AI) / human-readable (for terminal) formatting
```

Every CLI command supports `--json` for structured output (AI consumption) and human-readable output (terminal use).

### Implementation Note: Module Reuse

Some modules from the current v1 codebase may be stable enough to reuse in the rewrite rather than rebuild from scratch. Candidates include:

- `core/graph/` — graphEngine, graphQuery (pure functions)
- `core/registry/` — RegistryManagerCore, nodedefValidator
- `core/layout/` — elkLayout
- `core/history/` — undoManager
- `core/platform/` — adapter interfaces

**Action item**: Evaluate each module at implementation phase for reuse viability. The binary/protobuf-specific code (codec, fileIO) will need rewriting for YAML.

---

## 7. AI Integration

### Two Backends, One Chat UI

```
┌──────────────────────────────────┐
│         Chat Panel (UI)          │
│  Same UI regardless of backend   │
└──────────────┬───────────────────┘
               │
       ChatProvider interface
               │
       ┌───────┴────────┐
       │                 │
  ApiKeyProvider    ClaudeCodeProvider
       │                 │
  Anthropic API     Claude Code CLI
  (app manages       (Claude Code manages
   tool loop)         tool loop)
```

User selects their preferred backend in settings. The chat experience is identical.

### ChatProvider Interface

```typescript
type ChatEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; result: string }
  | { type: 'thinking'; content: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

interface ChatProvider {
  sendMessage(content: string): AsyncIterable<ChatEvent>
  abort(): void
}
```

### ApiKeyProvider

The app acts as the agent:

1. Sends user message + tool definitions to Anthropic API
2. Receives response with text + `tool_use` blocks
3. Executes tools by calling `archcanvas` CLI commands
4. Sends tool results back to API
5. Loops until the model is done
6. Emits all steps as `ChatEvent`s to the UI

Tool definitions are generated from the CLI's command list — each CLI command becomes a tool.

### ClaudeCodeProvider

Claude Code is the agent:

1. App spawns Claude Code CLI as a subprocess (or uses `@anthropic-ai/claude-code` SDK)
2. Pipes the user message
3. Claude Code autonomously calls `archcanvas` CLI as needed
4. Streams structured output back
5. App parses into `ChatEvent`s for the UI

The app doesn't manage the tool loop — Claude Code handles it.

### What AI Can Do

Both backends have access to the same CLI commands:

| Command | AI Use Case |
|---------|------------|
| `archcanvas describe` | Understand current architecture |
| `archcanvas list` | See what nodes/edges/entities exist |
| `archcanvas search` | Find specific components |
| `archcanvas add-node` | Create new components |
| `archcanvas add-edge` | Connect components |
| `archcanvas remove-node` | Remove components |
| `archcanvas import` | Bulk-create from YAML |
| `archcanvas init` | Bootstrap from scratch |

### Generalization

The `ChatProvider` interface is model-agnostic. Future providers:

- `OpenAIProvider` — same pattern, different API
- `OllamaProvider` — local models
- Any model that supports tool use

The AI's only interface is the CLI — any model that can call shell commands works.

---

## 8. Onboarding Flow

### Decision Tree

```
Open project directory
  │
  ├─ .archcanvas/ exists with populated main.yaml?
  │    → Load and render the canvas
  │
  ├─ .archcanvas/ exists but main.yaml is empty?
  │    → Show onboarding wizard
  │
  └─ No .archcanvas/ folder?
       → Create .archcanvas/ + empty main.yaml (idempotent)
       → Show onboarding wizard
```

### Onboarding Wizard

A short guided flow that collects context and feeds it into an AI prompt.

**Step 1: "What's this project?"**
- Project name
- Brief description
- (Optional) Select primary tech stack from presets

**Step 2: "How should we initialize?"**
- **Option A**: "Let AI analyze the codebase and propose an architecture"
- **Option B**: "Start with a blank canvas"
- **Option C**: "Import from a template" (microservices starter, monolith, etc.)

**Step 3 (if Option A): AI Initialization**
1. App scans the project directory for recognizable patterns (package.json, Dockerfile, go.mod, src/ structure, etc.)
2. Feeds context into an AI system prompt:
   > "You are initializing an architecture for [project name]. Here is the project structure: [tree output]. Here are the key config files: [contents]. Create a detailed, layered architecture using the archcanvas CLI. Be thorough — include subsystems where appropriate."
3. AI uses CLI commands to build the graph iteratively
4. User watches the canvas populate in real-time
5. AI summarizes what it created in the chat

### AI Init Prompt Guidelines

The system prompt injected into the first conversation instructs the AI to:
- Be detailed with layers (use subsystems, don't flatten everything)
- Use the built-in NodeDef types
- Define entities for data flowing between components
- Add meaningful edge labels and protocols
- Create notes for architectural decisions it's making

This prompt is part of the app, not user-visible. Tuning it with real projects is a post-v1 activity.

---

## 9. Command Palette

### Unified `Cmd+K` Overlay

Single search box, categorized results. Inspired by VS Code / Raycast.

```
┌─────────────────────────────────────┐
│  Search nodes, actions, types...    │
├─────────────────────────────────────┤
│  NODES IN GRAPH                     │
│    Order Service          compute   │
│    PostgreSQL             data      │
│    Kafka                  messaging │
│  ACTIONS                            │
│    Add Node...                      │
│    Auto-layout                      │
│    Undo                             │
│  NODE TYPES                         │
│    Service         compute/service  │
│    Database        data/database    │
│    Message Queue   messaging/mq     │
└─────────────────────────────────────┘
```

### Search Categories

| Category | Source | Action on Select |
|----------|--------|-----------------|
| **Nodes in graph** | Current scope's nodes | Navigate to / select the node on canvas |
| **Actions** | Registered app commands | Execute the action |
| **Node types** | Registry (builtin + local + installed) | Opens "add node" flow with type pre-selected |
| **Entities** | Current scope's entities | Navigate to the edge(s) that reference it |
| **Scopes** | All canvas files in project | Dive into that scope |

### Keyboard Shortcuts

- `Cmd+K` — open palette
- Type to filter (fuzzy matching)
- Arrow keys to navigate, Enter to select, Esc to close
- Prefix shortcuts for power users:
  - `> ` — actions only
  - `@ ` — nodes only
  - `# ` — entities only

### Design Constraint: Pluggable UX

The command palette must be designed with a **pluggable result provider pattern**. Adding new categories, changing ranking logic, or modifying the UX should not require touching the core search logic. Each category registers a provider:

```typescript
interface PaletteProvider {
  category: string
  search(query: string): PaletteResult[]
  onSelect(result: PaletteResult): void
}
```

New categories are added by registering new providers, not by modifying the palette component.

---

## 10. Roadmap & Deferred Decisions

### v1 — Initial Release

| Feature | Description |
|---------|-------------|
| Nestable canvas | Dive-in / go-up between scope levels |
| YAML file format | `.archcanvas/` folder, one file per canvas, flat directory |
| Built-in NodeDefs | ~40 types across 9 namespaces |
| Project-local NodeDefs | Custom types in `.archcanvas/nodedefs/` |
| CLI | Full CRUD, search, describe, bulk import |
| AI chat (API key) | Direct Anthropic API via ChatProvider |
| AI chat (Claude Code CLI) | Claude Code subprocess via ChatProvider |
| Onboarding wizard | Guided init with AI architecture proposal |
| Command palette | Unified Cmd+K with pluggable providers |
| In-app undo/redo | Action-level, patch-based |
| Entities | Logical domain objects on edges, scoped per canvas |
| Protocol compatibility | Global matrix for edge validation |
| Tauri Mac app | Desktop distribution |
| Web app | Browser-based, same codebase |

### v2 — Near-Term Roadmap

| Feature | Notes |
|---------|-------|
| **Export** | Markdown, PNG, SVG, PDF. CLI: `archcanvas export`. |
| **Visual git diff** | Parse YAML diffs → highlight added/removed/modified nodes on canvas. Killer feature for PR reviews. |
| **Remote NodeDef registry** | HTTP API for community-shared NodeDefs. Search, install, publish. |
| **iPad app** | Tauri 2.0 mobile build. Same codebase. |
| **Additional AI models** | OpenAI, Ollama providers via ChatProvider interface. |
| **Templates** | Starter architectures for onboarding Option C. |

### v3+ — Long-Term Roadmap

| Feature | Notes |
|---------|-------|
| **Multiplayer coordination** | Conflict-aware editing (detect concurrent changes, assist merge). Not real-time CRDT. |
| **Architecture validation** | Soft warnings ("this DB has no backup"), driven by AI review hints. Not hard blocks. |
| **Code scaffolding** | AI generates boilerplate from architecture (Dockerfiles, service stubs, API contracts). |
| **Registry governance** | Namespaces, verified publishers, versioning, deprecation. npm-like ecosystem. |

### Critical Gap: AI Bridge in Production Builds

> **Status**: Must be resolved in I7 (Packaging & Polish) — blocks AI features outside `vite dev`.

The AI bridge (WebSocket + HTTP endpoints) currently only runs via the Vite dev server plugin (`configureServer` hook in `vitePlugin.ts`). In production builds (`vite preview`, Tauri desktop), the bridge does not start — the chat panel shows "No providers" and Claude Code CLI cannot connect.

**Impact**: Any feature that requires AI (chat, onboarding wizard AI init) only works in `vite dev` mode. The onboarding wizard (I6b) checks `provider.available` and gracefully degrades, but AI-powered architecture initialization is unavailable in production.

**Resolution path (I7)**:
1. Add `configurePreviewServer` hook to `vitePlugin.ts` for `vite preview` mode
2. Create standalone `archcanvas serve` command that hosts the bridge independently
3. Tauri sidecar: bundle the bridge server as a sidecar process, auto-started on app launch
4. Dynamic port discovery: browser detects bridge URL via environment variable or well-known port scan

This is a packaging/deployment concern, not an architecture issue — the bridge code (`claudeCodeBridge.ts`, `vitePlugin.ts`) is correct and complete. It just needs a host process outside of Vite dev.

### Deferred Decisions

To be resolved during implementation:

| Decision | Context |
|----------|---------|
| **Module reuse from v1** | Evaluate current graph engine, registry, layout, history, platform adapters for reuse vs. rewrite. |
| **Cross-scope reference syntax** | `@root/` is proposed. May need `@parent/` or relative paths. Decide when implementing recursive loader. |
| **Edge protocol rendering** | Solid vs. dashed vs. dotted per protocol category. Decide during UI implementation. |
| **NodeDef shape extensibility** | Current enum has 9 shapes. Community may want custom SVGs. Decide when building remote registry. |
| **AI system prompt tuning** | Onboarding init prompt needs iteration with real projects. Post-v1. |
| **CLI output format for Claude Code** | Test `stream-json` vs. npm SDK. Decide during AI integration. |
