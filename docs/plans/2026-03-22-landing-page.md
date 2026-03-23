# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static marketing landing page for ArchCanvas in a separate `landing/` sub-project, with Mac desktop download CTA and motion animations.

**Architecture:** Independent Vite + React project in `landing/` — own `package.json`, own build, own deploy. Single-page with anchor scroll navigation. Static HTML output for any static host. Same tech stack as main app for future shared-component extraction.

**Tech Stack:** Vite 7, React 19, Tailwind 4 (CSS-based `@theme`), TypeScript 5.9, Motion (`motion/react`), Radix UI Dialog, Lucide React icons

---

**Spec:** `docs/specs/2026-03-22-landing-page-design.md`
**Visual reference:** `.superpowers/brainstorm/88969-1774191190/full-page-v2.html`
**Section mockups:** `.superpowers/brainstorm/88969-1774191190/` — `hero-combo-v3.html`, `features-section.html`, `how-it-works.html`, `tech-strip.html`, `cta-footer.html`

**Conscious decisions:**
- **No unit tests** for static visual components — there is no business logic to unit test. Verification is `npm run build` (TypeScript catches errors) + visual inspection via dev server. A Playwright smoke test is added in Task 8.
- **No Zustand, no router** — static single-page with anchor scroll
- **Variable Inter font** — download `InterVariable.woff2` (~300KB) to support weight 800 for titles. Main app uses static instances (400/500/600), but landing needs 800. Single variable font file is simpler than managing 5 static files.
- **Copy font files** (not symlink) for deploy independence
- **All content strings inline** — no i18n, no CMS, matches spec's static nature
- **Radix Dialog for video modal** — matches shared design DNA from spec
- **No `class-variance-authority`** — landing page has simple button variants; plain conditional classes are sufficient

## File Structure

```
landing/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── public/
│   └── fonts/
│       ├── inter/
│       │   └── InterVariable.woff2
│       └── monaspace-argon/
│           └── MonaspaceArgon-Regular.woff2
├── src/
│   ├── main.tsx                    # React mount
│   ├── index.css                   # Tailwind 4, @theme tokens, @font-face, dot grid
│   ├── App.tsx                     # Section composition, feature anchor id
│   ├── constants.ts                # Shared URLs (GitHub repo, releases, demo video)
│   ├── components/
│   │   ├── Navbar.tsx              # Static nav, mobile hamburger, CTA
│   │   ├── MobileMenu.tsx          # Hamburger slide-out overlay
│   │   ├── Hero.tsx                # Split layout: text left, diagram right
│   │   ├── HeroDiagram.tsx         # SVG architecture diagram with nodes/edges
│   │   ├── Features.tsx            # 2x2 card grid with gradient icons
│   │   ├── HowItWorks.tsx          # 3-step horizontal flow with arrows
│   │   ├── TechStrip.tsx           # Monochrome logo row
│   │   ├── CtaSection.tsx          # Final CTA on dark background
│   │   ├── Footer.tsx              # Dark footer with links
│   │   └── VideoModal.tsx          # Demo video lightbox (Radix Dialog)
│   └── hooks/
│       └── useScrollReveal.ts      # IntersectionObserver + motion animation trigger
└── test/
    └── e2e/
        ├── playwright.config.ts
        └── landing.spec.ts         # Smoke test: sections render, interactions work
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `landing/package.json`
- Create: `landing/vite.config.ts`
- Create: `landing/tsconfig.json`
- Create: `landing/index.html`
- Create: `landing/src/main.tsx`
- Create: `landing/src/App.tsx`
- Create: `landing/src/index.css`
- Copy: `landing/public/fonts/monaspace-argon/MonaspaceArgon-Regular.woff2`
- Download: `landing/public/fonts/inter/InterVariable.woff2`

- [ ] **Step 1: Create `landing/package.json`**

```json
{
  "name": "archcanvas-landing",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "motion": "^12.38.0",
    "lucide-react": "^0.511.0",
    "@radix-ui/react-dialog": "^1.1.7"
  },
  "devDependencies": {
    "vite": "^7.0.0",
    "@vitejs/plugin-react": "^4.4.1",
    "@tailwindcss/vite": "^4.1.3",
    "tailwindcss": "^4.1.3",
    "typescript": "^5.9.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

- [ ] **Step 2: Create `landing/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
  },
});
```

- [ ] **Step 3: Create `landing/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 4: Create `landing/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ArchCanvas — AI-Native Architecture Tool</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `landing/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 6: Create `landing/src/App.tsx`**

Placeholder shell — sections will be added in later tasks.

```tsx
export function App() {
  return (
    <div className="min-h-screen">
      <main>
        <section id="hero" className="py-20 text-center">
          <h1 className="text-4xl font-extrabold text-dark-purple">ArchCanvas</h1>
          <p className="mt-4 text-muted">Landing page scaffold — sections coming soon</p>
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 7: Create `landing/src/index.css`**

This sets up Tailwind 4, all Rosé Pine color tokens from the spec, font loading, and the body dot grid.

```css
@import "tailwindcss";

/* --- Variable Inter font (supports weights 100-900) --- */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url('/fonts/inter/InterVariable.woff2') format('woff2');
}

/* --- Monaspace Argon for code snippets --- */
@font-face {
  font-family: 'Monaspace Argon';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/monaspace-argon/MonaspaceArgon-Regular.woff2') format('woff2');
}

/* --- Tailwind 4 theme tokens (Rosé Pine palette from spec) --- */
@theme {
  --color-cream: #faf4ed;
  --color-warm-cream: #f2e9e1;
  --color-purple: #907aa9;
  --color-dark-purple: #575279;
  --color-gold: #ea9d34;
  --color-teal: #56949f;
  --color-dark-teal: #286983;
  --color-rose: #d7827e;
  --color-muted: #797593;
  --color-border: #dfdad9;
  --color-footer-bg: #3e3859;
  --color-footer-text: #c4b8b0;
  --color-footer-muted: #7e7590;
  --color-footer-link: #9e8fa0;

  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'Monaspace Argon', ui-monospace, monospace;
}

/* --- Body: cream background with continuous dot grid --- */
body {
  background-color: var(--color-cream);
  background-image: radial-gradient(
    circle,
    rgba(87, 82, 121, 0.15) 1.15px,
    transparent 1.15px
  );
  background-size: 20px 20px;
  color: var(--color-dark-purple);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

- [ ] **Step 8: Copy font files**

```bash
# From the repo root:
mkdir -p landing/public/fonts/inter landing/public/fonts/monaspace-argon

# Copy Monaspace Argon from main app
cp public/fonts/monaspace-argon/MonaspaceArgon-Regular.woff2 \
   landing/public/fonts/monaspace-argon/

# Download Inter variable font from the Inter GitHub releases
# Go to https://github.com/rsms/inter/releases — download the latest release zip,
# extract InterVariable.woff2, and place it at:
#   landing/public/fonts/inter/InterVariable.woff2
```

- [ ] **Step 9: Copy favicon**

Copy the favicon from the main app's `public/` directory:

```bash
cp public/favicon.svg landing/public/favicon.svg
```

- [ ] **Step 10: Install dependencies and verify build**

```bash
cd landing && npm install && npm run build
```

Expected: Build succeeds, `landing/dist/` contains `index.html` + JS/CSS assets.

- [ ] **Step 11: Verify dev server**

```bash
cd landing && npm run dev
```

Expected: Dev server starts, page shows "ArchCanvas" heading on cream dot-grid background with Inter font.

- [ ] **Step 12: Commit**

```bash
git add landing/
git commit -m "feat(landing): scaffold Vite + React + Tailwind 4 project

Separate landing page sub-project with Rosé Pine tokens, Inter variable
font, dot grid background, and build pipeline."
```

---

### Task 2: Navbar

**Files:**
- Create: `landing/src/constants.ts`
- Create: `landing/src/components/Navbar.tsx`
- Create: `landing/src/components/MobileMenu.tsx`
- Modify: `landing/src/App.tsx`

**Context (read but don't modify):**
- `docs/specs/2026-03-22-landing-page-design.md` — Navigation Bar section
- `.superpowers/brainstorm/88969-1774191190/full-page-v2.html:105-116` — nav HTML

- [ ] **Step 1: Create `landing/src/constants.ts`**

Shared URLs and nav links used by Navbar, MobileMenu, Hero, CTA, and Footer.

```typescript
export const GITHUB_REPO = 'https://github.com/anthropics/archcanvas';
export const GITHUB_RELEASES = 'https://github.com/anthropics/archcanvas/releases';
export const DEMO_VIDEO_URL =
  'https://github.com/anthropics/archcanvas/raw/main/docs/demo.mp4';

export const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Docs', href: '#' },
  { label: 'GitHub', href: GITHUB_REPO, external: true },
] as const;
```

- [ ] **Step 2: Create `landing/src/components/Navbar.tsx`**

```tsx
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { MobileMenu } from './MobileMenu';
import { GITHUB_RELEASES, NAV_LINKS } from '../constants';

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="flex items-center justify-between px-14 py-7 max-w-[1280px] mx-auto">
      {/* Logo */}
      <a href="/" className="flex items-center gap-2.5">
        <div className="w-[26px] h-[26px] rounded-[7px] bg-linear-to-br from-purple to-teal" />
        <span className="text-dark-purple text-[17px] font-bold tracking-tight">
          ArchCanvas
        </span>
      </a>

      {/* Desktop links */}
      <div className="hidden md:flex items-center gap-6">
        {NAV_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            {...('external' in link ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="text-muted text-[13px] font-medium hover:text-dark-purple transition-colors"
          >
            {link.label}
          </a>
        ))}
        <a
          href={GITHUB_RELEASES}
          className="bg-dark-purple text-cream px-[18px] py-[7px] rounded-lg text-[13px] font-semibold hover:opacity-90 transition-opacity"
        >
          Download for Mac
        </a>
      </div>

      {/* Mobile hamburger */}
      <button
        className="md:hidden p-2 text-dark-purple"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={24} />
      </button>

      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </nav>
  );
}
```

- [ ] **Step 3: Create `landing/src/components/MobileMenu.tsx`**

```tsx
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { GITHUB_RELEASES, NAV_LINKS } from '../constants';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

export function MobileMenu({ open, onClose }: MobileMenuProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 bg-cream flex flex-col px-14 py-7"
          initial={{ opacity: 0, x: '100%' }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        >
          <div className="flex items-center justify-between mb-12">
            <a href="/" className="flex items-center gap-2.5">
              <div className="w-[26px] h-[26px] rounded-[7px] bg-linear-to-br from-purple to-teal" />
              <span className="text-dark-purple text-[17px] font-bold tracking-tight">
                ArchCanvas
              </span>
            </a>
            <button onClick={onClose} className="p-2 text-dark-purple" aria-label="Close menu">
              <X size={24} />
            </button>
          </div>

          <div className="flex flex-col gap-6">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={onClose}
                {...('external' in link ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="text-dark-purple text-lg font-medium"
              >
                {link.label}
              </a>
            ))}
            <a
              href={GITHUB_RELEASES}
              className="bg-dark-purple text-cream px-6 py-3 rounded-lg text-sm font-semibold text-center mt-4"
            >
              Download for Mac
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 4: Wire Navbar into App.tsx**

Replace `landing/src/App.tsx`:

```tsx
import { Navbar } from './components/Navbar';

export function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <section id="hero" className="py-20 text-center">
          <h1 className="text-4xl font-extrabold text-dark-purple">Hero section placeholder</h1>
        </section>
        <section id="features" className="py-20 text-center">
          <h2 className="text-3xl font-extrabold text-dark-purple">Features placeholder</h2>
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Verify**

```bash
cd landing && npm run dev
```

Expected: Navbar renders with logo, links, CTA button. At `<768px`, links collapse to hamburger. Click hamburger opens slide-out menu. Click "Features" scrolls to `#features`.

- [ ] **Step 6: Commit**

```bash
git add landing/src/constants.ts landing/src/components/Navbar.tsx \
       landing/src/components/MobileMenu.tsx landing/src/App.tsx
git commit -m "feat(landing): add navbar with mobile hamburger menu

Shared constants for URLs. Desktop: logo + links + CTA. Mobile (<768px):
hamburger with slide-out overlay using motion spring animation."
```

---

### Task 3: Hero Section

**Files:**
- Create: `landing/src/components/Hero.tsx`
- Create: `landing/src/components/HeroDiagram.tsx`
- Create: `landing/src/components/VideoModal.tsx`
- Modify: `landing/src/App.tsx`

**Context (read but don't modify):**
- `docs/specs/2026-03-22-landing-page-design.md` — Section 1: Hero
- `.superpowers/brainstorm/88969-1774191190/full-page-v2.html:91-231` — hero HTML + SVG

- [ ] **Step 1: Create `landing/src/components/VideoModal.tsx`**

```tsx
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { DEMO_VIDEO_URL } from '../constants';

interface VideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VideoModal({ open, onOpenChange }: VideoModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="relative w-full max-w-4xl bg-dark-purple rounded-2xl overflow-hidden shadow-2xl">
                  <Dialog.Close className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-white/10 text-cream hover:bg-white/20 transition-colors">
                    <X size={18} />
                  </Dialog.Close>
                  <video
                    src={DEMO_VIDEO_URL}
                    controls
                    autoPlay
                    className="w-full aspect-video"
                  />
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
```

- [ ] **Step 2: Create `landing/src/components/HeroDiagram.tsx`**

This is the SVG architecture diagram with nodes, edges, edge labels, breadcrumb, and AI chat bubble. Coordinates match the full-page-v2 mockup.

```tsx
export function HeroDiagram() {
  return (
    <div className="relative flex-1">
      <svg
        width="100%"
        height="400"
        viewBox="0 0 580 370"
        className="block"
        aria-label="Architecture diagram showing an e-commerce system"
      >
        {/* --- Edges (behind nodes) --- */}
        <path d="M200,70 L115,120" stroke="#907aa9" strokeWidth="1.6" fill="none" opacity="0.3" strokeDasharray="6 3" />
        <path d="M280,70 L280,120" stroke="#56949f" strokeWidth="1.6" fill="none" opacity="0.35" />
        <path d="M360,70 L440,120" stroke="#907aa9" strokeWidth="1.6" fill="none" opacity="0.35" />
        <path d="M95,180 L95,235" stroke="#286983" strokeWidth="1.6" fill="none" opacity="0.35" />
        <path d="M260,180 L280,235" stroke="#ea9d34" strokeWidth="1.6" fill="none" opacity="0.35" />
        <path d="M420,180 L310,235" stroke="#ea9d34" strokeWidth="1.6" fill="none" opacity="0.35" />
        <path d="M320,180 L460,235" stroke="#d7827e" strokeWidth="1.6" fill="none" opacity="0.3" strokeDasharray="5 3" />

        {/* --- Tier 1: Gateway --- */}
        <g style={{ filter: 'drop-shadow(0 4px 16px rgba(87,82,121,0.1))' }}>
          <rect x="195" y="15" width="170" height="54" rx="12" fill="#fff" stroke="#907aa9" strokeWidth="2" />
          <rect x="195" y="15" width="170" height="54" rx="12" fill="#907aa9" opacity="0.03" />
          <circle cx="220" cy="42" r="12" fill="#907aa9" opacity="0.08" />
          <text x="220" y="47" textAnchor="middle" fill="#907aa9" fontSize="13">&#x2B21;</text>
          <text x="295" y="38" textAnchor="middle" fill="#575279" fontSize="14" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">API Gateway</text>
          <text x="295" y="54" textAnchor="middle" fill="#797593" fontSize="10" fontFamily="Inter,system-ui,sans-serif">network/gateway</text>
        </g>

        {/* --- Tier 2: Services --- */}
        <g style={{ filter: 'drop-shadow(0 4px 16px rgba(87,82,121,0.1))' }}>
          <rect x="15" y="122" width="160" height="54" rx="12" fill="#fff" stroke="#286983" strokeWidth="2" />
          <rect x="15" y="122" width="160" height="54" rx="12" fill="#286983" opacity="0.03" />
          <circle cx="40" cy="149" r="12" fill="#286983" opacity="0.08" />
          <text x="40" y="154" textAnchor="middle" fill="#286983" fontSize="12">&#x25A2;</text>
          <text x="108" y="145" textAnchor="middle" fill="#575279" fontSize="13" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">Notification Svc</text>
          <text x="108" y="161" textAnchor="middle" fill="#797593" fontSize="10" fontFamily="Inter,system-ui,sans-serif">compute/service</text>
        </g>

        <g style={{ filter: 'drop-shadow(0 4px 16px rgba(87,82,121,0.1))' }}>
          <rect x="200" y="122" width="160" height="54" rx="12" fill="#fff" stroke="#56949f" strokeWidth="2" />
          <rect x="200" y="122" width="160" height="54" rx="12" fill="#56949f" opacity="0.03" />
          <circle cx="225" cy="149" r="12" fill="#56949f" opacity="0.08" />
          <text x="225" y="154" textAnchor="middle" fill="#56949f" fontSize="12">&#x25A2;</text>
          <text x="293" y="145" textAnchor="middle" fill="#575279" fontSize="13" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">Order Service</text>
          <text x="293" y="161" textAnchor="middle" fill="#797593" fontSize="10" fontFamily="Inter,system-ui,sans-serif">compute/service</text>
        </g>

        <g style={{ filter: 'drop-shadow(0 4px 16px rgba(87,82,121,0.1))' }}>
          <rect x="385" y="122" width="160" height="54" rx="12" fill="#fff" stroke="#56949f" strokeWidth="2" />
          <rect x="385" y="122" width="160" height="54" rx="12" fill="#56949f" opacity="0.03" />
          <circle cx="410" cy="149" r="12" fill="#56949f" opacity="0.08" />
          <text x="410" y="154" textAnchor="middle" fill="#56949f" fontSize="12">&#x25A2;</text>
          <text x="478" y="145" textAnchor="middle" fill="#575279" fontSize="13" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">User Service</text>
          <text x="478" y="161" textAnchor="middle" fill="#797593" fontSize="10" fontFamily="Inter,system-ui,sans-serif">compute/service</text>
        </g>

        {/* --- Tier 3: Data --- */}
        <g style={{ filter: 'drop-shadow(0 4px 16px rgba(87,82,121,0.1))' }}>
          <rect x="25" y="237" width="140" height="54" rx="12" fill="#fff" stroke="#286983" strokeWidth="2" />
          <rect x="25" y="237" width="140" height="54" rx="12" fill="#286983" opacity="0.03" />
          <circle cx="52" cy="264" r="12" fill="#286983" opacity="0.08" />
          <text x="52" y="269" textAnchor="middle" fill="#286983" fontSize="13">&#x224B;</text>
          <text x="110" y="260" textAnchor="middle" fill="#575279" fontSize="13" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">Kafka</text>
          <text x="110" y="276" textAnchor="middle" fill="#797593" fontSize="10" fontFamily="Inter,system-ui,sans-serif">messaging/queue</text>
        </g>

        <g style={{ filter: 'drop-shadow(0 4px 16px rgba(87,82,121,0.1))' }}>
          <rect x="205" y="237" width="150" height="54" rx="27" fill="#fff" stroke="#ea9d34" strokeWidth="2" />
          <rect x="205" y="237" width="150" height="54" rx="27" fill="#ea9d34" opacity="0.03" />
          <circle cx="234" cy="264" r="12" fill="#ea9d34" opacity="0.08" />
          <text x="234" y="269" textAnchor="middle" fill="#ea9d34" fontSize="13">&#x26C1;</text>
          <text x="298" y="260" textAnchor="middle" fill="#575279" fontSize="13" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">PostgreSQL</text>
          <text x="298" y="276" textAnchor="middle" fill="#797593" fontSize="10" fontFamily="Inter,system-ui,sans-serif">data/sql</text>
        </g>

        <g style={{ filter: 'drop-shadow(0 4px 16px rgba(87,82,121,0.1))' }}>
          <rect x="395" y="237" width="130" height="54" rx="27" fill="#fff" stroke="#d7827e" strokeWidth="2" />
          <rect x="395" y="237" width="130" height="54" rx="27" fill="#d7827e" opacity="0.03" />
          <circle cx="422" cy="264" r="12" fill="#d7827e" opacity="0.08" />
          <text x="422" y="269" textAnchor="middle" fill="#d7827e" fontSize="13">&#x26C1;</text>
          <text x="474" y="260" textAnchor="middle" fill="#575279" fontSize="13" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">Redis</text>
          <text x="474" y="276" textAnchor="middle" fill="#797593" fontSize="10" fontFamily="Inter,system-ui,sans-serif">data/cache</text>
        </g>

        {/* --- Edge labels --- */}
        <g>
          <rect x="133" y="88" width="48" height="16" rx="4" fill="rgba(250,244,237,0.92)" stroke="#dfdad9" strokeWidth="0.5" />
          <text x="157" y="99" textAnchor="middle" fill="#797593" fontSize="9" fontWeight="500" fontFamily="Inter,system-ui,sans-serif">async</text>
        </g>
        <g>
          <rect x="258" y="88" width="42" height="16" rx="4" fill="rgba(250,244,237,0.92)" stroke="#dfdad9" strokeWidth="0.5" />
          <text x="279" y="99" textAnchor="middle" fill="#797593" fontSize="9" fontWeight="500" fontFamily="Inter,system-ui,sans-serif">gRPC</text>
        </g>
        <g>
          <rect x="378" y="88" width="42" height="16" rx="4" fill="rgba(250,244,237,0.92)" stroke="#dfdad9" strokeWidth="0.5" />
          <text x="399" y="99" textAnchor="middle" fill="#797593" fontSize="9" fontWeight="500" fontFamily="Inter,system-ui,sans-serif">REST</text>
        </g>
        <g>
          <rect x="260" y="205" width="36" height="16" rx="4" fill="rgba(250,244,237,0.92)" stroke="#dfdad9" strokeWidth="0.5" />
          <text x="278" y="216" textAnchor="middle" fill="#797593" fontSize="9" fontWeight="500" fontFamily="Inter,system-ui,sans-serif">SQL</text>
        </g>

        {/* --- Breadcrumb --- */}
        <g>
          <rect x="10" y="340" width="130" height="22" rx="6" fill="rgba(250,244,237,0.88)" stroke="#dfdad9" strokeWidth="0.5" />
          <text x="18" y="354" fill="#797593" fontSize="9" fontFamily="Inter,system-ui,sans-serif">root</text>
          <text x="39" y="354" fill="#dfdad9" fontSize="9">&#x203A;</text>
          <text x="47" y="354" fill="#575279" fontSize="9" fontWeight="600" fontFamily="Inter,system-ui,sans-serif">main</text>
          <text x="71" y="354" fill="#dfdad9" fontSize="9">&#x203A;</text>
          <text x="79" y="354" fill="#907aa9" fontSize="9" fontWeight="600" fontFamily="Inter,system-ui,sans-serif">e-commerce</text>
        </g>
      </svg>

      {/* --- AI chat bubble (HTML overlay) --- */}
      <div className="absolute bottom-10 right-3 bg-white border border-border rounded-[10px] px-3.5 py-2.5 shadow-[0_4px_20px_rgba(87,82,121,0.1)] max-w-[200px]">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-4 h-4 rounded bg-gold flex items-center justify-center">
            <span className="text-white text-[8px] font-bold">AI</span>
          </div>
          <span className="text-dark-purple text-[10px] font-semibold">Claude</span>
        </div>
        <div className="text-muted text-[10px] leading-snug">
          Added Order Service with gRPC connection to API Gateway
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `landing/src/components/Hero.tsx`**

```tsx
import { useState } from 'react';
import { HeroDiagram } from './HeroDiagram';
import { VideoModal } from './VideoModal';
import { GITHUB_RELEASES } from '../constants';

export function Hero() {
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <section id="hero" className="relative overflow-hidden pb-6">
      {/* Radial fade for text readability over dot grid */}
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-[1]" aria-hidden="true">
        <defs>
          <radialGradient id="hero-fade" cx="0.22" cy="0.5" r="0.45">
            <stop offset="0%" stopColor="#faf4ed" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#faf4ed" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-fade)" />
      </svg>

      <div className="relative z-[2] px-14 max-w-[1280px] mx-auto">
        {/* Hero split: text left (38%), diagram right (62%) */}
        <div className="flex gap-12 items-center">
          {/* Text side */}
          <div className="flex-[0_0_38%] max-w-[38%]">
            <div className="inline-block bg-warm-cream/90 text-purple text-xs px-3.5 py-1.5 rounded-full mb-[18px] font-semibold border border-purple/15">
              AI-native architecture tool
            </div>
            <h1 className="text-[40px] font-extrabold leading-[1.12] tracking-tight mb-1.5">
              You design the<br />architecture.
            </h1>
            <p className="text-[40px] font-extrabold leading-[1.12] tracking-tight text-purple mb-1.5">
              AI writes the code.
            </p>
            <p className="text-muted text-base mb-7 leading-relaxed">
              The diagram <em>is</em> the spec. Design visually on an interactive canvas,
              commit to git, and let AI implement from your architecture.
            </p>
            <div className="flex gap-3">
              <a
                href={GITHUB_RELEASES}
                className="bg-dark-purple text-cream px-6 py-3 rounded-[10px] text-sm font-semibold shadow-[0_2px_8px_rgba(87,82,121,0.25)] inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
              >
                &#63743; Download for Mac
              </a>
              <button
                onClick={() => setVideoOpen(true)}
                className="border border-border text-dark-purple px-6 py-3 rounded-[10px] text-sm bg-cream/70 backdrop-blur-sm hover:bg-warm-cream/70 transition-colors cursor-pointer"
              >
                Watch demo
              </button>
            </div>
          </div>

          {/* Diagram side */}
          <HeroDiagram />
        </div>
      </div>

      <VideoModal open={videoOpen} onOpenChange={setVideoOpen} />
    </section>
  );
}
```

- [ ] **Step 4: Wire Hero into App.tsx**

Replace `landing/src/App.tsx`:

```tsx
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';

export function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <section id="features" className="py-20 text-center">
          <h2 className="text-3xl font-extrabold text-dark-purple">Features placeholder</h2>
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Verify**

```bash
cd landing && npm run dev
```

Expected: Hero shows split layout — text with badge/title/CTAs on left, SVG architecture diagram on right. "Watch demo" button opens video modal. AI chat bubble visible bottom-right of diagram. Radial fade softens dots behind text.

- [ ] **Step 6: Commit**

```bash
git add landing/src/components/Hero.tsx landing/src/components/HeroDiagram.tsx \
       landing/src/components/VideoModal.tsx landing/src/App.tsx
git commit -m "feat(landing): add hero section with SVG diagram and video modal

Split layout (38/62) with radial fade for text readability. SVG shows
3-tier e-commerce architecture. Video modal uses Radix Dialog + motion."
```

---

### Task 4: Features Section

**Files:**
- Create: `landing/src/components/Features.tsx`
- Modify: `landing/src/App.tsx`

**Context (read but don't modify):**
- `docs/specs/2026-03-22-landing-page-design.md` — Section 2: Features
- `.superpowers/brainstorm/88969-1774191190/full-page-v2.html:233-272` — features HTML

- [ ] **Step 1: Create `landing/src/components/Features.tsx`**

```tsx
const FEATURES = [
  {
    title: 'AI reads your architecture',
    description:
      'Your diagram drives the code. Design visually, commit to git, and AI implements directly from your architecture — not from vague text prompts.',
    gradient: 'from-gold to-[#f6c177]',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2a5 5 0 0 1 5 5c0 2-1 3-2 4l-1 1v2h-4v-2l-1-1c-1-1-2-2-2-4a5 5 0 0 1 5-5z" />
        <line x1="10" y1="18" x2="14" y2="18" />
        <line x1="10" y1="21" x2="14" y2="21" />
      </svg>
    ),
  },
  {
    title: 'Infinite depth',
    description:
      'Dive into any service to see its internals, then zoom back out to the full system. Subsystems nest recursively — just like real architectures.',
    gradient: 'from-teal to-[#9ccfd8]',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    title: 'Git-native YAML',
    description:
      'Human-readable YAML files in .archcanvas/, committed alongside your code. Meaningful diffs in PRs. Architecture reviewed like code.',
    gradient: 'from-purple to-[#c4a7e7]',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="3" />
        <circle cx="19" cy="5" r="2" />
        <circle cx="5" cy="19" r="2" />
        <line x1="14.5" y1="9.5" x2="17.5" y2="6.5" />
        <line x1="9.5" y1="14.5" x2="6.5" y2="17.5" />
      </svg>
    ),
  },
  {
    title: '40+ built-in types',
    description:
      'Services, databases, queues, gateways, AI pipelines — 9 namespaces covering real infrastructure. Define custom types for your team.',
    gradient: 'from-dark-teal to-teal',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
] as const;

export function Features() {
  return (
    <section id="features" className="relative z-[1] px-14 py-20">
      <div className="max-w-[880px] mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-block bg-warm-cream/90 text-purple text-[11px] px-3 py-1 rounded-full mb-3 font-semibold border border-purple/15">
            Why ArchCanvas
          </div>
          <h2 className="text-dark-purple text-[30px] font-extrabold tracking-tight leading-tight">
            Architecture tools weren&apos;t<br />built for the AI era.
          </h2>
          <p className="text-muted text-sm mt-2.5 leading-relaxed">
            Most diagrams rot in Figma or Miro, disconnected from the codebase. ArchCanvas is different.
          </p>
        </div>

        {/* 2x2 card grid */}
        <div className="grid grid-cols-2 gap-5">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="bg-white border border-border rounded-[14px] p-7 shadow-[0_2px_12px_rgba(87,82,121,0.06)]"
            >
              <div
                className={`w-[46px] h-[46px] rounded-xl flex items-center justify-center mb-4 bg-linear-to-br ${feature.gradient}`}
              >
                {feature.icon}
              </div>
              <h3 className="text-dark-purple text-[17px] font-bold mb-1.5">
                {feature.title}
              </h3>
              <p className="text-muted text-[13px] leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Wire into App.tsx**

Replace the `#features` placeholder in `landing/src/App.tsx` with `<Features />` (import from `./components/Features`).

- [ ] **Step 3: Verify**

```bash
cd landing && npm run dev
```

Expected: 2x2 card grid with gradient icons, white cards with subtle shadow, centered header with badge.

- [ ] **Step 4: Commit**

```bash
git add landing/src/components/Features.tsx landing/src/App.tsx
git commit -m "feat(landing): add features section with 2x2 card grid

Four feature cards with gradient icon backgrounds. Centered header with
badge and subtitle."
```

---

### Task 5: How It Works + Tech Strip

**Files:**
- Create: `landing/src/components/HowItWorks.tsx`
- Create: `landing/src/components/TechStrip.tsx`
- Modify: `landing/src/App.tsx`

**Context (read but don't modify):**
- `docs/specs/2026-03-22-landing-page-design.md` — Sections 3 and 4
- `.superpowers/brainstorm/88969-1774191190/full-page-v2.html:274-380` — how-it-works + tech strip HTML

- [ ] **Step 1: Create `landing/src/components/HowItWorks.tsx`**

```tsx
function StepArrow({ color }: { color: string }) {
  return (
    <div className="flex-[0_0_40px] flex items-center justify-center pt-7">
      <svg width="40" height="20" viewBox="0 0 40 20">
        <line x1="0" y1="10" x2="30" y2="10" stroke={color} strokeWidth="2" opacity="0.3" />
        <polyline
          points="26,5 32,10 26,15"
          fill="none"
          stroke={color}
          strokeWidth="2"
          opacity="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section className="relative z-[1] px-14 py-20 bg-[rgba(242,233,225,0.55)]">
      <div className="max-w-[880px] mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-block bg-warm-cream/90 text-purple text-[11px] px-3 py-1 rounded-full mb-3 font-semibold border border-purple/15">
            How it works
          </div>
          <h2 className="text-dark-purple text-[30px] font-extrabold tracking-tight leading-tight">
            From diagram to working code<br />in three steps.
          </h2>
        </div>

        {/* 3-step flow */}
        <div className="flex items-stretch">
          {/* Step 1: Design */}
          <div className="flex-1 text-center flex flex-col">
            <div className="w-16 h-16 rounded-full bg-white border-2 border-purple flex items-center justify-center mx-auto mb-4 shadow-[0_4px_16px_rgba(87,82,121,0.08)] text-2xl font-extrabold text-purple shrink-0">
              1
            </div>
            <div className="bg-white border border-border rounded-[10px] p-3 mx-2.5 mb-3.5 shadow-[0_2px_8px_rgba(87,82,121,0.05)] min-h-[120px] flex-1 flex flex-col justify-center">
              <svg width="100%" height="80" viewBox="0 0 160 80">
                <pattern id="s1dots" width="12" height="12" patternUnits="userSpaceOnUse">
                  <circle cx="6" cy="6" r="0.8" fill="#575279" opacity="0.15" />
                </pattern>
                <rect width="160" height="80" fill="url(#s1dots)" />
                <line x1="50" y1="25" x2="110" y2="25" stroke="#907aa9" strokeWidth="1.2" opacity="0.4" />
                <line x1="50" y1="25" x2="80" y2="60" stroke="#56949f" strokeWidth="1.2" opacity="0.4" />
                <line x1="110" y1="25" x2="80" y2="60" stroke="#ea9d34" strokeWidth="1.2" opacity="0.4" />
                <rect x="32" y="14" width="36" height="22" rx="5" fill="#fff" stroke="#907aa9" strokeWidth="1.5" />
                <rect x="92" y="14" width="36" height="22" rx="5" fill="#fff" stroke="#56949f" strokeWidth="1.5" />
                <rect x="62" y="49" width="36" height="22" rx="11" fill="#fff" stroke="#ea9d34" strokeWidth="1.5" />
              </svg>
            </div>
            <h3 className="text-dark-purple text-base font-bold mb-1 shrink-0">Design</h3>
            <p className="text-muted text-xs leading-normal px-2 shrink-0">
              Draw your system on the canvas. Nodes, edges, subsystems — as deep as you need.
            </p>
          </div>

          <StepArrow color="#907aa9" />

          {/* Step 2: Commit */}
          <div className="flex-1 text-center flex flex-col">
            <div className="w-16 h-16 rounded-full bg-white border-2 border-teal flex items-center justify-center mx-auto mb-4 shadow-[0_4px_16px_rgba(87,82,121,0.08)] text-2xl font-extrabold text-teal shrink-0">
              2
            </div>
            <div className="bg-white border border-border rounded-[10px] p-3 mx-2.5 mb-3.5 shadow-[0_2px_8px_rgba(87,82,121,0.05)] min-h-[120px] flex-1 flex flex-col justify-center">
              <div className="text-left font-mono text-[9px] leading-[1.7] text-dark-purple">
                <div><span className="text-purple">nodes:</span></div>
                <div className="pl-2.5"><span className="text-teal">- id:</span> api-gateway</div>
                <div className="pl-3.5"><span className="text-teal">type:</span> network/gateway</div>
                <div className="pl-2.5"><span className="text-teal">- id:</span> order-svc</div>
                <div className="pl-3.5"><span className="text-teal">type:</span> compute/service</div>
                <div><span className="text-purple">edges:</span></div>
                <div className="pl-2.5"><span className="text-gold">- from:</span> api-gateway</div>
              </div>
            </div>
            <h3 className="text-dark-purple text-base font-bold mb-1 shrink-0">Commit</h3>
            <p className="text-muted text-xs leading-normal px-2 shrink-0">
              YAML files in <code className="bg-warm-cream px-1 py-0.5 rounded text-xs font-mono">.archcanvas/</code> go into git. Review architecture changes in PRs.
            </p>
          </div>

          <StepArrow color="#56949f" />

          {/* Step 3: Generate */}
          <div className="flex-1 text-center flex flex-col">
            <div className="w-16 h-16 rounded-full bg-white border-2 border-gold flex items-center justify-center mx-auto mb-4 shadow-[0_4px_16px_rgba(87,82,121,0.08)] text-2xl font-extrabold text-gold shrink-0">
              3
            </div>
            <div className="bg-white border border-border rounded-[10px] p-3 mx-2.5 mb-3.5 shadow-[0_2px_8px_rgba(87,82,121,0.05)] min-h-[120px] flex-1 flex flex-col justify-center">
              <div className="flex items-start gap-2 mb-2">
                <div className="w-[18px] h-[18px] rounded-[5px] bg-gold flex items-center justify-center shrink-0">
                  <span className="text-white text-[8px] font-bold">AI</span>
                </div>
                <div className="bg-warm-cream rounded-md px-2 py-1.5 text-[9px] text-dark-purple leading-snug">
                  I&apos;ll implement the Order Service with gRPC endpoints based on your architecture.
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-0.5 bg-teal/30 rounded-full" />
                <span className="text-[8px] text-teal font-medium">generating code...</span>
              </div>
            </div>
            <h3 className="text-dark-purple text-base font-bold mb-1 shrink-0">Generate</h3>
            <p className="text-muted text-xs leading-normal px-2 shrink-0">
              AI reads your architecture as the source of truth and turns it into working code.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create `landing/src/components/TechStrip.tsx`**

Tech logos are inline SVGs rendered at monochrome opacity (0.45). Exact SVGs from the mockup.

```tsx
const TECH_ITEMS = [
  {
    label: 'React 19',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="2" fill="#575279" />
        <ellipse cx="12" cy="12" rx="10" ry="4" stroke="#575279" strokeWidth="1.2" fill="none" />
        <ellipse cx="12" cy="12" rx="10" ry="4" stroke="#575279" strokeWidth="1.2" fill="none" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="10" ry="4" stroke="#575279" strokeWidth="1.2" fill="none" transform="rotate(120 12 12)" />
      </svg>
    ),
  },
  {
    label: 'TypeScript',
    icon: (
      <div className="w-8 h-8 rounded bg-dark-purple flex items-center justify-center">
        <span className="text-cream text-base font-extrabold">TS</span>
      </div>
    ),
  },
  {
    label: 'Tailwind 4',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="#575279">
        <path d="M12 6c-2.67 0-4.33 1.33-5 4 1-1.33 2.17-1.83 3.5-1.5.76.19 1.31.74 1.91 1.35C13.4 10.85 14.5 12 17 12c2.67 0 4.33-1.33 5-4-1 1.33-2.17 1.83-3.5 1.5-.76-.19-1.31-.74-1.91-1.35C15.6 7.15 14.5 6 12 6zM7 12c-2.67 0-4.33 1.33-5 4 1-1.33 2.17-1.83 3.5-1.5.76.19 1.31.74 1.91 1.35C8.4 16.85 9.5 18 12 18c2.67 0 4.33-1.33 5-4-1 1.33-2.17 1.83-3.5 1.5-.76-.19-1.31-.74-1.91-1.35C10.6 13.15 9.5 12 7 12z" />
      </svg>
    ),
  },
  {
    label: 'Tauri 2.0',
    icon: (
      <div className="w-8 h-8 rounded-lg border-2 border-dark-purple flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#575279">
          <circle cx="9" cy="9" r="4" />
          <circle cx="15" cy="15" r="4" />
          <circle cx="9" cy="9" r="2" fill="#faf4ed" />
          <circle cx="15" cy="15" r="2" fill="#faf4ed" />
        </svg>
      </div>
    ),
  },
  {
    label: 'Claude SDK',
    icon: (
      <div className="w-8 h-8 rounded-lg bg-gold flex items-center justify-center">
        <span className="text-white text-xs font-extrabold">AI</span>
      </div>
    ),
  },
  {
    label: 'YAML',
    icon: (
      <div className="w-8 h-8 rounded border-2 border-dark-purple flex items-center justify-center">
        <span className="text-dark-purple text-[10px] font-bold font-mono">{'{}'}</span>
      </div>
    ),
  },
  {
    label: 'Git-native',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="#575279">
        <path d="M23.546 10.93L13.067.452a1.55 1.55 0 00-2.188 0L8.708 2.627l2.76 2.76a1.838 1.838 0 012.327 2.341l2.66 2.66a1.838 1.838 0 11-1.103 1.03l-2.48-2.48v6.53a1.838 1.838 0 11-1.512-.065V8.76a1.838 1.838 0 01-.998-2.41L7.629 3.618.452 10.796a1.55 1.55 0 000 2.188l10.48 10.48a1.55 1.55 0 002.186 0l10.43-10.43a1.55 1.55 0 000-2.104z" />
      </svg>
    ),
  },
] as const;

export function TechStrip() {
  return (
    <section className="relative z-[1] px-14 py-13 border-t border-b border-[#e8e0d8]">
      <div className="max-w-[800px] mx-auto">
        <div className="text-center mb-7 text-muted text-[13px] font-medium uppercase tracking-[2px]">
          Built with
        </div>
        <div className="flex items-center justify-center gap-11 flex-wrap">
          {TECH_ITEMS.map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-1.5 opacity-45">
              {item.icon}
              <span className="text-[10px] text-muted font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Wire into App.tsx**

Add `<HowItWorks />` and `<TechStrip />` after `<Features />` in App.tsx. Import both.

- [ ] **Step 4: Verify**

```bash
cd landing && npm run dev
```

Expected: "How it works" shows 3 steps with connecting arrows, illustrations align horizontally. Tech strip shows 7 monochrome logos at 45% opacity with top/bottom borders.

- [ ] **Step 5: Commit**

```bash
git add landing/src/components/HowItWorks.tsx landing/src/components/TechStrip.tsx landing/src/App.tsx
git commit -m "feat(landing): add how-it-works and tech strip sections

Three-step flow with SVG/HTML illustrations and connecting arrows.
Tech strip with 7 monochrome logos at 45% opacity."
```

---

### Task 6: CTA + Footer

**Files:**
- Create: `landing/src/components/CtaSection.tsx`
- Create: `landing/src/components/Footer.tsx`
- Modify: `landing/src/App.tsx`

**Context (read but don't modify):**
- `docs/specs/2026-03-22-landing-page-design.md` — Sections 5 and Footer
- `.superpowers/brainstorm/88969-1774191190/full-page-v2.html:382-412` — CTA + footer HTML

- [ ] **Step 1: Create `landing/src/components/CtaSection.tsx`**

```tsx
import { Star } from 'lucide-react';
import { GITHUB_REPO, GITHUB_RELEASES } from '../constants';

export function CtaSection() {
  return (
    <section className="relative z-[1] px-14 py-20 bg-[rgba(87,82,121,0.82)] overflow-hidden">
      <div className="relative z-[1] max-w-[600px] mx-auto text-center">
        {/* Logo icon */}
        <div className="w-[52px] h-[52px] rounded-[14px] bg-linear-to-br from-purple to-teal mx-auto mb-5 flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#faf4ed" strokeWidth="2" strokeLinecap="round">
            <rect x="4" y="4" width="7" height="7" rx="1.5" />
            <rect x="13" y="4" width="7" height="7" rx="1.5" />
            <rect x="4" y="13" width="7" height="7" rx="1.5" />
            <line x1="17" y1="14" x2="17" y2="20" />
            <line x1="14" y1="17" x2="20" y2="17" />
          </svg>
        </div>

        <h2 className="text-cream text-[30px] font-extrabold tracking-tight leading-tight mb-3">
          Ready to design your<br />next architecture?
        </h2>
        <p className="text-[#c4b8b0] text-sm mb-7 leading-relaxed">
          Download ArchCanvas for Mac. Free for individual use.<br />
          Open format, community-extensible, AI-native.
        </p>

        <div className="flex gap-3 justify-center">
          <a
            href={GITHUB_RELEASES}
            className="bg-cream text-dark-purple px-6 py-3 rounded-[10px] text-sm font-bold shadow-[0_4px_16px_rgba(0,0,0,0.15)] inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            &#63743; Download for Mac
          </a>
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-cream/25 text-cream px-6 py-3 rounded-[10px] text-sm font-medium inline-flex items-center gap-1.5 hover:border-cream/40 transition-colors"
          >
            <Star size={14} />
            Star on GitHub
          </a>
        </div>

        <div className="mt-4 text-[#9e8fa0] text-[11px]">
          v0.1.0 · macOS 13+ · Apple Silicon & Intel
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create `landing/src/components/Footer.tsx`**

```tsx
import { GITHUB_REPO } from '../constants';

const FOOTER_LINKS = [
  { label: 'GitHub', href: GITHUB_REPO, external: true },
  { label: 'Docs', href: '#' },
  { label: 'Releases', href: `${GITHUB_REPO}/releases`, external: true },
  { label: 'License', href: `${GITHUB_REPO}/blob/main/LICENSE`, external: true },
] as const;

export function Footer() {
  return (
    <footer className="relative z-[1] bg-footer-bg px-14 py-7">
      <div className="max-w-[880px] mx-auto flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-[18px] h-[18px] rounded-[5px] bg-linear-to-br from-purple to-teal" />
            <span className="text-footer-text text-xs font-semibold">ArchCanvas</span>
          </div>
          <span className="text-footer-muted text-[11px]">
            &copy; {new Date().getFullYear()} ArchCanvas
          </span>
        </div>
        <div className="flex gap-5">
          {FOOTER_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              {...('external' in link && link.external
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
              className="text-footer-link text-xs font-medium hover:text-footer-text transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Wire into App.tsx**

Add `<CtaSection />` and `<Footer />` after `<TechStrip />`. Import both. The final App.tsx should render all sections in order: `Navbar → Hero → Features → HowItWorks → TechStrip → CtaSection → Footer`.

- [ ] **Step 4: Verify**

```bash
cd landing && npm run dev
```

Expected: CTA shows dark purple semi-transparent background with body dot grid visible through it. Footer is opaque dark purple. All links point to GitHub.

- [ ] **Step 5: Commit**

```bash
git add landing/src/components/CtaSection.tsx landing/src/components/Footer.tsx landing/src/App.tsx
git commit -m "feat(landing): add CTA section and footer

CTA with dark purple semi-transparent background, download + star buttons.
Footer with logo, copyright, and external links."
```

---

### Task 7: Animations

**Files:**
- Create: `landing/src/hooks/useScrollReveal.ts`
- Modify: `landing/src/components/HeroDiagram.tsx` (stagger animation)
- Modify: `landing/src/components/Hero.tsx` (AI bubble slide-in)
- Modify: `landing/src/components/Features.tsx` (scroll reveal)
- Modify: `landing/src/components/HowItWorks.tsx` (sequential reveal)
- Modify: `landing/src/components/TechStrip.tsx` (fade-in)
- Modify: `landing/src/components/CtaSection.tsx` (fade-in)

**Context (read but don't modify):**
- `docs/specs/2026-03-22-landing-page-design.md` — Section 5: Animations
- `src/components/ui/dialog.tsx` — motion animation patterns from main app

- [ ] **Step 1: Create `landing/src/hooks/useScrollReveal.ts`**

IntersectionObserver-based hook that returns a ref and `isVisible` boolean. Respects `prefers-reduced-motion`.

```typescript
import { useEffect, useRef, useState } from 'react';

interface UseScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
}

export function useScrollReveal<T extends HTMLElement>({
  threshold = 0.15,
  rootMargin = '0px',
}: UseScrollRevealOptions = {}) {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Skip observation if reduced motion preferred — show immediately
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsVisible(true);
      return;
    }

    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(element);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return { ref, isVisible };
}
```

- [ ] **Step 2: Add stagger animation to HeroDiagram.tsx**

Wrap the SVG node groups and edges in `motion.g` elements with staggered delays. The animation sequence is: nodes fade in (150ms stagger) → edges draw (stroke-dashoffset) → AI bubble slides in.

Modify `landing/src/components/HeroDiagram.tsx`:

1. Import `motion` and `useReducedMotion` from `motion/react`
2. Add `useReducedMotion()` hook — if true, render everything static (no animation)
3. Wrap each node `<g>` in `<motion.g initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.15, duration: 0.5 }}>`
4. For edges, use `motion.path` with `pathLength` animation: `initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.2, duration: 0.6 }}`
5. AI bubble: `<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.8, duration: 0.4 }}>`
6. When `reducedMotion` is true, skip all animation props (render static)

Key implementation detail: assign `strokeDasharray` and `strokeDashoffset` via motion's `pathLength` property. Set each `<motion.path>` with `pathLength="1"` attribute, `strokeDasharray="1"`, `strokeDashoffset` animated from `1` to `0`.

- [ ] **Step 3: Add scroll reveal to Features.tsx**

Modify `landing/src/components/Features.tsx`:

1. Import `useScrollReveal` and `motion` from respective modules
2. Add `const { ref, isVisible } = useScrollReveal<HTMLDivElement>()`
3. Wrap section content `<div ref={ref}>`
4. Wrap each feature card in `<motion.div>` with:
   ```tsx
   initial={{ opacity: 0, y: 20 }}
   animate={isVisible ? { opacity: 1, y: 0 } : {}}
   transition={{ delay: index * 0.1, duration: 0.5 }}
   ```

- [ ] **Step 4: Add sequential reveal to HowItWorks.tsx**

Modify `landing/src/components/HowItWorks.tsx`:

1. Import `useScrollReveal` and `motion`
2. Wrap each step in `<motion.div>` with sequential delays (step 1: 0ms, arrow: 200ms, step 2: 400ms, arrow: 600ms, step 3: 800ms)
3. Each step: `initial={{ opacity: 0, y: 20 }} animate={isVisible ? { opacity: 1, y: 0 } : {}}`

- [ ] **Step 5: Add scroll reveal to TechStrip.tsx and CtaSection.tsx**

Apply `useScrollReveal` to both components. Simple fade-in: `initial={{ opacity: 0 }} animate={isVisible ? { opacity: 1 } : {}} transition={{ duration: 0.6 }}`

- [ ] **Step 6: Verify animations**

```bash
cd landing && npm run dev
```

Expected:
- On load: hero nodes stagger in → edges draw → AI bubble slides up
- On scroll: feature cards fade in with stagger, how-it-works steps reveal sequentially, tech strip and CTA fade in
- With `prefers-reduced-motion`: all content visible immediately, no animations

Test reduced motion: In macOS System Settings → Accessibility → Display → Reduce motion. Reload page — everything should appear immediately.

- [ ] **Step 7: Commit**

```bash
git add landing/src/hooks/useScrollReveal.ts landing/src/components/HeroDiagram.tsx \
       landing/src/components/Hero.tsx landing/src/components/Features.tsx \
       landing/src/components/HowItWorks.tsx landing/src/components/TechStrip.tsx \
       landing/src/components/CtaSection.tsx
git commit -m "feat(landing): add motion animations with scroll reveal

Hero: staggered node fade-in, edge draw animation, AI bubble slide-in.
Sections: IntersectionObserver-triggered fade-in on scroll.
All animations respect prefers-reduced-motion."
```

---

### Task 8: Responsive + SEO + Smoke Test

**Files:**
- Modify: `landing/index.html` (meta tags, OG tags)
- Modify: `landing/src/components/Hero.tsx` (tablet/mobile breakpoints)
- Modify: `landing/src/components/HeroDiagram.tsx` (hidden on mobile)
- Modify: `landing/src/components/Features.tsx` (mobile 1-column)
- Modify: `landing/src/components/HowItWorks.tsx` (mobile vertical stack)
- Modify: `landing/src/components/Footer.tsx` (mobile stack)
- Create: `landing/test/e2e/playwright.config.ts`
- Create: `landing/test/e2e/landing.spec.ts`

**Context (read but don't modify):**
- `docs/specs/2026-03-22-landing-page-design.md` — Section 6: Responsive Behavior, SEO & Social

- [ ] **Step 1: Add responsive classes to Hero.tsx**

```tsx
{/* Hero split — responsive */}
<div className="flex gap-12 items-center max-lg:flex-col max-lg:gap-8">
  {/* Text side — full width on tablet/mobile */}
  <div className="flex-[0_0_38%] max-w-[38%] max-lg:flex-none max-lg:max-w-none max-lg:text-center">
    {/* ... existing content ... */}
    <div className="flex gap-3 max-lg:justify-center">
      {/* ... buttons ... */}
    </div>
  </div>
  {/* Diagram — hidden on mobile, min-height on tablet */}
  <div className="max-md:hidden max-lg:min-h-[300px]">
    <HeroDiagram />
  </div>
</div>
```

Also update the hero section padding: `className="... px-14 max-md:px-6"`

- [ ] **Step 2: Add responsive classes to remaining sections**

**Features.tsx**: Grid changes from 2-col to 1-col on mobile:
```tsx
<div className="grid grid-cols-2 max-md:grid-cols-1 gap-5">
```

Also update section padding: `className="... px-14 max-md:px-6"`

**HowItWorks.tsx**: Steps stack vertically on mobile, arrows hidden:
```tsx
<div className="flex items-stretch max-md:flex-col max-md:gap-6">
```
Hide `<StepArrow>` on mobile:
```tsx
<div className="... max-md:hidden">
  <StepArrow ... />
</div>
```

Also update section padding: `className="... px-14 max-md:px-6"`

**TechStrip.tsx**: Already uses `flex-wrap`, just update padding:
```tsx
className="... px-14 max-md:px-6"
```

**CtaSection.tsx**: Update padding:
```tsx
className="... px-14 max-md:px-6"
```

**Footer.tsx**: Stack on mobile:
```tsx
<div className="... flex justify-between items-center max-md:flex-col max-md:gap-4 max-md:text-center">
```

Also update padding: `className="... px-14 max-md:px-6"`

**Navbar.tsx**: Update padding:
```tsx
className="... px-14 max-md:px-6"
```

- [ ] **Step 3: Add SEO meta tags to index.html**

Update `landing/index.html` `<head>`:

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ArchCanvas — AI-Native Architecture Tool</title>
  <meta name="description" content="Design your system architecture visually, commit to git, and let AI implement from your diagrams. Free for individual use on macOS." />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="ArchCanvas — AI-Native Architecture Tool" />
  <meta property="og:description" content="Design your system architecture visually, commit to git, and let AI implement from your diagrams." />
  <meta property="og:image" content="/og-image.png" />
  <meta property="og:url" content="https://archcanvas.com" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="ArchCanvas — AI-Native Architecture Tool" />
  <meta name="twitter:description" content="Design your system architecture visually, commit to git, and let AI implement from your diagrams." />
  <meta name="twitter:image" content="/og-image.png" />
</head>
```

Note: `og-image.png` is a placeholder — create a screenshot of the hero section when the page is complete.

- [ ] **Step 4: Add Playwright smoke test**

Install Playwright as a dev dependency:

```bash
cd landing && npm install -D @playwright/test && npx playwright install chromium
```

Create `landing/test/e2e/playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  use: {
    baseURL: 'http://localhost:4173',
  },
  webServer: {
    command: 'npm run build && npm run preview',
    port: 4173,
    reuseExistingServer: true,
  },
});
```

Create `landing/test/e2e/landing.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test('renders all sections', async ({ page }) => {
    await page.goto('/');

    // Navbar
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.getByText('ArchCanvas').first()).toBeVisible();

    // Hero
    await expect(page.getByText('You design the')).toBeVisible();
    await expect(page.getByText('AI writes the code.')).toBeVisible();
    await expect(page.getByText('Download for Mac').first()).toBeVisible();

    // Features
    await expect(page.getByText('Why ArchCanvas')).toBeVisible();
    await expect(page.getByText('AI reads your architecture')).toBeVisible();

    // How it works
    await expect(page.getByText('How it works')).toBeVisible();
    await expect(page.getByText('Design').first()).toBeVisible();

    // Tech strip
    await expect(page.getByText('Built with')).toBeVisible();

    // CTA
    await expect(page.getByText('Ready to design your')).toBeVisible();

    // Footer
    await expect(page.locator('footer')).toBeVisible();
  });

  test('mobile menu opens and closes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    // Hamburger visible, desktop links hidden
    const hamburger = page.getByLabel('Open menu');
    await expect(hamburger).toBeVisible();

    // Open mobile menu
    await hamburger.click();
    await expect(page.getByLabel('Close menu')).toBeVisible();
    await expect(page.getByText('Features')).toBeVisible();

    // Close
    await page.getByLabel('Close menu').click();
    await expect(page.getByLabel('Open menu')).toBeVisible();
  });

  test('hero diagram hidden on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    // Diagram SVG should not be visible
    await expect(page.locator('svg[aria-label*="Architecture diagram"]')).not.toBeVisible();

    // But hero text is visible
    await expect(page.getByText('You design the')).toBeVisible();
  });
});
```

Add test script to `landing/package.json`:

```json
"test:e2e": "npx playwright test --config test/e2e/playwright.config.ts"
```

- [ ] **Step 5: Run the smoke test**

```bash
cd landing && npm run test:e2e
```

Expected: All 3 tests pass.

- [ ] **Step 6: Final visual verification**

```bash
cd landing && npm run dev
```

Check all three breakpoints manually:
- Desktop (1280px): full layout as designed
- Tablet (800px): hero stacks vertically, diagram visible with min-height
- Mobile (375px): single column, hero diagram hidden, mobile menu works

- [ ] **Step 7: Commit**

```bash
git add landing/
git commit -m "feat(landing): add responsive breakpoints, SEO meta tags, and smoke test

Mobile (<768px): single column, hero diagram hidden, hamburger menu.
Tablet (768-1023px): hero stacks, diagram with min-height, 2x2 features.
SEO: title, description, Open Graph, Twitter Card meta tags.
Playwright smoke test: section rendering, mobile menu, responsive diagram."
```
