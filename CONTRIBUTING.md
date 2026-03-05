# Contributing to ArchCanvas

Thank you for your interest in contributing to ArchCanvas! This guide covers the development setup, project conventions, and contribution workflow.

## Prerequisites

- **Node.js 20+** and **npm 10+**
- **Chrome or Edge** (recommended for File System Access API)
- **Git**

For iOS development, see [docs/ios-build-guide.md](docs/ios-build-guide.md).

## Getting Started

```bash
# Clone the repository
git clone <repo-url>
cd archcanvas

# Install dependencies and start dev server
./init.sh

# Or manually:
npm install
npm run dev
```

The app will be available at http://localhost:5173.

## Development Workflow

### Running Tests

```bash
# Unit tests (Vitest)
npm run test

# Unit tests in watch mode
npm run test:watch

# End-to-end tests (Playwright)
npm run test:e2e
```

### Linting

```bash
npm run lint
```

### Building

```bash
# Production build
npm run build

# Preview production build
npm run preview
```

## Project Architecture

ArchCanvas follows a layered architecture with clear separation of concerns:

### Core Layer (`src/core/`)

Pure logic with no React dependencies:

- **storage/** - Binary codec for `.archc` files (Protocol Buffers)
- **graph/** - Graph engine with CRUD, query, and traversal operations
- **history/** - Undo/redo manager with architecture snapshots
- **layout/** - ELK-based auto-layout computation
- **registry/** - NodeDef registry loading YAML node type definitions
- **shortcuts/** - Configurable keyboard shortcut manager

### API Layer (`src/api/`)

Three internal APIs that mediate all data access:

- **Text API** - Read/write architecture data (used by both UI and AI)
- **Render API** - Convert graph data to React Flow nodes/edges
- **Export API** - Generate Markdown, Mermaid, PNG, SVG exports

### UI Layer (`src/components/`, `src/store/`, `src/hooks/`)

React components, Zustand stores, and custom hooks.

### AI Layer (`src/ai/`, `src/mcp/`)

- **ai/** - Claude API client, context builder, suggestion parser
- **mcp/** - MCP server implementation (stdio + SSE transports)

### Analysis Layer (`src/analyze/`)

Codebase analysis pipeline: scan, detect, infer, build graph.

### CLI (`src/cli/`)

Command-line tool built with Commander.js for file inspection, analysis, and MCP server.

## Key Conventions

### TypeScript

- Strict mode enabled (`tsconfig.json`)
- Use Zod schemas for runtime validation at API boundaries
- Prefer interfaces over type aliases for object shapes

### State Management

- Global app state in Zustand stores (`src/store/`)
- Core engine state is plain TypeScript (no React dependency)
- UI state (dialogs, panels, selection) in `uiStore`

### File Format

- All architecture data persists in `.archc` binary files
- Protocol Buffer schema defined in `proto/archcanvas.proto`
- After modifying the schema, regenerate types: `npm run proto:generate`

### Node Types

Node types are defined as YAML files in `src/core/registry/nodedefs/`. Each file defines:

- Type name and namespace
- Display properties (icon, color)
- Typed arguments (ports, properties)
- Allowed children and edges

### Testing

- **Unit tests** (`test/unit/`): Test core logic, API functions, utilities
- **Integration tests** (`test/integration/`): Test component interactions
- **E2E tests** (`test/e2e/`): Test full user workflows via Playwright
- Test files follow the pattern `*.test.ts` or `*.test.tsx`

### Styling

- Tailwind CSS 4 for utility classes
- shadcn/ui for pre-built components
- Component-specific styles use Tailwind classes directly

## Adding a New Node Type

1. Create a YAML file in `src/core/registry/nodedefs/`
2. Define the type schema following existing examples
3. The registry auto-loads all YAML files in that directory
4. Add an icon mapping if using a custom icon

## Commit Messages

Use conventional commit format:

```
feat: add new feature description
fix: resolve specific bug
docs: update documentation
test: add or update tests
refactor: code restructuring without behavior change
```

## Questions?

Open an issue for bugs, feature requests, or questions about the codebase.
