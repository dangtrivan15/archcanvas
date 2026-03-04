/**
 * CmdKeyShortcutsOverlay - iPadOS-style keyboard shortcuts cheat sheet.
 *
 * Appears when the user holds the Cmd key for 1 second on an iPad or Mac
 * with an external keyboard. Mimics the native iPadOS shortcut discovery
 * overlay: dark translucent background, grid layout, grouped by category.
 *
 * Dismisses automatically when Cmd is released or another key is pressed.
 */

import {
  SHORTCUT_CATEGORIES,
  getShortcutsByCategory,
  getShortcutKeys,
  type ShortcutCategory,
} from '@/config/keyboardShortcuts';
import { useCmdKeyHold } from '@/hooks/useCmdKeyHold';

/** Category colors matching iPadOS overlay style (muted, dark-theme compatible) */
const CATEGORY_COLORS: Record<ShortcutCategory, string> = {
  File: 'text-blue-300',
  Edit: 'text-amber-300',
  View: 'text-cyan-300',
  Canvas: 'text-emerald-300',
  Navigation: 'text-purple-300',
  'Quick Create': 'text-rose-300',
};

export function CmdKeyShortcutsOverlay() {
  const visible = useCmdKeyHold();

  if (!visible) return null;

  const groupedShortcuts = getShortcutsByCategory();

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
      data-testid="cmd-key-shortcuts-overlay"
      role="tooltip"
      aria-label="Keyboard shortcuts overlay"
    >
      {/* Dark translucent backdrop matching iPadOS style */}
      <div
        className="bg-black/75 backdrop-blur-xl rounded-2xl shadow-2xl max-w-3xl w-[90vw] max-h-[80vh] overflow-y-auto p-6 animate-in fade-in duration-200"
        data-testid="cmd-key-shortcuts-content"
      >
        {/* Title */}
        <h2 className="text-white/90 text-sm font-semibold uppercase tracking-wider text-center mb-5">
          Keyboard Shortcuts
        </h2>

        {/* Grid of categories */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
          {SHORTCUT_CATEGORIES.map((category) => {
            const shortcuts = groupedShortcuts.get(category);
            if (!shortcuts || shortcuts.length === 0) return null;

            const categoryColor = CATEGORY_COLORS[category];

            return (
              <div key={category} data-testid={`cmd-overlay-category-${category.toLowerCase().replace(' ', '-')}`}>
                {/* Category heading */}
                <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${categoryColor}`}>
                  {category}
                </h3>

                {/* Shortcut rows */}
                <div className="space-y-1.5">
                  {shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="text-white/70 text-xs truncate">
                        {shortcut.description}
                      </span>
                      <kbd className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] font-mono font-medium text-white/90 bg-white/15 border border-white/20 rounded-md min-w-[2rem] justify-center whitespace-nowrap">
                        {getShortcutKeys(shortcut)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <p className="text-white/40 text-[10px] text-center mt-5 uppercase tracking-wider">
          Hold ⌘ to show • Release to dismiss
        </p>
      </div>
    </div>
  );
}
