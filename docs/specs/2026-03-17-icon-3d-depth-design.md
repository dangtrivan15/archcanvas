# Icon 3D Depth Enhancement — Design Spec

**Date:** 2026-03-17
**Status:** Approved
**Context:** [docs/icon-brainstorm/README.md](../icon-brainstorm/README.md)

## Overview

Enhance the ArchCanvas icon's 3D depth perception using atmospheric perspective, layout repositioning, and visual polish. The icon depicts three objects (human, AI robot, subcanvas) connected by edges on a 60° dot grid canvas surface.

## Why Atmospheric Perspective

Three approaches were evaluated for adding depth to the dot grid:

1. **Dot convergence** — hand-placed dots converging toward a vanishing point. Most physically accurate but requires manually positioning every dot (no SVG `<pattern>` trick), making it hard to maintain. Subtle effects are imperceptible at 128px icon size.
2. **Density gradient** — overlapping SVG patterns at different spacings, masked to crossfade. Creates moiré artifacts and visual noise from overlapping grids, especially at small sizes. Rejected after visual testing.
3. **Atmospheric perspective** (chosen) — single uniform dot pattern with an opacity fade via SVG `<mask>`. Simulates how distant things look hazier. Simple to implement (one gradient mask), clean at all sizes, no new visual elements. Combined with a warm→cool surface tint gradient for additional depth cue.

**Why not density gradient specifically:** Looked promising in theory but produced messy results when overlapping patterns created unpredictable interference at icon scale. Atmospheric perspective achieves the depth effect by *subtracting* (fading what's there) rather than *adding* (layering new patterns).

## Design Decisions

### Atmospheric Fade

| Parameter | Value | Why |
|---|---|---|
| Technique | `<linearGradient>` inside `<mask>` over the dot `<pattern>` | Single mask, no dot repositioning needed |
| Direction | Bottom-left → upper-right (x1=0 y1=1 → x2=1 y2=0) | Matches the 60° grid rotation direction; creates natural surface recession |
| Intensity | "BC Mid" — 4-stop curve: 0%→100%, 40%→90%, 68%→50%, 100%→25% | Tested 5 levels (A/B/C and 3 B↔C blends); BC Mid balances clear depth without dramatic dot disappearance. The intermediate stops at 90% and 50% create a smooth S-curve rather than a harsh linear ramp |
| Fade onset | 40% of diagonal (first visible change at 90% opacity) | Dots remain crisp in the near half, fade is gradual |
| Surface tint | Warm `#f0dcc4` at 15% → cool `#d4e0ef` at 10% | Mimics aerial perspective (near=warm, far=cool); subtle enough not to shift the Rosé Pine Dawn palette |

**Why fade toward upper-right (not upper-left):** The viewer is conceptually at the bottom-right, so upper-left would be physically correct. However, upper-right preserves the original triangle proportions without requiring the human to move farther left (which would elongate the human→canvas edge and distort the triangle). The fade reads as ambient surface texture rather than strict perspective, which is more natural at icon size.

### Layout & Depth Ordering

| Object | Position | Size | Depth |
|---|---|---|---|
| Subcanvas (teal `#56949f`) | Bottom-right | 40×22px body (largest) | Closest |
| Human (purple `#907aa9`) | Upper-left (cx=26, cy=57) | r=13 (medium) | Mid |
| AI Robot (gold `#ea9d34`) | Upper-right (cx=92, body y=28) | 20×15px body (smallest) | Farthest |

**Why swap AI and subcanvas from original:** The icon is called Arch**Canvas** — the canvas/subcanvas should be the hero object (closest, largest). Human is slightly closer than AI to suggest "human and AI collaborating on the canvas."

**Why shift human up:** Originally at cy=72 (left-center), the upper-left quadrant felt empty. Moving to cy=57 fills the space naturally and makes the triangle taller/more balanced without adding new visual elements.

### Triangle & Edges

- **Shape:** Asymmetric, opens rightward — narrow vertex (human) at left, widens toward the right (AI upper, canvas lower). Matches the user's reference sketch.
- **Edge style:** Gradient blending each edge's two node colors:
  - Human→AI: `#907aa9` → `#ea9d34` (gradient direction: x1=0 y1=1 → x2=1 y2=0, matching the line's lower-left to upper-right path)
  - AI→Canvas: `#ea9d34` → `#56949f` (x1=1 y1=0 → x2=1 y2=1, vertical axis matching the near-vertical line from (92,36) to (88,86))
  - Human→Canvas: `#907aa9` → `#56949f` (x1=0 y1=0 → x2=1 y2=1, diagonal matching the line from (26,55) to (88,86))
- **Opacity:** 0.45 for the two thinner edges (stroke-width 2), 0.40 for the human→canvas edge (stroke-width 2.5 — slightly thicker and more transparent as the closest/most prominent edge)

**Why gradient edges:** Matches the user's triangle reference sketch where each edge blends between its endpoint colors. Creates visual continuity between the three objects.

### Dot Grid

- **Angle:** 60° rotation (unchanged)
- **Spacing:** 16px pattern tiles
- **Dot size:** r=1.2, color `#dfdad9`

**Why keep 60°:** Doesn't align with any triangle edge (which would look rigid), and the dot rows run roughly along the atmospheric fade direction for clean consistency. Difference between angles is imperceptible at icon size.

### Subcanvas Interior

Mini diagram with 3 tiny nodes connected by edges, **centered vertically** in the rectangle body.

- 2 small rectangles (5×4, 6×4) + 1 circle (r=2), connected by 3 lines
- All in `#faf4ed` at 60-70% opacity
- Communicates "this contains a graph/diagram" — more literal than a dot grid, cleaner than window chrome at small sizes

**Why not mini dot grid:** Would create visual recursion (canvas-within-canvas) but at small icon sizes the tiny dots are imperceptible. The mini diagram is more recognizable.

### Standing Bases (3D Depth Effect)

Each object's standing base uses its **own body fill color at 55% opacity**. Base shape matches the object: ellipse for the round human, rect for the rectangular robot and subcanvas.

| Object | Base shape | Base color | Opacity |
|---|---|---|---|
| Human | Ellipse (rx=12, ry=3.5) | `#907aa9` | 55% |
| AI Robot | Rect (20×3, rx=1.2) | `#ea9d34` | 55% |
| Subcanvas | Rect (40×6, rx=2.5) | `#56949f` | 55% |

**Why own color at lower opacity (not darker shades):** Darkening gold shifts it to muddy brown; darkening teal shifts to murky green. Using the same color at lower opacity lets the cream background (`#faf4ed`) blend through naturally, creating a consistent "semi-transparent base" effect across all three objects without hue shifts.

**Why not universal shadow color:** A single dark purple-gray (`#4a3d5c`) for all bases was tested. It creates consistent shadow language but loses each object's color identity — the bases all look the same regardless of the object above them.

### Contact Shadows

Unchanged from original: `#575279` at 5-8% opacity, 2px Gaussian blur. These are separate from the standing bases and provide a soft ground-contact cue.

### Breadcrumb Path

Three segments with separators in the upper-left corner (y=12):

```
[seg1] > [seg2] > [seg3]
```

- Segments: rounded rectangles at decreasing opacity (13% → 10% → 7%)
- Separators: short strokes at 8-10% opacity
- References ArchCanvas's breadcrumb navigation (scope paths)
- Fills the upper-left corner without adding a new conceptual element

### Border

Thin subtle border: 1px `#575279` at 12% opacity.

**Why border:** On light backgrounds the cream icon blends into the page. The border is invisible on dark backgrounds (where contrast is sufficient) and provides just enough edge definition on light backgrounds.

**Why not heavier:** A 2px/20% border was tested — visible and defined but adds visual weight that competes with the interior elements. The 1px/12% version is a "safety net" that only matters when needed.

## SVG Architecture

The icon uses a layered SVG structure within a `clip-path` (rx=28 rounded rect):

1. **Background** — solid `#faf4ed`
2. **Dot pattern** — 16px tiles at 60°, masked by atmospheric gradient
3. **Surface tint** — warm→cool `linearGradient` overlay
4. **Contact shadows** — blurred ellipses below each object
5. **Edges** — gradient-stroked lines connecting the three objects
6. **Objects** — standing base + body + details for each (AI robot, human, subcanvas)
7. **Breadcrumb** — path segments in upper-left corner
8. **Border** — rounded rect stroke, last layer

All unique IDs must be namespaced to avoid collisions when multiple icons appear on the same page.

## Target Sizes

16, 32, 48, 128, 256, 512, 1024px — all rendered from the same 128px viewBox SVG. At 16-32px, fine details (breadcrumb, mini diagram, contact shadows, edge gradients) naturally become imperceptible but don't harm the composition. The three colored shapes + dot grid + atmospheric fade remain readable at all sizes.
