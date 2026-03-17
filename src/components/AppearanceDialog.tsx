import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUiStore } from '@/store/uiStore';
import { useThemeStore } from '@/store/themeStore';
import { palettes } from '@/core/theme/palettes';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
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

/** Show 4 representative swatches from a palette */
function PaletteSwatches({ palette, resolvedMode }: { palette: ThemePalette; resolvedMode: 'light' | 'dark' }) {
  const tokens = resolvedMode === 'dark' ? palette.dark : palette.light;
  const colors = [tokens.primary, tokens.accent, tokens.edgeAsync, tokens.nodeSelectedBorder];
  return (
    <div className="flex gap-1.5 mt-1.5">
      {colors.map((color, i) => (
        <div
          key={i}
          className="size-3.5 rounded-full border border-border/50"
          style={{ backgroundColor: color }}
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
  const resolvedMode = useThemeStore((s) => s.getResolvedMode());

  const setPalette = useThemeStore((s) => s.setPalette);
  const setMode = useThemeStore((s) => s.setMode);
  const setTextSize = useThemeStore((s) => s.setTextSize);

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
                {currentPalette === p.id && (
                  <Check className="absolute top-2 right-2 size-3.5 text-primary" />
                )}
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
                onClick={() => setMode(value)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                  currentMode === value
                    ? 'border-primary bg-accent/30 text-card-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent/50'
                }`}
              >
                <Icon className="size-3.5" />
                {label}
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
                className={`flex flex-1 items-center justify-center rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                  currentTextSize === value
                    ? 'border-primary bg-accent/30 text-card-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent/50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
