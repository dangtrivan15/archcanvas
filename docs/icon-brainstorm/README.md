# Icon Brainstorm — Saved Favorites

## Current favorite: `favorite-60deg-canvas-v2.svg`

Evolved from Round 22 via interactive brainstorming session (2026-03-17). Full design spec: [docs/specs/2026-03-17-icon-3d-depth-design.md](../specs/2026-03-17-icon-3d-depth-design.md)

Key changes from v1:
- **Atmospheric perspective**: dot opacity fades toward upper-right (BC Mid: 100%→25%)
- **Layout swap**: subcanvas (closest, bottom-right, largest) → human (mid, upper-left) → AI (farthest, upper-right, smallest)
- **Gradient edges**: each edge blends between its two node colors
- **Mini diagram**: centered inside subcanvas (3 tiny nodes + edges)
- **Standing bases**: own body color at 55% opacity (not solid dark shades)
- **Breadcrumb path**: `seg > seg > seg` in upper-left corner
- **Warm→cool surface tint**: subtle aerial perspective gradient
- **Thin border**: 1px #575279 at 12% opacity

## Previous versions

### `favorite-60deg-canvas.svg` (v1)
- **Round 22**: Full-screen canvas with 60° diagonal dot grid
- 3 objects standing on canvas: human (purple, left), robot AI (gold, right), subcanvas (teal, upper)
- Objects have 3D depth (bottom edges, shadows)
- Connecting lines between shapes
- Rosé Pine Dawn palette

### `favorite-robot-face.svg`
- **Round 17, Option A**: Minimal robot face as AI partner
- Straight dot grid canvas (no rotation), projected shadows
- Same 3 elements: human, robot AI (with eyes + antenna), subcanvas
- Edges connect shapes, shadows on canvas surface

## Next steps
- Final polish: icon sizes (16/32/48/128/256/512/1024), favicon, Tauri icon.png
- Test at small sizes — may need simplified versions for 16/32px
