# ArchCanvas Landing Page — Design Spec

> **Status**: Approved
> **Date**: 2026-03-22
> **Audience**: Implementors

---

## 1. Purpose

A product marketing landing page for ArchCanvas with a Mac desktop app download CTA. First piece of a future commercial site that will include docs, web app, and auth/billing.

## 2. Technical Approach

### Separate Vite + React project

- Lives in `landing/` directory within the monorepo
- Own `package.json`, own build, own deploy
- Same tech stack as the main app: **Vite 7, React 19, Tailwind 4, TypeScript**
- Shared design DNA: **Motion (`motion` package), Animate UI (copy-pasted primitives, not an npm dep), Radix UI, Lucide icons**
- Static output — deployed as an nginx container on the user's K8s cluster (or any static host)

### Why separate

- Different deploy cadence from the app
- No risk of breaking the main build
- Future integration path: extract shared components to a monorepo package when docs/auth are added

## 3. Visual Direction

**Warm Rosé Pine** — uses ArchCanvas's brand colors from the favicon:

| Token | Color | Usage |
|-------|-------|-------|
| Purple | `#907aa9` | Accent text, badges, node borders |
| Gold | `#ea9d34` | AI elements, data store borders |
| Teal | `#56949f` | Service borders, secondary accent |
| Dark teal | `#286983` | Messaging/notification elements |
| Rose | `#d7827e` | Cache/Redis borders |
| Cream bg | `#faf4ed` | Primary background |
| Warm cream | `#f2e9e1` | Section alternate background |
| Dark purple | `#575279` | Primary text, buttons, CTA background |
| Muted | `#797593` | Secondary text |

### Dot grid background

A continuous dot grid (`radial-gradient`, `r=1.15`, 20px spacing) applied to `<body>` so it tiles seamlessly across all sections with zero seams between sections. Sections with colored backgrounds use semi-transparent values so dots bleed through:

- Sections 1, 2, 4: transparent — body dots show directly
- Section 3 (How it works): `rgba(242,233,225,0.55)` — warm cream tint, dots visible
- Section 5 (CTA): `rgba(87,82,121,0.82)` — dark purple, dots subtly visible
- Footer: opaque `#3e3859`

**Implementation**: CSS `radial-gradient` on `<body>` (not SVG patterns). The hero text-readability fade is an absolutely-positioned `<div>` or `<svg>` with a CSS `radial-gradient` overlay inside the hero section, not a separate dot pattern.

### Typography

- **Font**: Inter (matches the app)
- **Hero title**: 40px, weight 800, tight letter-spacing
- **Section titles**: 30px, weight 800
- **Body**: 14-16px, weight 400

## 4. Page Sections

### Navigation Bar

- **Position**: Static (scrolls with page, not sticky)
- **Layout**: Logo left, links + CTA right
- **Links**: Features (anchor scroll), Docs (placeholder, links to `#`), GitHub (external link to repo)
- **CTA**: "Download for Mac" button (same destination as hero CTA)
- **Mobile (<768px)**: Collapse to hamburger menu
- **Links that don't exist yet** (Docs): render as normal links, will be updated when docs site launches

### CTA Destinations

- **Download for Mac**: Links to GitHub Releases page (TBD: direct `.dmg` download URL when available)
- **Watch demo**: Opens a modal/lightbox with the demo video (the same video from the README). Fallback: link to the GitHub-hosted video URL.
- **Star on GitHub**: External link to the GitHub repo

### Section 1: Hero

**Layout**: Split — text left (38%), floating architecture diagram right (62%)

**Left side**:
- Badge: "AI-native architecture tool"
- Title: "You design the architecture." + "AI writes the code." (purple accent)
- Subtitle: "The diagram is the spec..."
- CTAs: "Download for Mac" (primary), "Watch demo" (secondary)
- Radial gradient fade clears the dot grid behind text for readability

**Right side**:
- SVG architecture diagram floating on the dot grid with drop shadows
- 3-tier layout: API Gateway → Services (Notification, Order, User) → Data (Kafka, PostgreSQL, Redis)
- Edge labels (REST, gRPC, SQL, async), dashed lines for async connections
- Breadcrumb: root › main › e-commerce
- AI chat bubble (bottom-right): "Added Order Service with gRPC connection to API Gateway"
- On the real page: staggered node fade-in and edge draw animations via Motion/Animate UI

### Section 2: Features ("Why ArchCanvas")

**Layout**: Centered header + 2x2 card grid

**Header**:
- Badge: "Why ArchCanvas"
- Title: "Architecture tools weren't built for the AI era."
- Subtitle: "Most diagrams rot in Figma or Miro..."

**Cards** (white, rounded, subtle shadow):

| # | Feature | Icon gradient | Description |
|---|---------|--------------|-------------|
| 1 | AI reads your architecture | Gold→light gold | Diagram drives code, not vague text prompts |
| 2 | Infinite depth | Teal→light teal | Nestable subsystems, dive in/zoom out |
| 3 | Git-native YAML | Purple→light purple | `.archcanvas/` committed with code, PR diffs |
| 4 | 40+ built-in types | Dark teal→teal | 9 namespaces, custom types, community sharing |

### Section 3: How It Works

**Layout**: Horizontal 3-step flow with connecting arrows
**Background**: Semi-transparent warm cream (`rgba(242,233,225,0.55)`)

| Step | Color | Illustration | Title | Description |
|------|-------|-------------|-------|-------------|
| 1 | Purple | Mini canvas with nodes and edges | Design | Draw your system on the canvas |
| 2 | Teal | YAML code snippet (syntax highlighted) | Commit | YAML files go into git, review in PRs |
| 3 | Gold | AI chat bubble with progress bar | Generate | AI reads architecture, writes code |

**Alignment**: Steps use flexbox with `align-items: stretch` and `flex: 1` on illustration cards so titles and descriptions align horizontally regardless of illustration content height.

### Section 4: Tech Strip ("Built with")

**Layout**: Centered label + horizontal logo row
**Borders**: Top and bottom `1px solid #e8e0d8`

**Logos** (monochrome, 0.45 opacity): React 19, TypeScript, Tailwind 4, Tauri 2.0, Claude SDK, YAML, Git-native

### Section 5: CTA

**Layout**: Centered content on dark background
**Background**: Semi-transparent dark purple (`rgba(87,82,121,0.82)`)

- Logo icon (gradient purple→teal, rounded, shadow)
- Title: "Ready to design your next architecture?"
- Subtitle: "Download ArchCanvas for Mac. Free for individual use..."
- CTAs: "Download for Mac" (cream on dark), "Star on GitHub" (ghost button)
- Version tag: "v0.1.0 · macOS 13+ · Apple Silicon & Intel"

### Footer

**Background**: `#3e3859` (darker purple, opaque)
**Layout**: Logo + copyright left, links right (GitHub, Docs, Releases, License)

## 5. Animations (Motion / Animate UI)

- **Hero nodes**: Staggered fade-in on load (150ms delay between nodes)
- **Hero edges**: Draw animation (stroke-dashoffset) after nodes appear
- **AI chat bubble**: Slide-in from bottom-right after edges complete
- **Feature cards**: Fade-in on scroll (IntersectionObserver)
- **How it works steps**: Sequential reveal on scroll
- **Tech logos**: Subtle fade-in on scroll
- **CTA**: Fade-in on scroll
- All animations respect `prefers-reduced-motion`

## 6. Responsive Behavior

- **Desktop (1024px+)**: Full layout as designed
- **Tablet (768-1023px)**: Hero stacks vertically (text above diagram), diagram has `min-height: 300px` to stay legible, features remain 2x2
- **Mobile (<768px)**: Single column throughout, hero diagram hidden (text + CTAs only), features stack 1x1, steps stack vertically, AI chat bubble hidden

### SEO & Social

- `<title>`, `<meta name="description">`, and Open Graph tags (og:title, og:description, og:image) must be set. OG image TBD (can be a screenshot of the hero diagram).
- Footer links to Docs render as normal links even though the docs site doesn't exist yet — will be updated when it launches.

## 7. Future Integration Path

This landing page is the first surface of a commercial product site:

| Phase | Surface | URL |
|-------|---------|-----|
| Now | Landing page | `archcanvas.com` |
| Next | Documentation | `docs.archcanvas.com` |
| Later | Web app | `app.archcanvas.com` |
| Later | Auth + billing | Part of the web app (Clerk/Auth0 + Stripe) |

When more surfaces are added, shared components (header, footer, auth UI) can be extracted to a monorepo shared package. The landing page's tech stack (Vite + React + Tailwind 4) was chosen specifically to enable this.

## 8. Reference

- **Full-page mockup**: `.superpowers/brainstorm/88969-1774191190/full-page-v2.html`
- **Hero iterations**: `hero-combo.html`, `hero-combo-v2.html`, `hero-combo-v3.html`
- **Individual sections**: `features-section.html`, `how-it-works.html`, `tech-strip.html`, `cta-footer.html`
