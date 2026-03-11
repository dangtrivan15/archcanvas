# ArchCanvas

A visual architecture design tool where software systems are represented as typed, composable, code-bound graph nodes on an interactive canvas. The `.archc` binary file (Protocol Buffers) is the single source of truth, and AI and humans interact through the same Text API.

## Features

- **Interactive Canvas** - Drag-and-drop nodes, connect with typed edges (sync/async/data-flow), zoom into composite nodes
- **30+ Built-in Node Types** - Services, databases, queues, caches, gateways, functions, and more via YAML definitions
- **Protocol Buffer Storage** - Binary `.archc` files with magic bytes, versioning, and SHA-256 checksums
- **AI Chat Integration** - Claude-powered architecture assistant with node-scoped conversations and AI suggestions
- **MCP Server** - Model Context Protocol server for AI agent integration (stdio + SSE transports)
- **CLI Tool** - Command-line interface for file inspection, codebase analysis, and MCP server
- **Template Gallery** - 14 built-in architecture templates with preview, search, and import/export
- **Codebase Analysis** - AI-powered analysis pipeline that infers architecture from source code
- **Export** - Markdown, Mermaid diagrams, PNG, and SVG export
- **Auto-Layout** - ELK-based automatic graph layout
- **Undo/Redo** - Full undo history with architecture snapshots
- **Annotations** - Freehand drawing overlay on the canvas
- **iOS Support** - Native iOS app via Capacitor
- **Theming** - Light, dark, and system color themes with customizable accent colors

## Quick Start

```bash
# Install dependencies and start dev server
./init.sh

# Or manually:
npm install
npm run dev
```

Open http://localhost:5173 in Chrome or Edge (recommended for File System Access API).

## AI Chat Setup

To enable AI chat features, set your Anthropic API key:

```bash
cp .env.example .env
# Edit .env and add your VITE_ANTHROPIC_API_KEY
```

Get your API key at [console.anthropic.com](https://console.anthropic.com/).

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 19, TypeScript (strict), Vite 6 |
| **Canvas** | React Flow (@xyflow/react) v12 |
| **Layout** | elkjs (ELK layered layout) |
| **Styling** | Tailwind CSS 4 + shadcn/ui |
| **State** | Zustand |
| **Storage** | Protocol Buffers (.archc binary files) via protobufjs |
| **Validation** | Zod (API boundary validation) |
| **AI** | Anthropic Claude API (@anthropic-ai/sdk) |
| **MCP** | @modelcontextprotocol/sdk (stdio + SSE) |
| **Icons** | Lucide React |
| **IDs** | ULID |
| **Export** | html-to-image (PNG/SVG) |
| **Mobile** | Capacitor (iOS) |
| **Testing** | Vitest + React Testing Library + Playwright |

## Project Structure

```
archcanvas/
├── proto/                    # Protocol Buffer schema
│   └── archcanvas.proto
├── src/
│   ├── types/                # TypeScript type definitions
│   ├── core/
│   │   ├── storage/          # Binary codec, file I/O
│   │   ├── graph/            # Graph engine (CRUD, query, traversal)
│   │   ├── history/          # Undo/redo manager
│   │   ├── layout/           # ELK auto-layout
│   │   ├── registry/         # NodeDef registry + built-in YAML defs
│   │   ├── shortcuts/        # Configurable keyboard shortcuts
│   │   ├── input/            # Input handling, modifier keys
│   │   ├── platform/         # Platform detection (browser/iOS)
│   │   └── sync/             # File sync utilities
│   ├── api/                  # Text API, Render API, Export API
│   ├── mcp/                  # MCP server for AI agents
│   ├── ai/                   # AI client, context builder, suggestion parser
│   ├── analyze/              # Codebase analysis pipeline
│   │   └── prompts/          # AI prompt templates for analysis
│   ├── cli/                  # CLI tool (inspect, analyze, MCP server)
│   │   ├── commands/         # CLI subcommands
│   │   └── server/           # MCP server runner
│   ├── stacks/               # Built-in architecture template YAML files
│   ├── templates/            # Template registry and IndexedDB storage
│   ├── store/                # Zustand stores
│   ├── config/               # App configuration
│   ├── contexts/             # React contexts
│   ├── themes/               # Theme definitions
│   ├── components/
│   │   ├── canvas/           # Canvas, controls, breadcrumb, annotations
│   │   ├── nodes/            # Node type components
│   │   ├── edges/            # Edge type components
│   │   ├── panels/           # Side panels (details, AI chat)
│   │   ├── toolbar/          # Toolbar components
│   │   ├── settings/         # Settings panel
│   │   └── shared/           # Shared UI (dialogs, template gallery, etc.)
│   ├── hooks/                # Custom React hooks
│   └── utils/                # Utilities and constants
├── test/                     # Tests (unit, integration, e2e)
├── examples/                 # Example .archc files and generators
├── docs/                     # Additional documentation
│   └── ios-build-guide.md    # iOS build and release guide
└── ios/                      # Capacitor iOS project
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run lint` | Lint codebase |
| `npm run proto:generate` | Regenerate Protocol Buffer TypeScript types |
| `npm run cli` | Run the ArchCanvas CLI |
| `npm run build:cli` | Build CLI for distribution |
| `npm run dev:ios` | Run on iOS with live reload |
| `npm run build:ios` | Build web + sync to iOS |
| `npm run build:release` | Full production build + iOS sync |

## CLI

ArchCanvas includes a command-line tool for working with `.archc` files:

```bash
# Inspect an .archc file
npm run cli -- inspect path/to/file.archc

# Analyze a codebase and generate architecture
npm run cli -- analyze ./my-project --depth standard

# Start the MCP server
npm run cli -- mcp
```

See `npm run cli -- --help` for all available commands.

## Keyboard Shortcuts

### File Operations

| Shortcut | Action |
|----------|--------|
| Ctrl+N | New file |
| Ctrl+O | Open file |
| Ctrl+S | Save |
| Ctrl+Shift+S | Save As |

### Edit

| Shortcut | Action |
|----------|--------|
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl+Y | Redo (Alt) |
| Delete | Delete selected node(s) |
| Ctrl+D | Duplicate |
| F2 | Quick rename |
| Ctrl+A | Select all nodes |
| Ctrl+Shift+A | Select all edges |

### Canvas & Navigation

| Shortcut | Action |
|----------|--------|
| Escape | Deselect / close panel |
| Backspace | Zoom out to parent |
| Ctrl+K | Command palette |
| / | Quick search |
| ? | Shortcuts help |
| = | Zoom in |
| - | Zoom out |
| Ctrl+0 | Fit view |
| Ctrl+1 | Zoom to 100% |
| Arrow keys | Navigate between nodes |

### Quick Add Nodes

| Shortcut | Action |
|----------|--------|
| S | Add service |
| D | Add database |
| Q | Add queue |
| G | Add gateway |
| A | Add cache |

### Edge Operations

| Shortcut | Action |
|----------|--------|
| T | Cycle edge type |

> **Note:** On macOS, use Cmd instead of Ctrl. Shortcuts are customizable via the settings panel.

## File Format

ArchCanvas uses a custom binary format (`.archc`):

```
┌──────────────────────┐
│ Magic: "ARCHC\x00"   │  6 bytes
│ Format Version       │  2 bytes (uint16 big-endian)
│ Protobuf Payload     │  Variable length
│   └─ ArchCanvasFile  │
│       ├─ FileHeader   │  (version, timestamps, SHA-256 checksum)
│       ├─ Architecture │  (nodes, edges, metadata)
│       ├─ CanvasState  │  (viewport, selection, panel layout)
│       ├─ AIState      │  (conversations, suggestions)
│       └─ UndoHistory  │  (snapshots)
└──────────────────────┘
```

A `.summary.md` sidecar file is auto-generated alongside each `.archc` file for human-readable reference.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

MIT
