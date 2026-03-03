/**
 * CommandPalette - searchable command overlay triggered by Cmd+K / Ctrl+K.
 * Provides quick access to all available actions, navigation, and node search.
 * Similar to VS Code's command palette or Spotlight.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, Box } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { getAllCommands, searchCommands, type Command, type CommandCategory } from '@/config/commandRegistry';
import { iconMap } from '@/components/nodes/GenericNode';

/** Category badge colors */
const CATEGORY_COLORS: Record<CommandCategory, string> = {
  File: 'bg-blue-100 text-blue-700',
  Edit: 'bg-amber-100 text-amber-700',
  View: 'bg-purple-100 text-purple-700',
  Canvas: 'bg-emerald-100 text-emerald-700',
  Navigation: 'bg-rose-100 text-rose-700',
  Node: 'bg-cyan-100 text-cyan-700',
};

export function CommandPalette() {
  const open = useUIStore((s) => s.commandPaletteOpen);
  const closePalette = useUIStore((s) => s.closeCommandPalette);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(open);

  // Get all commands when the palette opens
  const allCommands = useMemo(() => {
    if (!open) return [];
    return getAllCommands();
  }, [open]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    return searchCommands(allCommands, query);
  }, [allCommands, query]);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      // Focus the search input after a brief delay for the DOM to render
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Keep selected index in bounds
  useEffect(() => {
    if (selectedIndex >= filteredCommands.length) {
      setSelectedIndex(Math.max(0, filteredCommands.length - 1));
    }
  }, [filteredCommands.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Execute the selected command
  const executeCommand = useCallback((cmd: Command) => {
    closePalette();
    // Execute after closing to avoid state conflicts
    requestAnimationFrame(() => {
      cmd.execute();
    });
  }, [closePalette]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          break;

        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            const cmd = filteredCommands[selectedIndex];
            if (!cmd.isEnabled || cmd.isEnabled()) {
              executeCommand(cmd);
            }
          }
          break;

        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          closePalette();
          break;
      }
    },
    [filteredCommands, selectedIndex, executeCommand, closePalette]
  );

  // Global Escape handler (capture phase to intercept before other handlers)
  useEffect(() => {
    if (!open) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closePalette();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [open, closePalette]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        closePalette();
      }
    },
    [closePalette]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-start justify-center pt-[15vh] bg-black/40"
      onClick={handleBackdropClick}
      data-testid="command-palette-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        ref={focusTrapRef}
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col overflow-hidden border border-gray-200"
        data-testid="command-palette"
        role="combobox"
        aria-expanded="true"
        aria-haspopup="listbox"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            data-testid="command-palette-input"
            aria-label="Search commands"
            aria-autocomplete="list"
            aria-controls="command-palette-list"
            aria-activedescendant={
              filteredCommands[selectedIndex]
                ? `command-item-${filteredCommands[selectedIndex].id}`
                : undefined
            }
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded">
            Esc
          </kbd>
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          className="overflow-y-auto max-h-[300px] py-1"
          id="command-palette-list"
          role="listbox"
          aria-label="Commands"
          data-testid="command-palette-list"
        >
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400" data-testid="command-palette-empty">
              No commands found
            </div>
          ) : (
            filteredCommands.map((cmd, index) => {
              const isDisabled = cmd.isEnabled ? !cmd.isEnabled() : false;
              const isSelected = index === selectedIndex;

              return (
                <div
                  key={cmd.id}
                  id={`command-item-${cmd.id}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={isDisabled}
                  className={`
                    flex items-center justify-between px-4 py-2 cursor-pointer transition-colors
                    ${isSelected ? 'bg-blue-50 text-blue-900' : 'text-gray-700 hover:bg-gray-50'}
                    ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  onClick={() => {
                    if (!isDisabled) {
                      executeCommand(cmd);
                    }
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  data-testid={`command-item-${cmd.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Category badge */}
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${CATEGORY_COLORS[cmd.category]}`}
                    >
                      {cmd.category}
                    </span>
                    {/* Node type icon (for creation commands) */}
                    {cmd.iconName && (() => {
                      const IconComponent = iconMap[cmd.iconName!] ?? Box;
                      return (
                        <IconComponent
                          className="w-4 h-4 shrink-0 text-gray-500"
                          data-testid={`command-icon-${cmd.id}`}
                        />
                      );
                    })()}
                    {/* Command label */}
                    <span className="text-sm truncate">{cmd.label}</span>
                  </div>

                  {/* Shortcut hint */}
                  {cmd.shortcut && (
                    <kbd
                      className="ml-2 shrink-0 inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded"
                      data-testid={`command-shortcut-${cmd.id}`}
                    >
                      {cmd.shortcut}
                    </kbd>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t flex items-center gap-4 text-[10px] text-gray-400">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded font-mono">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded font-mono">↵</kbd>
            execute
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded font-mono">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
}
