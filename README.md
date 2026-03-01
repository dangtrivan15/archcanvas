# ArchCanvas

A visual architecture design tool where software systems are represented as typed, composable, code-bound graph nodes on an interactive canvas. The `.archc` binary file (Protocol Buffers) is the single source of truth, and AI and humans interact through the same Text API.

## Quick Start

```bash
# Install dependencies and start dev server
./init.sh

# Or manually:
npm install
npm run dev
```

Open http://localhost:5173 in Chrome or Edge (recommended for File System Access API).

## Technology Stack

- **Frontend**: React 19, Vite 6, TypeScript (strict)
- **Canvas**: React Flow (@xyflow/react) v12
- **Layout**: elkjs (ELK layered layout)
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **State**: Zustand
- **Storage**: Protocol Buffers (.archc binary files)
- **AI**: Anthropic Claude API
- **MCP**: Model Context Protocol server for AI agent integration
- **Testing**: Vitest + React Testing Library + Playwright

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
│   │   └── registry/         # NodeDef registry + built-in YAML defs
│   ├── api/                  # Text API, Render API, Export API
│   ├── mcp/                  # MCP server for AI agents
│   ├── ai/                   # AI client, context builder, suggestion parser
│   ├── store/                # Zustand stores
│   ├── components/           # React components
│   │   ├── canvas/           # Canvas, controls, breadcrumb
│   │   ├── nodes/            # Node type components
│   │   ├── edges/            # Edge type components
│   │   ├── panels/           # Side panels
│   │   ├── toolbar/          # Toolbar components
│   │   └── shared/           # Shared UI components
│   ├── hooks/                # Custom React hooks
│   └── utils/                # Utilities and constants
├── test/                     # Tests (unit, integration, e2e)
└── examples/                 # Example .archc files
```

## AI Chat Setup

To enable AI chat features, set your Anthropic API key:

```bash
cp .env.example .env
# Edit .env and add your VITE_ANTHROPIC_API_KEY
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run lint` | Lint codebase |
| `npm run proto:generate` | Regenerate proto TypeScript types |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+S | Save |
| Ctrl+Shift+S | Save As |
| Ctrl+O | Open |
| Ctrl+N | New |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Delete | Delete selected |
| Ctrl+Shift+L | Auto-layout |
| Escape | Deselect/close/exit |
| Enter | Zoom into selected node |
| Backspace | Zoom out |
| Ctrl+F | Search architecture |
| Ctrl+/ | Toggle AI chat |
