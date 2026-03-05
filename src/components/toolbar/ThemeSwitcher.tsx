/**
 * ThemeSwitcher — dropdown palette selector for the toolbar.
 *
 * Shows a button with the current theme swatch. Clicking it opens a dropdown
 * listing all registered themes, each with a row of 4-5 color circles as preview.
 * The active theme is visually highlighted. Supports keyboard navigation
 * (ArrowUp/Down, Enter to select, Escape to close).
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Palette, Check } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { themes, themeIds } from '@/theme/themes';

/** The 5 swatch colors to preview per theme */
const SWATCH_KEYS = ['background', 'primary', 'accent', 'pine', 'love'] as const;

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const themeId = useUIStore((s) => s.themeId);
  const setTheme = useUIStore((s) => s.setTheme);
  const showToast = useUIStore((s) => s.showToast);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setFocusIndex(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus management when focus index changes
  useEffect(() => {
    if (open && focusIndex >= 0 && itemRefs.current[focusIndex]) {
      itemRefs.current[focusIndex]!.focus();
    }
  }, [open, focusIndex]);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      if (!prev) {
        // Opening — set focus to current theme
        const currentIdx = themeIds.indexOf(themeId as any);
        setFocusIndex(currentIdx >= 0 ? currentIdx : 0);
      } else {
        setFocusIndex(-1);
      }
      return !prev;
    });
  }, [themeId]);

  const selectTheme = useCallback(
    (id: string) => {
      setTheme(id);
      showToast(`Theme changed to ${themes[id]!.name}`);
      setOpen(false);
      setFocusIndex(-1);
      buttonRef.current?.focus();
    },
    [setTheme, showToast],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusIndex((i) => (i + 1) % themeIds.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusIndex((i) => (i - 1 + themeIds.length) % themeIds.length);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (focusIndex >= 0 && focusIndex < themeIds.length) {
            selectTheme(themeIds[focusIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          setFocusIndex(-1);
          buttonRef.current?.focus();
          break;
        case 'Home':
          e.preventDefault();
          setFocusIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setFocusIndex(themeIds.length - 1);
          break;
      }
    },
    [open, focusIndex, toggle, selectTheme],
  );

  const currentTheme = themes[themeId] ?? themes[themeIds[0]];

  return (
    <div className="relative" onKeyDown={handleKeyDown}>
      {/* Trigger button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        className={`inline-flex items-center justify-center gap-1.5 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 touch-target ${
          compact ? 'px-1.5 py-1' : 'px-2.5 py-1.5'
        }`}
        title={`Theme: ${currentTheme?.name ?? 'Default'}`}
        aria-label={`Theme: ${currentTheme?.name ?? 'Default'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid="theme-switcher-button"
      >
        <Palette className="w-4 h-4" />
        {/* Mini swatch of current theme */}
        {!compact && (
          <span className="inline-flex gap-0.5 ml-0.5">
            {SWATCH_KEYS.slice(0, 3).map((key) => (
              <span
                key={key}
                className="w-2.5 h-2.5 rounded-full border border-[hsl(var(--border))]"
                style={{ backgroundColor: `hsl(${currentTheme?.colors[key] ?? '0 0% 50%'})` }}
              />
            ))}
          </span>
        )}
      </button>

      {/* Dropdown menu */}
      {open && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1 w-64 bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-lg shadow-lg z-[60] py-1 overflow-hidden"
          role="listbox"
          aria-label="Select theme"
          data-testid="theme-switcher-dropdown"
        >
          {themeIds.map((id, idx) => {
            const t = themes[id]!;
            const isActive = id === themeId;
            return (
              <button
                key={id}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => selectTheme(id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors outline-none ${
                  isActive
                    ? 'bg-[hsl(var(--highlight-med))] text-[hsl(var(--text))] font-medium'
                    : focusIndex === idx
                      ? 'bg-[hsl(var(--highlight-low))] text-[hsl(var(--text))]'
                      : 'text-[hsl(var(--text))] hover:bg-[hsl(var(--highlight-low))]'
                }`}
                data-testid={`theme-switcher-option-${id}`}
              >
                {/* Color swatch preview: 5 circles */}
                <span className="inline-flex gap-1 shrink-0">
                  {SWATCH_KEYS.map((key) => (
                    <span
                      key={key}
                      className="w-4 h-4 rounded-full border border-[hsl(var(--border))]"
                      style={{ backgroundColor: `hsl(${t.colors[key]})` }}
                    />
                  ))}
                </span>

                {/* Theme name */}
                <span className="flex-1 text-left truncate">{t.name}</span>

                {/* Active indicator */}
                {isActive && <Check className="w-4 h-4 text-[hsl(var(--primary))] shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
