# ArchCanvas vs Mermaid

> **Purpose**: Internal positioning analysis. Why ArchCanvas exists alongside Mermaid, where they overlap, and why they serve fundamentally different needs.

## The Direction of Flow

This is the fundamental difference. Every other distinction (format, features, audience) follows from it.

**Mermaid flows backward**: code exists first → someone writes a diagram to document it. The diagram trails reality. When the code changes and nobody updates the Mermaid file, the diagram rots. This is the default state of every documentation-first tool.

```
Code (source of truth) → Mermaid diagram (documentation) → Reader
```

**ArchCanvas flows forward**: the architecture comes first as the design artifact → AI implements code from it. The diagram _leads_ reality. It doesn't rot because it's not documenting something else — it _is_ the thing.

```
ArchCanvas diagram (source of truth) → AI → Code (implementation)
```

Most diagramming tools — Mermaid, Lucidchart, draw.io, even Structurizr — assume the diagram is **output**. A downstream artifact that describes something that already exists. ArchCanvas assumes the diagram is **input**. The upstream artifact that drives what gets built.

This isn't just a feature difference. It's a product thesis: in the AI era, the bottleneck isn't writing code — it's designing the right system. The person who designs the architecture should be able to express it visually and hand it to AI for implementation. That requires the diagram to carry enough semantic richness that AI can act on it — not just render a picture, but understand types, protocols, data flow, and code targets.

That requirement is what makes Mermaid's format insufficient and ArchCanvas's format necessary.

## Overview

Mermaid is a text-based diagramming tool where you write a custom DSL and it renders static SVGs. It's embedded everywhere — GitHub, Notion, Confluence, VS Code, Obsidian. For putting a quick diagram in a README, it's excellent.

ArchCanvas is a visual architecture design environment backed by structured YAML files. You interact with an interactive canvas; YAML is the serialization format, not the authoring surface. AI reads the structured data and implements code from it.

**They solve different problems.** Mermaid answers "how do I show a picture of my system?" ArchCanvas answers "how do I design my system and have AI build it?"

## Format Comparison

### Mermaid DSL

Mermaid uses a custom DSL optimized for concise hand-typing:

```
graph TD
    OrderService -->|HTTP| Database
    OrderService -->|Kafka| MessageQueue
    OrderService -->|gRPC| UserService
```

5 lines. You can see the topology at a glance. For a quick sketch, this is hard to beat.

### ArchCanvas YAML

ArchCanvas uses structured YAML with typed schemas (see [docs/archcanvas-v2-design.md#4-data-model--file-format](../archcanvas-v2-design.md#4-data-model--file-format) for the full format spec):

```yaml
nodes:
  - id: svc-order-service
    type: compute/service
    displayName: Order Service
    args:
      language: TypeScript
      framework: Express
      replicas: 2
    codeRefs:
      - path: src/services/order/
        role: source

edges:
  - from: { node: svc-order-service, port: http-out }
    to: { node: db-postgres, port: query-in }
    protocol: SQL
    label: persist orders
    entities: [Order]
```

15 lines for one node and one edge. More verbose — but carries far more information.

### Why the verbosity matters

The conciseness gap disappears when you ask: **who is writing this, and who is reading it?**

| Concern | Mermaid | ArchCanvas YAML |
|---------|---------|-----------------|
| **Primary writer** | Human in a text editor | Visual canvas (drag, connect, fill panels) |
| **Primary reader** | Human scanning a README | AI implementing code from the architecture |
| **The user types...** | DSL syntax | Nothing — interacts with canvas UI |
| **The user reads...** | The rendered diagram | The rendered canvas |

Mermaid's format is optimized for human authoring speed. ArchCanvas's format is optimized for machine processing and semantic richness. The user never writes YAML directly — just like a Figma user never writes `.fig` binary. The difference is that ArchCanvas's serialization format happens to be human-readable YAML, which produces clean git diffs. Strictly better than a binary blob.

## Semantic Richness

This is where the comparison breaks down entirely. Mermaid's `OrderService -->|HTTP| Database` is a labeled arrow between two strings. ArchCanvas knows:

| Dimension | Mermaid | ArchCanvas |
|-----------|---------|------------|
| **Node identity** | A string label | Typed node (`compute/service`) with schema-validated args |
| **Node properties** | None | `language`, `framework`, `replicas`, arbitrary typed args from NodeDef |
| **Connection points** | Implicit (node-to-node) | Explicit ports with direction and protocol constraints |
| **Protocol** | A text label on an arrow | Validated protocol with compatibility checking |
| **Data flow** | Not expressible | Entities (`Order`, `User`) as first-class objects on edges |
| **Code references** | Not expressible | `codeRefs` linking to source directories with roles |
| **Nesting** | `subgraph` (flat visual grouping) | Recursive canvas nesting — dive into any node to see internals |
| **AI hints** | None | Per-NodeDef `ai.context` and `reviewHints` injected into prompts |

An AI agent can't generate an Express service from a box labeled "Order Service." It _can_ generate one from a typed node with `language: TypeScript`, `framework: Express`, port specs defining the API surface, and code refs pointing to the target directory.

This semantic richness is what makes the "diagram is the spec" vision possible (see [docs/archcanvas-v2-design.md#1-product-vision](../archcanvas-v2-design.md#1-product-vision)).

## Technical Trade-offs

### Parsing and tooling

| Aspect | Mermaid DSL | YAML |
|--------|-------------|------|
| **Parser availability** | Custom parser (~5k lines in Mermaid's codebase) | Standard library in every language |
| **Schema validation** | None — errors surface at render time | Zod validates at every boundary ([src/types/schema.ts](../../src/types/schema.ts)) |
| **IDE support** | Syntax highlighting only | Autocomplete, linting, hover docs via JSON Schema |
| **Extensibility** | Fork the grammar to add new diagram types | Add a field to the YAML schema |
| **Git diffs** | Readable, but reordering lines changes layout → noisy diffs | Readable, structure is stable regardless of order |

### Why YAML over other structured formats

YAML was chosen over JSON, TOML, and custom DSLs for specific reasons:

- **Human-readable when you need it** — git diffs, PR reviews, debugging
- **Comments** — JSON doesn't support them; they matter for architecture notes
- **Less noisy than JSON** — no required quotes on keys, no trailing commas
- **Industry standard for infrastructure** — architects already read YAML (Kubernetes, Docker Compose, GitHub Actions, Terraform HCL is similar)
- **Standard parsers** — no custom grammar to maintain, unlike Mermaid or a custom DSL

**Why not a custom DSL like Mermaid's?** A terse DSL optimized for hand-typing is the wrong trade-off when the primary writer is a visual editor and the primary reader is AI. The parsing complexity alone (Mermaid's parser is substantial) would be pure cost with no benefit — nobody is typing ArchCanvas files by hand.

## Where Mermaid Wins

Being honest about Mermaid's strengths:

- **Zero friction** — write text in any markdown file, GitHub renders it inline. No app to install, no setup.
- **Ubiquitous** — embedded in GitHub, Notion, Confluence, VS Code, Obsidian, Docusaurus, and dozens more.
- **Good enough for documentation** — if all you need is a static picture in a README to explain a system to a new team member, Mermaid is perfect for the job.
- **Broad diagram types** — flowcharts, sequence diagrams, ER diagrams, Gantt charts, state machines. ArchCanvas only does architecture graphs.
- **MIT licensed, massive community** — years of ecosystem momentum.

## Where ArchCanvas Wins

- **Interactive design surface** — not a rendering tool, but a design environment with pan, zoom, drag, connect, edit-in-place.
- **Semantic architecture model** — typed nodes, validated protocols, entities, cross-scope references. The data model has meaning beyond visual layout.
- **AI-native** — AI reads structured architecture and generates code from it. The diagram drives implementation, not the other way around.
- **Infinite nesting** — dive into any node to see its internals, recursively. Real architectures have depth; flat diagrams can't express it.
- **Extensible type system** — 40+ built-in NodeDefs, project-local custom types, community catalog. Not just boxes and arrows.

## Relationship: Complement, Not Compete

ArchCanvas and Mermaid serve different stages of the architecture lifecycle:

| Stage | Tool | Why |
|-------|------|-----|
| **Design** — designing the actual system, making architectural decisions | ArchCanvas | Needs semantic richness, AI integration, interactive editing |
| **Documentation** — explaining the system in a README or wiki | Mermaid | Needs zero-friction embedding, ubiquitous rendering |
| **Review** — reviewing architecture changes in a PR | ArchCanvas (YAML diffs) + Mermaid (visual summary) | YAML diffs show what changed; Mermaid can render a quick before/after |

The v2 roadmap includes **export to Mermaid** as a feature — design in ArchCanvas (rich, interactive, AI-readable), share as Mermaid (lightweight, embeddable, universally rendered). This makes the relationship explicit: ArchCanvas is the source of truth, Mermaid is a distribution format.

## Summary

| Dimension | Mermaid | ArchCanvas |
|-----------|---------|------------|
| **Direction of flow** | Code → diagram (documentation) | Diagram → code (design drives implementation) |
| **What it is** | Rendering format | Design environment |
| **Paradigm** | Text → static image | Interactive canvas → structured YAML |
| **Data model** | Labels and arrows | Typed nodes, ports, protocols, entities, code refs |
| **AI story** | AI can _generate_ Mermaid syntax | AI _reads architecture and implements code_ |
| **Nesting** | Flat (visual subgraphs) | Recursive (semantic subsystems) |
| **Target user** | Anyone needing a diagram | Architects and senior engineers designing systems |
| **Sweet spot** | Documentation | Design and implementation |
