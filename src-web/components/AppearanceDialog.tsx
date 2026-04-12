import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useUiStore } from '@/store/uiStore';
import type { SidebarWidthPreset } from '@/store/uiStore';
import { useThemeStore } from '@/store/themeStore';
import { useThemeToggler } from '@/components/ui/theme-toggler';
import { palettes } from '@/core/theme/palettes';
import type { ThemePalette } from '@/core/theme/types';

const MODE_OPTIONS = [
  { value: 'light' as const, icon: Sun, label: 'Light' },
  { value: 'dark' as const, icon: Moon, label: 'Dark' },
  { value: 'system' as const, icon: Monitor, label: 'System' },
];

const TEXT_SIZE_OPTIONS = [
  { value: 'small' as const, label: 'S' },
  { value: 'medium' as const, label: 'M' },
  { value: 'large' as const, label: 'L' },
];

const DENSITY_OPTIONS = [
  { value: 'compact' as const, label: 'Compact' },
  { value: 'comfortable' as const, label: 'Comfortable' },
  { value: 'expanded' as const, label: 'Expanded' },
];

const SIDEBAR_WIDTH_OPTIONS: { value: SidebarWidthPreset; label: string }[] = [
  { value: 'narrow', label: 'Narrow' },
  { value: 'standard', label: 'Standard' },
  { value: 'wide', label: 'Wide' },
];

/** Show 4 representative swatches from a palette */
function PaletteSwatches({ palette, resolvedMode }: { palette: ThemePalette; resolvedMode: 'light' | 'dark' }) {
  const prefersReduced = useReducedMotion();
  const tokens = resolvedMode === 'dark' ? palette.dark : palette.light;
  const colors = [tokens.primary, tokens.accent, tokens.edgeAsync, tokens.nodeSelectedBorder];
  return (
    <div className="flex gap-1.5 mt-1.5">
      {colors.map((color, i) => (
        <motion.div
          key={i}
          className="size-3.5 rounded-full border border-border/50"
          style={{ backgroundColor: color }}
          whileHover={prefersReduced ? undefined : { scale: 1.15 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      ))}
    </div>
  );
}

export function AppearanceDialog() {
  const open = useUiStore((s) => s.showAppearanceDialog);
  const close = useUiStore((s) => s.closeAppearanceDialog);

  const currentPalette = useThemeStore((s) => s.palette);
  const currentMode = useThemeStore((s) => s.mode);
  const currentTextSize = useThemeStore((s) => s.textSize);
  const currentDensity = useThemeStore((s) => s.statusBarDensity);
  const resolvedMode = useThemeStore((s) => s.getResolvedMode());

  const currentSidebarWidth = useUiStore((s) => s.sidebarWidthPreset);
  const setSidebarWidth = useUiStore((s) => s.setSidebarWidthPreset);

  const setPalette = useThemeStore((s) => s.setPalette);
  const setTextSize = useThemeStore((s) => s.setTextSize);
  const setDensity = useThemeStore((s) => s.setStatusBarDensity);

  const prefersReduced = useReducedMotion();
  const { toggleTheme } = useThemeToggler('ltr');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Appearance</DialogTitle>
        </DialogHeader>

        {/* Color Palette */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-card-foreground">Color Palette</p>
          <div className="grid grid-cols-3 gap-2">
            {palettes.map((p) => (
              <button
                key={p.id}
                data-palette={p.id}
                onClick={() => setPalette(p.id)}
                className={`relative rounded-lg border p-3 text-left text-xs transition-colors hover:bg-accent/50 ${
                  currentPalette === p.id
                    ? 'border-primary bg-accent/30'
                    : 'border-border'
                }`}
              >
                <AnimatePresence>
                  {currentPalette === p.id && (
                    <motion.div
                      key="check"
                      initial={prefersReduced ? false : { scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={prefersReduced ? undefined : { scale: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="absolute top-2 right-2"
                    >
                      <Check className="size-3.5 text-primary" />
                    </motion.div>
                  )}
                </AnimatePresence>
                <span className="font-medium text-card-foreground">{p.name}</span>
                <PaletteSwatches palette={p} resolvedMode={resolvedMode} />
              </button>
            ))}
          </div>
        </div>

        {/* Mode */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-card-foreground">Mode</p>
          <div className="flex gap-2">
            {MODE_OPTIONS.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => toggleTheme(value)}
                className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                  currentMode === value
                    ? 'border-primary text-card-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent/50'
                }`}
              >
                {currentMode === value && (
                  <motion.div
                    layoutId={prefersReduced ? undefined : 'mode-indicator'}
                    className="absolute inset-0 rounded-md bg-accent/30"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <Icon className="relative z-10 size-3.5" />
                <span className="relative z-10">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Text Size */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-card-foreground">Text Size</p>
          <div className="flex gap-2">
            {TEXT_SIZE_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                data-text-size={value}
                onClick={() => setTextSize(value)}
                className={`relative flex flex-1 items-center justify-center rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                  currentTextSize === value
                    ? 'border-primary text-card-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent/50'
                }`}
              >
                {currentTextSize === value && (
                  <motion.div
                    layoutId={prefersReduced ? undefined : 'textsize-indicator'}
                    className="absolute inset-0 rounded-md bg-accent/30"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Status Bar Density */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-card-foreground">Status Bar Density</p>
          <div className="flex gap-2">
            {DENSITY_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                data-density={value}
                onClick={() => setDensity(value)}
                className={`relative flex flex-1 items-center justify-center rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                  currentDensity === value
                    ? 'border-primary text-card-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent/50'
                }`}
              >
                {currentDensity === value && (
                  <motion.div
                    layoutId={prefersReduced ? undefined : 'density-indicator'}
                    className="absolute inset-0 rounded-md bg-accent/30"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar Width */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-card-foreground">Sidebar Width</p>
          <div className="flex gap-2">
            {SIDEBAR_WIDTH_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                data-sidebar-width={value}
                onClick={() => setSidebarWidth(value)}
                className={`relative flex flex-1 items-center justify-center rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                  currentSidebarWidth === value
                    ? 'border-primary text-card-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent/50'
                }`}
              >
                {currentSidebarWidth === value && (
                  <motion.div
                    layoutId={prefersReduced ? undefined : 'sidebar-width-indicator'}
                    className="absolute inset-0 rounded-md bg-accent/30"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
