<p align="center">
  <img src="public/favicon.svg" alt="ArchCanvas logo" width="128" height="128">
</p>

<h1 align="center">ArchCanvas</h1>

<p align="center"><strong>You design the architecture. AI writes the code.</strong></p>

ArchCanvas is a visual architecture tool built for the AI era of software development. You think in systems — services, databases, queues, connections — and express your design on an interactive canvas. AI reads your architecture as the source of truth and turns it into working code.

No more translating between diagrams and implementation. **The diagram _is_ the spec.**

<p align="center"> 
<video src="https://github.com/user-attachments/assets/f42215a2-d109-4bf6-96d7-6036585747d0" width="800" autoplay loop muted playsinline>
Your browser does not support the video tag.
</video>
</p>
<p align="center"><em>AI reads your codebase and builds the architecture diagram — in seconds.</em></p>

## Why ArchCanvas?

Software development is changing. AI can write code — but it still needs an architect. The bottleneck is no longer typing code. It's **designing the right system**.

Most architecture tools weren't built for this world. They produce static diagrams that rot in Figma or Miro, disconnected from the codebase. ArchCanvas is different:

- **Your architecture drives the code** — design visually, commit to git, and let AI implement from your diagram. The canvas is the single source of truth, not an afterthought.
- **Infinite depth** — dive into any service to see its internals, then zoom back out to the full system. Subsystems nest recursively, just like real architectures.
- **Community-driven catalog** — 40+ built-in component types (services, databases, queues, gateways, AI pipelines). Define custom types for your team. Share them across the community.
- **Git-native** — human-readable YAML files in `.archcanvas/`, committed alongside your source code. Meaningful diffs in PRs. Architecture changes reviewed like code changes.

## Features

### Visual Canvas
- Interactive graph editor with pan, zoom, drag, and connect
- 9 node shapes (rectangle, cylinder, hexagon, cloud, etc.) mapped to architectural concepts
- 3 edge protocols (sync, async, data flow) with labels and entity annotations
- Nestable canvases — any node can contain child nodes, creating infinite depth
- Cross-scope edges connecting nodes across different nesting levels
- Auto-layout via ELK with manual position overrides
- Command palette (`Cmd+K`) with fuzzy search across nodes, actions, types, and entities

### AI Integration
- Built-in AI chat panel with Claude Code SDK support
- 9 MCP tools for architecture CRUD (add/remove nodes and edges, search, describe, import YAML)
- AI-powered onboarding — point it at a codebase and watch the architecture materialize
- Tools run in-process via the Claude Agent SDK — no external binary or CLI needed

### Data Model
- Human-readable YAML file format (`.archcanvas/` directory)
- One file per canvas scope — clean git diffs, no monolithic blobs
- Entities (domain objects) as first-class concepts on edges
- Cross-scope references (`@<ref>/<node-id>`) for connecting across subsystem boundaries

### NodeDef System
- ~40 built-in node types across 9 namespaces (compute, data, messaging, network, client, integration, security, observability, AI)
- Project-local custom node definitions in `.archcanvas/nodedefs/`
- Each NodeDef specifies shape, icon, configurable args, ports, nesting rules, and AI hints
- Validated with Zod schemas at all boundaries

### Editor Experience
- Undo/redo (patch-based via Immer)
- Keyboard shortcuts for all common operations
- Context menus for nodes and edges
- Detail panels with properties, notes, and code reference tabs
- Open/save/save-as with dirty tracking and recent files
- Dark theme support

### Built for Architects and Senior Engineers

ArchCanvas is purpose-built for the people who design systems — not another general-purpose diagramming tool. Available as a **web app** (any modern browser) and a **Mac desktop app** (Tauri 2.0, same codebase).

## Getting Started

> **End users**: The desktop app ships as a self-contained `.dmg` — no dependencies required, just install and run. The prerequisites below are for **developers building from source**.

### Prerequisites (Web Dev)

| Requirement | Version |
|-------------|---------|
| **Node.js** | 20+ |
| **npm** | 10+ (ships with Node 20) |

### Prerequisites (Desktop Dev)

Everything above, plus:

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Rust** | stable (latest) | Install via [rustup](https://rustup.rs) |
| **Tauri CLI** | 2.x | Installed as a dev dependency (`@tauri-apps/cli`) |
| **Xcode** | 15+ | macOS only — needed for native compilation |
| **Xcode Command Line Tools** | Latest | `xcode-select --install` |

> See the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/) for platform-specific system dependencies.

### Setup

```bash
# Clone the repository
git clone https://github.com/dangtrivan15/archcanvas.git
cd archcanvas

# Install dependencies
npm install
```

### Running the Web App

```bash
npm run dev
```

Opens at [http://localhost:5173](http://localhost:5173). The AI bridge server starts automatically alongside the Vite dev server.

### Running the Desktop App

```bash
# First run — Rust compilation takes a few minutes
npm run tauri dev
```

This starts the Vite dev server, compiles the Rust backend, builds the AI bridge sidecar, and opens the native Tauri window.

### Building for Production

```bash
# Web — outputs to dist/
npm run build

# Desktop — outputs .dmg/.app to src-tauri/target/release/bundle/
npm run tauri build
```

### Running Tests

```bash
# Unit tests (Vitest)
npm test

# Unit tests in watch mode
npx vitest

# E2E tests (Playwright — builds first, runs against vite preview)
npm run test:e2e

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Project Structure

```
archcanvas/
  src-web/
    components/       # React UI — canvas, nodes, edges, panels, toolbar, onboarding
    store/            # Zustand stores — graph, file, canvas, navigation, history, chat, UI
    core/             # Pure TypeScript — graph engine, registry, layout, AI, validation
    storage/          # YAML codec, file resolver, multi-file project loading
    platform/         # FileSystem abstraction — Web, Tauri, Node.js, InMemory impls
    bridge/           # Standalone sidecar entry point (Tauri desktop AI bridge)
    types/            # Zod schemas and TypeScript types
  src-tauri/          # Tauri 2.0 Rust backend
  test/               # Unit tests (Vitest) + E2E tests (Playwright)
  docs/
    archcanvas-v2-design.md   # Product & architecture design spec
    specs/                    # Technical specs for each initiative
    plans/                    # Implementation plans
    progress/                 # Recap/retrospective for each milestone
```

### Architecture Layers

The codebase follows strict layering — each layer only depends on the one below it:

| Layer | Purpose | Key constraint |
|-------|---------|---------------|
| **Presentation** | React components, hooks, Tailwind styles | Depends on State layer only |
| **State** | Zustand stores (thin, delegate to Core) | No business logic — orchestration only |
| **Core** | Graph engine, registry, layout, history, AI | **Zero** React/DOM/Tauri/platform dependencies |
| **Storage** | YAML read/write, file resolution | Pure I/O transformation |
| **Platform** | Tauri APIs, Web APIs, file system adapters | Abstraction boundary for OS features |

> For the full design rationale, see [docs/archcanvas-v2-design.md](docs/archcanvas-v2-design.md).

## Roadmap

### v1 — Current (pre-release)

- [x] Nestable canvas with dive-in/go-up navigation
- [x] YAML file format (`.archcanvas/` folder, one file per canvas)
- [x] ~40 built-in NodeDefs across 9 namespaces
- [x] Project-local custom NodeDefs
- [x] 9 in-process MCP tools for AI architecture CRUD
- [x] AI chat via Claude Code SDK + WebSocket bridge
- [x] Onboarding wizard with AI architecture proposal
- [x] Command palette with fuzzy search
- [x] Undo/redo (patch-based)
- [x] Entity system with cross-scope resolution
- [x] Protocol compatibility validation
- [x] Tauri Mac desktop app
- [x] Web app (same codebase)
- [ ] Release testing and E2E validation

### v2 — Near-term

- [ ] Export (Markdown, PNG, SVG, PDF)
- [ ] Visual git diff — highlight added/removed/modified nodes on canvas from YAML diffs
- [ ] Remote NodeDef registry — community-shared node types via HTTP API
- [ ] iPad app (Tauri 2.0 mobile)
- [ ] Additional AI models (OpenAI, Ollama) via ChatProvider interface
- [ ] API key provider — direct Anthropic API, no bridge needed
- [ ] Starter architecture templates

### v3+ — Long-term

- [ ] Multiplayer coordination (conflict-aware editing, not real-time CRDT)
- [ ] Architecture validation (soft warnings driven by AI review hints)
- [ ] Code scaffolding from architecture (Dockerfiles, service stubs, API contracts)
- [ ] Registry governance (namespaces, verified publishers, versioning)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19, Tailwind CSS 4, Radix UI, Animate UI |
| Canvas | @xyflow/react v12 |
| Layout | elkjs |
| State | Zustand 5, Immer |
| Validation | Zod 4 |
| Serialization | yaml (YAML 1.2) |
| AI | Claude Agent SDK, Claude Code SDK |
| Desktop | Tauri 2.0 |
| Build | Vite 7, TypeScript 5.9 |
| Testing | Vitest 4, Playwright |
| Animation | Motion (Framer Motion) |
| Icons | Lucide React |

## License

Licensed under the [Elastic License 2.0 (ELv2)](LICENSE). You're free to use, modify, and self-host ArchCanvas. The main restriction: you may not offer it as a hosted or managed service to third parties.
