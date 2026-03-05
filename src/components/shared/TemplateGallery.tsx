/**
 * Template Gallery Panel - displays all available templates (built-in + imported)
 * as a responsive grid of cards with category filter tabs and search.
 */

import { useState, useEffect, useMemo } from 'react';
import { X, Search, LayoutGrid } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { getAllTemplates } from '@/templates/registry';
import type { TemplateMetadata, TemplateRecord } from '@/templates/types';
import { TemplateCard } from './TemplateCard';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useNavigationStore } from '@/store/navigationStore';
import { instantiateStack, type StackTemplate } from '@/stacks/stackLoader';
import { parse as parseYaml } from 'yaml';

/**
 * Category filter definitions.
 * Tags from YAML templates are mapped to these gallery categories.
 */
const CATEGORY_TABS = [
  { id: 'all', label: 'All' },
  { id: 'general', label: 'General' },
  { id: 'ai-ml', label: 'AI/ML' },
  { id: 'cloud-native', label: 'Cloud-native' },
  { id: 'enterprise', label: 'Enterprise' },
  { id: 'consumer', label: 'Consumer' },
  { id: 'data', label: 'Data' },
] as const;

type CategoryId = (typeof CATEGORY_TABS)[number]['id'];

/** Map template tags to gallery categories */
const TAG_TO_CATEGORY: Record<string, CategoryId> = {
  // General
  saas: 'general',
  starter: 'general',
  fullstack: 'general',
  production: 'general',
  'full-stack': 'general',
  // AI/ML
  ai: 'ai-ml',
  ml: 'ai-ml',
  rag: 'ai-ml',
  chatbot: 'ai-ml',
  llm: 'ai-ml',
  mlops: 'ai-ml',
  'model-serving': 'ai-ml',
  AI: 'ai-ml',
  // Cloud-native
  microservices: 'cloud-native',
  kubernetes: 'cloud-native',
  serverless: 'cloud-native',
  'event-driven': 'cloud-native',
  aws: 'cloud-native',
  lambda: 'cloud-native',
  devops: 'cloud-native',
  'platform-engineering': 'cloud-native',
  GitOps: 'cloud-native',
  // Enterprise
  enterprise: 'enterprise',
  CRM: 'enterprise',
  'multi-tenant': 'enterprise',
  fintech: 'enterprise',
  banking: 'enterprise',
  payments: 'enterprise',
  PCI: 'enterprise',
  healthcare: 'enterprise',
  HIPAA: 'enterprise',
  FHIR: 'enterprise',
  // Consumer
  social: 'consumer',
  mobile: 'consumer',
  'e-commerce': 'consumer',
  marketplace: 'consumer',
  flutter: 'consumer',
  backend: 'consumer',
  firebase: 'consumer',
  'real-time': 'consumer',
  // Data
  data: 'data',
  analytics: 'data',
  'data-engineering': 'data',
  kafka: 'data',
  flink: 'data',
  IoT: 'data',
  telemetry: 'data',
  observability: 'data',
};

/**
 * Get the best-matching gallery category for a template based on its tags.
 * Uses the first tag that maps to a known category.
 */
function getTemplateCategory(metadata: TemplateMetadata): CategoryId {
  const tags = metadata.tags ?? [metadata.category];
  for (const tag of tags) {
    const cat = TAG_TO_CATEGORY[tag];
    if (cat) return cat;
  }
  return 'general';
}

export function TemplateGallery() {
  const templateGalleryOpen = useUIStore((s) => s.templateGalleryOpen);
  const closeTemplateGallery = useUIStore((s) => s.closeTemplateGallery);

  if (!templateGalleryOpen) return null;

  return <TemplateGalleryContent onClose={closeTemplateGallery} />;
}

function TemplateGalleryContent({ onClose }: { onClose: () => void }) {
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryId>('all');

  const _setGraph = useCoreStore((s) => s._setGraph);
  const textApi = useCoreStore((s) => s.textApi);
  const undoManager = useCoreStore((s) => s.undoManager);
  const requestFitView = useCanvasStore((s) => s.requestFitView);
  const showToast = useUIStore((s) => s.showToast);
  const zoomToRoot = useNavigationStore((s) => s.zoomToRoot);

  // Load templates on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAllTemplates().then((all) => {
      if (!cancelled) {
        setTemplates(all);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Filter templates by category and search query
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      // Category filter
      if (activeCategory !== 'all') {
        const cat = getTemplateCategory(t.metadata);
        if (cat !== activeCategory) return false;
      }

      // Search filter (match against name)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = t.metadata.name.toLowerCase().includes(q);
        const descMatch = t.metadata.description.toLowerCase().includes(q);
        const tagMatch = (t.metadata.tags ?? []).some((tag) =>
          tag.toLowerCase().includes(q),
        );
        if (!nameMatch && !descMatch && !tagMatch) return false;
      }

      return true;
    });
  }, [templates, activeCategory, searchQuery]);

  // Count per category for badge display
  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryId, number> = {
      all: templates.length,
      general: 0,
      'ai-ml': 0,
      'cloud-native': 0,
      enterprise: 0,
      consumer: 0,
      data: 0,
    };
    for (const t of templates) {
      const cat = getTemplateCategory(t.metadata);
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [templates]);

  const handleSelectTemplate = (record: TemplateRecord) => {
    if (!textApi || !undoManager) return;

    // Parse the template data into a StackTemplate
    let stack: StackTemplate;
    if (typeof record.data === 'string') {
      // Built-in: raw YAML string
      const parsed = parseYaml(record.data) as {
        metadata: StackTemplate['metadata'];
        nodes: StackTemplate['nodes'];
        edges: StackTemplate['edges'];
      };
      stack = {
        metadata: parsed.metadata,
        nodes: parsed.nodes || [],
        edges: parsed.edges || [],
      };
    } else {
      // Imported: would need proto deserialization - for now show toast
      showToast('Imported template loading is not yet supported');
      return;
    }

    const graph = instantiateStack(stack);

    textApi.setGraph(graph);
    undoManager.clear();
    undoManager.snapshot('Load stack template', graph);

    useCoreStore.setState({
      graph,
      isDirty: true,
      fileName: stack.metadata.displayName,
      fileHandle: null,
      fileCreatedAtMs: null,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      canUndo: false,
      canRedo: false,
    });

    zoomToRoot();
    requestFitView();
    showToast(`Loaded "${stack.metadata.displayName}" template`);
    onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      data-testid="template-gallery-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg shadow-xl w-[800px] max-w-[95vw] max-h-[85vh] flex flex-col"
        data-testid="template-gallery-dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
              Template Gallery
            </h2>
            <span className="text-xs text-[hsl(var(--muted-foreground))] ml-1">
              {templates.length} templates
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[hsl(var(--muted))] transition-colors"
            aria-label="Close template gallery"
            data-testid="template-gallery-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-5 py-3 border-b border-[hsl(var(--border))]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              placeholder="Search templates by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              data-testid="template-gallery-search"
              autoFocus
            />
          </div>
        </div>

        {/* Category filter tabs */}
        <div className="px-5 py-2 border-b border-[hsl(var(--border))] flex gap-1 overflow-x-auto">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                activeCategory === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]'
              }`}
              data-testid={`template-gallery-tab-${tab.id}`}
            >
              {tab.label}
              {categoryCounts[tab.id] > 0 && (
                <span className={`ml-1.5 ${activeCategory === tab.id ? 'text-blue-200' : 'text-[hsl(var(--muted-foreground))]'}`}>
                  ({categoryCounts[tab.id]})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Template grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-[hsl(var(--muted-foreground))]" data-testid="template-gallery-loading">
              Loading templates...
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="template-gallery-empty">
              <LayoutGrid className="w-10 h-10 text-[hsl(var(--muted-foreground))] mb-3 opacity-40" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {searchQuery.trim()
                  ? `No templates match "${searchQuery}"`
                  : activeCategory !== 'all'
                    ? `No templates in this category`
                    : 'No templates available'}
              </p>
              {(searchQuery.trim() || activeCategory !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategory('all');
                  }}
                  className="mt-2 text-xs text-blue-600 hover:underline"
                  data-testid="template-gallery-clear-filters"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              data-testid="template-gallery-grid"
            >
              {filteredTemplates.map((record) => (
                <TemplateCard
                  key={record.metadata.id}
                  metadata={record.metadata}
                  onClick={() => handleSelectTemplate(record)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
