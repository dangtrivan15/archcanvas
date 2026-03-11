/**
 * QuickSearchOverlay - Vim-style '/' search for quick node navigation.
 * Minimal floating input at top-center of canvas.
 * Fuzzy-searches node displayNames, shows top 8 results,
 * arrow-navigates, Enter jumps to node (select + pan to center).
 * Supports 'n'/'N' for next/previous match after closing.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, Box } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useGraphStore } from '@/store/graphStore';
import { useEngineStore } from '@/store/engineStore';
import { iconMap } from '@/components/nodes/GenericNode';
import type { ArchNode } from '@/types/graph';

/** Maximum number of results to display */
const MAX_RESULTS = 8;

/** Search result with match indices for highlighting */
interface SearchResult {
  node: ArchNode;
  /** Indices of matching characters in displayName */
  matchIndices: number[];
  /** Score for ranking (higher = better match) */
  score: number;
  /** Parent context string (e.g., "in GroupNode") */
  parentContext: string;
}

/**
 * Collect all nodes recursively, tracking parent context.
 */
function collectAllNodes(
  nodes: ArchNode[],
  parentName?: string,
): { node: ArchNode; parentContext: string }[] {
  const result: { node: ArchNode; parentContext: string }[] = [];
  for (const node of nodes) {
    const context = parentName ? `in ${parentName}` : '';
    result.push({ node, parentContext: context });
    if (node.children.length > 0) {
      result.push(...collectAllNodes(node.children, node.displayName));
    }
  }
  return result;
}

/**
 * Fuzzy match: find matching character indices in text for the query.
 * Returns null if no match, or { indices, score } if matched.
 * Consecutive matches score higher. Earlier matches score higher.
 */
function fuzzyMatch(text: string, query: string): { indices: number[]; score: number } | null {
  if (!query) return { indices: [], score: 0 };

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Exact match check first
  const exactIndex = lowerText.indexOf(lowerQuery);
  if (exactIndex !== -1) {
    const indices = Array.from({ length: query.length }, (_, i) => exactIndex + i);
    // Exact match at start = highest score
    const score = exactIndex === 0 ? 1000 : 800 - exactIndex;
    return { indices, score };
  }

  // Fuzzy match: each query char must appear in order
  const indices: number[] = [];
  let queryIdx = 0;
  let lastMatchIdx = -1;
  let consecutiveBonus = 0;

  for (let i = 0; i < lowerText.length && queryIdx < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIdx]) {
      indices.push(i);
      if (i === lastMatchIdx + 1) {
        consecutiveBonus += 10;
      }
      lastMatchIdx = i;
      queryIdx++;
    }
  }

  if (queryIdx !== lowerQuery.length) return null;

  // Score: penalize gaps, reward early and consecutive matches
  const firstMatchPenalty = indices[0] ?? 0;
  const gapPenalty = indices.reduce((sum, idx, i) => {
    if (i === 0) return 0;
    return sum + (idx - (indices[i - 1] ?? 0) - 1);
  }, 0);

  const score = 500 - firstMatchPenalty * 5 - gapPenalty * 3 + consecutiveBonus;
  return { indices, score };
}

/**
 * Get the icon name for a node type from the NodeDef registry.
 */
function getNodeIconName(nodeType: string): string | undefined {
  const { registry } = useEngineStore.getState();
  if (!registry) return undefined;
  const nodeDef = registry.resolve(nodeType);
  return nodeDef?.metadata?.icon;
}

/**
 * Render node displayName with matching characters bolded.
 */
function HighlightedName({ name, matchIndices }: { name: string; matchIndices: number[] }) {
  if (matchIndices.length === 0) {
    return <span>{name}</span>;
  }

  const matchSet = new Set(matchIndices);
  const parts: { text: string; highlighted: boolean }[] = [];
  let currentText = '';
  let currentHighlighted = matchSet.has(0);

  for (let i = 0; i < name.length; i++) {
    const isMatch = matchSet.has(i);
    if (isMatch !== currentHighlighted) {
      if (currentText) {
        parts.push({ text: currentText, highlighted: currentHighlighted });
      }
      currentText = name[i]!;
      currentHighlighted = isMatch;
    } else {
      currentText += name[i];
    }
  }
  if (currentText) {
    parts.push({ text: currentText, highlighted: currentHighlighted });
  }

  return (
    <span>
      {parts.map((part, i) =>
        part.highlighted ? (
          <span key={i} className="font-bold text-blue-600">
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </span>
  );
}

/** Store last search results for n/N navigation */
let _lastSearchResults: SearchResult[] = [];
let _lastSelectedIndex = 0;

export function QuickSearchOverlay() {
  const open = useUIStore((s) => s.quickSearchOpen);
  const closeSearch = useUIStore((s) => s.closeQuickSearch);
  const graph = useGraphStore((s) => s.graph);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const requestCenterOnNode = useCanvasStore((s) => s.requestCenterOnNode);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Collect all nodes from graph
  const allNodes = useMemo(() => {
    if (!open) return [];
    return collectAllNodes(graph.nodes);
  }, [open, graph.nodes]);

  // Fuzzy search results
  const results = useMemo((): SearchResult[] => {
    if (!query.trim()) {
      // No query: show all nodes (up to MAX_RESULTS)
      return allNodes.slice(0, MAX_RESULTS).map(({ node, parentContext }) => ({
        node,
        matchIndices: [],
        score: 0,
        parentContext,
      }));
    }

    const matches: SearchResult[] = [];
    for (const { node, parentContext } of allNodes) {
      const match = fuzzyMatch(node.displayName, query);
      if (match) {
        matches.push({
          node,
          matchIndices: match.indices,
          score: match.score,
          parentContext,
        });
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, MAX_RESULTS);
  }, [allNodes, query]);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Keep selected index in bounds
  useEffect(() => {
    if (selectedIndex >= results.length) {
      setSelectedIndex(Math.max(0, results.length - 1));
    }
  }, [results.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Jump to a node: select, center, close
  const jumpToNode = useCallback(
    (nodeId: string) => {
      // Store results for n/N navigation
      _lastSearchResults = results;
      _lastSelectedIndex = results.findIndex((r) => r.node.id === nodeId);

      closeSearch();
      selectNode(nodeId);
      requestCenterOnNode(nodeId);
      useUIStore.getState().openRightPanel('properties');
    },
    [closeSearch, selectNode, requestCenterOnNode, results],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
          break;

        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            jumpToNode(results[selectedIndex].node.id);
          }
          break;

        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          // Store results for n/N even if no selection was made
          _lastSearchResults = results;
          _lastSelectedIndex = selectedIndex;
          closeSearch();
          break;
      }
    },
    [results, selectedIndex, jumpToNode, closeSearch],
  );

  // Global Escape handler (capture phase)
  useEffect(() => {
    if (!open) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        _lastSearchResults = results;
        _lastSelectedIndex = selectedIndex;
        closeSearch();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [open, closeSearch, results, selectedIndex]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-start justify-center pt-4 compact-dialog-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          _lastSearchResults = results;
          _lastSelectedIndex = selectedIndex;
          closeSearch();
        }
      }}
      data-testid="quick-search-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Quick search"
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 flex flex-col overflow-hidden border border-gray-200 compact-dialog-sheet"
        data-testid="quick-search"
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-3 py-2 border-b">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400"
            placeholder="Search nodes..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            data-testid="quick-search-input"
            aria-label="Search nodes"
            aria-autocomplete="list"
            aria-controls="quick-search-list"
            aria-activedescendant={
              results[selectedIndex]
                ? `quick-search-item-${results[selectedIndex].node.id}`
                : undefined
            }
          />
          <kbd className="inline-flex items-center px-1 py-0.5 text-[10px] font-mono text-gray-400 bg-gray-100 border border-gray-200 rounded">
            /
          </kbd>
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          className="overflow-y-auto max-h-[280px] py-1"
          id="quick-search-list"
          role="listbox"
          aria-label="Search results"
          data-testid="quick-search-list"
        >
          {results.length === 0 ? (
            <div
              className="px-4 py-6 text-center text-sm text-gray-400"
              data-testid="quick-search-empty"
            >
              No nodes found
            </div>
          ) : (
            results.map((result, index) => {
              const isSelected = index === selectedIndex;
              const iconName = getNodeIconName(result.node.type);
              const IconComponent = iconName ? (iconMap[iconName] ?? Box) : Box;

              return (
                <div
                  key={result.node.id}
                  id={`quick-search-item-${result.node.id}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  className={`
                    flex items-center gap-3 px-3 py-1.5 cursor-pointer transition-colors text-sm
                    ${isSelected ? 'bg-blue-50 text-blue-900' : 'text-gray-700 hover:bg-gray-50'}
                  `}
                  onClick={() => jumpToNode(result.node.id)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  data-testid={`quick-search-item-${index}`}
                >
                  <IconComponent className="w-4 h-4 shrink-0 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <HighlightedName
                      name={result.node.displayName}
                      matchIndices={result.matchIndices}
                    />
                    {result.parentContext && (
                      <span className="ml-1.5 text-xs text-gray-400">{result.parentContext}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0">
                    {result.node.type.split('/').pop()}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer hints */}
        <div className="px-3 py-1.5 border-t flex items-center gap-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded font-mono">
              ↑↓
            </kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded font-mono">
              ↵
            </kbd>
            jump
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded font-mono">
              esc
            </kbd>
            close
          </span>
          <span className="flex items-center gap-1 ml-auto">
            <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded font-mono">
              n
            </kbd>
            /
            <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded font-mono">
              N
            </kbd>
            next/prev
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Navigate to next match from last search (Vim 'n').
 * Called externally from keyboard handler.
 */
export function quickSearchNext(): void {
  if (_lastSearchResults.length === 0) return;
  _lastSelectedIndex = (_lastSelectedIndex + 1) % _lastSearchResults.length;
  const result = _lastSearchResults[_lastSelectedIndex];
  if (result) {
    useCanvasStore.getState().selectNode(result.node.id);
    useCanvasStore.getState().requestCenterOnNode(result.node.id);
    useUIStore.getState().openRightPanel('properties');
  }
}

/**
 * Navigate to previous match from last search (Vim 'N').
 * Called externally from keyboard handler.
 */
export function quickSearchPrev(): void {
  if (_lastSearchResults.length === 0) return;
  _lastSelectedIndex =
    (_lastSelectedIndex - 1 + _lastSearchResults.length) % _lastSearchResults.length;
  const result = _lastSearchResults[_lastSelectedIndex];
  if (result) {
    useCanvasStore.getState().selectNode(result.node.id);
    useCanvasStore.getState().requestCenterOnNode(result.node.id);
    useUIStore.getState().openRightPanel('properties');
  }
}
