/**
 * Template Gallery Panel - displays all available templates (built-in + imported)
 * as a responsive grid of cards with category filter tabs and search.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, Search, LayoutGrid, Upload } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { getAllTemplates } from '@/templates/registry';
import { saveImportedTemplate, deleteImportedTemplate } from '@/templates/storage';
import type { TemplateMetadata, TemplateRecord } from '@/templates/types';
import { TemplateCard } from './TemplateCard';
import { TemplatePreview } from './TemplatePreview';
import { UseTemplateDialog } from './UseTemplateDialog';
import { ImportTemplateDialog } from './ImportTemplateDialog';
import { isArchcFile, decode } from '@/core/storage/codec';
import { protoToGraph } from '@/core/storage/fileIO';
import type { ArchGraph } from '@/types/graph';
import { ulid } from 'ulid';
import { Architecture } from '@/proto/archcanvas';

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

/** Count nodes recursively (including children) */
function countNodes(nodes: ArchGraph['nodes']): number {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    if (node.children && node.children.length > 0) {
      count += countNodes(node.children);
    }
  }
  return count;
}

/** Pending import state: validated file data awaiting user name/category input */
interface PendingImport {
  graph: ArchGraph;
  archBytes: Uint8Array;
  nodeCount: number;
  edgeCount: number;
  defaultName: string;
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
  const [previewRecord, setPreviewRecord] = useState<TemplateRecord | null>(null);
  const [useTemplateRecord, setUseTemplateRecord] = useState<TemplateRecord | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const showToast = useUIStore((s) => s.showToast);

  // Load templates on mount + reload trigger
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAllTemplates().then((all) => {
      if (!cancelled) {
        setTemplates(all);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reloadTemplates = useCallback(() => {
    setReloadKey((k) => k + 1);
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
        const tagMatch = (t.metadata.tags ?? []).some((tag) => tag.toLowerCase().includes(q));
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

  /** Open the Use Template dialog for a given template record */
  const handleUseTemplate = (record: TemplateRecord) => {
    setUseTemplateRecord(record);
  };

  /**
   * Process an .archc file for import: validate, decode, extract metadata.
   */
  const processArchcFile = useCallback(
    async (data: Uint8Array, fileName: string) => {
      if (!isArchcFile(data)) {
        showToast('Invalid file: not a valid .archc file');
        return;
      }

      let decoded;
      try {
        decoded = await decode(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        showToast(`Import failed: ${msg}`);
        return;
      }

      const graph = protoToGraph(decoded);
      const nodeCount = countNodes(graph.nodes);
      const edgeCount = graph.edges.length;

      const archProto = decoded.architecture;
      const archBytes = Architecture.encode(Architecture.create(archProto)).finish();

      const defaultName =
        graph.name && graph.name !== 'Untitled Architecture'
          ? graph.name
          : fileName.replace(/\.archc$/, '');

      setPendingImport({ graph, archBytes, nodeCount, edgeCount, defaultName });
    },
    [showToast],
  );

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      const arrayBuffer = await file.arrayBuffer();
      await processArchcFile(new Uint8Array(arrayBuffer), file.name);
    },
    [processArchcFile],
  );

  const handleConfirmImport = useCallback(
    async (name: string, category: string) => {
      if (!pendingImport) return;
      const templateId = `imported-${ulid()}`;
      const metadata: TemplateMetadata = {
        id: templateId,
        name,
        description: `Imported architecture with ${pendingImport.nodeCount} nodes and ${pendingImport.edgeCount} edges`,
        icon: 'FileBox',
        category,
        nodeCount: pendingImport.nodeCount,
        edgeCount: pendingImport.edgeCount,
        createdAt: Date.now(),
        source: 'imported',
        tags: [category],
      };
      try {
        await saveImportedTemplate({ metadata, data: pendingImport.archBytes });
        showToast(`Imported "${name}" as template`);
        setPendingImport(null);
        reloadTemplates();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        showToast(`Failed to save template: ${msg}`);
      }
    },
    [pendingImport, showToast, reloadTemplates],
  );

  const handleDeleteTemplate = useCallback(
    async (templateId: string) => {
      try {
        await deleteImportedTemplate(templateId);
        showToast('Template deleted');
        setDeleteConfirm(null);
        reloadTemplates();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        showToast(`Failed to delete template: ${msg}`);
      }
    },
    [showToast, reloadTemplates],
  );

  // Drag-and-drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const files = e.dataTransfer.files;
      if (files.length === 0) return;
      const file = files[0];
      if (!file) return;
      if (!file.name.endsWith('.archc')) {
        showToast('Only .archc files can be imported as templates');
        return;
      }
      const arrayBuffer = await file.arrayBuffer();
      await processArchcFile(new Uint8Array(arrayBuffer), file.name);
    },
    [processArchcFile, showToast],
  );

  // Close on Escape (respecting modal hierarchy)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (pendingImport) {
          setPendingImport(null);
        } else if (deleteConfirm) {
          setDeleteConfirm(null);
        } else if (useTemplateRecord) {
          setUseTemplateRecord(null);
        } else if (previewRecord) {
          setPreviewRecord(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, pendingImport, deleteConfirm, previewRecord, useTemplateRecord]);

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        data-testid="template-gallery-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          className={`bg-[hsl(var(--background))] border rounded-lg shadow-xl w-[800px] max-w-[95vw] max-h-[85vh] flex flex-col relative transition-colors ${
            isDragOver ? 'border-blue-500 ring-2 ring-blue-400/50' : 'border-[hsl(var(--border))]'
          }`}
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
            <div className="flex items-center gap-2">
              {/* Import Template button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                data-testid="template-import-btn"
              >
                <Upload className="w-3.5 h-3.5" />
                Import Template
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".archc"
                className="hidden"
                onChange={handleFileInputChange}
                data-testid="template-import-file-input"
              />
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-[hsl(var(--muted))] transition-colors"
                aria-label="Close template gallery"
                data-testid="template-gallery-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
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
                  <span
                    className={`ml-1.5 ${activeCategory === tab.id ? 'text-blue-200' : 'text-[hsl(var(--muted-foreground))]'}`}
                  >
                    ({categoryCounts[tab.id]})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Drag-and-drop overlay */}
          {isDragOver && (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center bg-blue-600/10 rounded-lg pointer-events-none"
              data-testid="template-gallery-drop-zone"
            >
              <div className="flex flex-col items-center gap-2 p-6 rounded-lg bg-[hsl(var(--background))] border-2 border-dashed border-blue-500 shadow-lg">
                <Upload className="w-8 h-8 text-blue-600" />
                <p className="text-sm font-medium text-blue-600">
                  Drop .archc file to import as template
                </p>
              </div>
            </div>
          )}

          {/* Template grid */}
          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <div
                className="flex items-center justify-center py-12 text-[hsl(var(--muted-foreground))]"
                data-testid="template-gallery-loading"
              >
                Loading templates...
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-12 text-center"
                data-testid="template-gallery-empty"
              >
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
                    onClick={() => setPreviewRecord(record)}
                    onUseTemplate={() => handleUseTemplate(record)}
                    onDelete={
                      record.metadata.source === 'imported'
                        ? () => setDeleteConfirm(record.metadata.id)
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Template Preview Modal */}
      {previewRecord && (
        <TemplatePreview
          record={previewRecord}
          onUseTemplate={() => {
            handleUseTemplate(previewRecord);
            setPreviewRecord(null);
          }}
          onClose={() => setPreviewRecord(null)}
        />
      )}

      {/* Use Template Dialog (name prompt + instantiation) */}
      <UseTemplateDialog
        template={useTemplateRecord}
        onClose={() => setUseTemplateRecord(null)}
        onSuccess={onClose}
      />

      {/* Import dialog overlay */}
      {pendingImport && (
        <ImportTemplateDialog
          defaultName={pendingImport.defaultName}
          nodeCount={pendingImport.nodeCount}
          edgeCount={pendingImport.edgeCount}
          onConfirm={handleConfirmImport}
          onCancel={() => setPendingImport(null)}
        />
      )}

      {/* Delete confirmation overlay */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
          data-testid="template-delete-confirm-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteConfirm(null);
          }}
        >
          <div
            className="bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg shadow-xl w-[360px] max-w-[90vw] p-5"
            data-testid="template-delete-confirm-dialog"
          >
            <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-2">
              Delete Template
            </h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">
              Are you sure you want to delete this imported template? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm rounded-md border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                data-testid="template-delete-cancel-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTemplate(deleteConfirm)}
                className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
                data-testid="template-delete-confirm-btn"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
