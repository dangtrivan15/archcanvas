/**
 * File menu component - New, Open, Save, Save As, Export sub-menu.
 */

import { useState, useRef, useEffect } from 'react';
import { File, FolderOpen, Save, Download, ChevronDown, FilePlus, Image, FileImage, FileText, GitBranch, Loader2, Check } from 'lucide-react';
import { useCoreStore } from '@/store/coreStore';
import { useUIStore } from '@/store/uiStore';
import { useNavigationStore } from '@/store/navigationStore';
import { usePlatformModifier } from '@/hooks/usePlatformModifier';

export function FileMenu({ compact = false }: { compact?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showExportSub, setShowExportSub] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const newFile = useCoreStore((s) => s.newFile);
  const openFile = useCoreStore((s) => s.openFile);
  const saveFile = useCoreStore((s) => s.saveFile);
  const saveFileAs = useCoreStore((s) => s.saveFileAs);
  const exportApi = useCoreStore((s) => s.exportApi);
  const graph = useCoreStore((s) => s.graph);
  const fileName = useCoreStore((s) => s.fileName);
  const isDirty = useCoreStore((s) => s.isDirty);
  const isSaving = useCoreStore((s) => s.isSaving);
  const openUnsavedChangesDialog = useUIStore((s) => s.openUnsavedChangesDialog);
  const autosaveOnBlur = useUIStore((s) => s.autosaveOnBlur);
  const setAutosaveOnBlur = useUIStore((s) => s.setAutosaveOnBlur);
  const zoomToRoot = useNavigationStore((s) => s.zoomToRoot);
  const { formatBinding } = usePlatformModifier();

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowExportSub(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setShowExportSub(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  const doNewFile = () => {
    newFile();
    zoomToRoot();
  };

  const handleNew = () => {
    setIsOpen(false);
    if (isDirty) {
      openUnsavedChangesDialog({ onConfirm: doNewFile });
    } else {
      doNewFile();
    }
  };

  const handleOpen = async () => {
    setIsOpen(false);
    await openFile();
  };

  const handleSave = async () => {
    setIsOpen(false);
    await saveFile();
  };

  const handleSaveAs = async () => {
    setIsOpen(false);
    await saveFileAs();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center gap-1 px-2 py-1.5 text-sm rounded hover:bg-[hsl(var(--muted))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 touch-target"
        aria-haspopup="true"
        aria-expanded={isOpen}
        data-testid="file-menu-button"
      >
        <File className="w-4 h-4" />
        {!compact && <span>File</span>}
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 w-56 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-md shadow-lg py-1 z-50"
          role="menu"
          data-testid="file-menu-dropdown"
        >
          <button
            onClick={handleNew}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors text-left touch-target-row"
            role="menuitem"
          >
            <FilePlus className="w-4 h-4" />
            <span>New</span>
            <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">{formatBinding('mod+n')}</span>
          </button>
          <button
            onClick={handleOpen}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors text-left touch-target-row"
            role="menuitem"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Open...</span>
            <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">{formatBinding('mod+o')}</span>
          </button>
          <div className="h-px bg-[hsl(var(--border))] my-1" />
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors text-left touch-target-row ${
              isSaving
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-[hsl(var(--muted))]'
            }`}
            role="menuitem"
            data-testid="save-button"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
            <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">{formatBinding('mod+s')}</span>
          </button>
          <button
            onClick={handleSaveAs}
            disabled={isSaving}
            className={`flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors text-left touch-target-row ${
              isSaving
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-[hsl(var(--muted))]'
            }`}
            role="menuitem"
            data-testid="save-as-button"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isSaving ? 'Saving...' : 'Save As...'}</span>
            <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">{formatBinding('mod+shift+s')}</span>
          </button>
          <div className="h-px bg-[hsl(var(--border))] my-1" />
          <div
            className="relative"
            onMouseEnter={() => setShowExportSub(true)}
            onMouseLeave={() => setShowExportSub(false)}
          >
            <button
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors text-left touch-target-row"
              role="menuitem"
              data-testid="export-menu-button"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
              <ChevronDown className="w-3 h-3 ml-auto -rotate-90" />
            </button>
            {showExportSub && (
              <div
                className="absolute left-full top-0 ml-1 w-48 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-md shadow-lg py-1 z-50"
                role="menu"
                data-testid="export-submenu"
              >
                <button
                  onClick={async () => {
                    setIsOpen(false);
                    setShowExportSub(false);
                    if (exportApi) {
                      await exportApi.exportToPng(fileName);
                    }
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors text-left touch-target-row"
                  role="menuitem"
                  data-testid="export-png-button"
                >
                  <Image className="w-4 h-4" />
                  <span>PNG</span>
                </button>
                <button
                  onClick={async () => {
                    setIsOpen(false);
                    setShowExportSub(false);
                    if (exportApi) {
                      await exportApi.exportToSvg(fileName);
                    }
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors text-left touch-target-row"
                  role="menuitem"
                  data-testid="export-svg-button"
                >
                  <FileImage className="w-4 h-4" />
                  <span>SVG</span>
                </button>
                <div className="h-px bg-[hsl(var(--border))] my-1" />
                <button
                  onClick={async () => {
                    setIsOpen(false);
                    setShowExportSub(false);
                    if (exportApi) {
                      await exportApi.exportToMarkdown(graph, fileName);
                    }
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors text-left touch-target-row"
                  role="menuitem"
                  data-testid="export-markdown-button"
                >
                  <FileText className="w-4 h-4" />
                  <span>Markdown</span>
                </button>
                <button
                  onClick={async () => {
                    setIsOpen(false);
                    setShowExportSub(false);
                    if (exportApi) {
                      await exportApi.exportToMermaid(graph, fileName);
                    }
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors text-left touch-target-row"
                  role="menuitem"
                  data-testid="export-mermaid-button"
                >
                  <GitBranch className="w-4 h-4" />
                  <span>Mermaid</span>
                </button>
              </div>
            )}
          </div>
          <div className="h-px bg-[hsl(var(--border))] my-1" />
          <button
            onClick={() => setAutosaveOnBlur(!autosaveOnBlur)}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors text-left touch-target-row"
            role="menuitemcheckbox"
            aria-checked={autosaveOnBlur}
            data-testid="autosave-toggle"
          >
            <span className="w-4 h-4 flex items-center justify-center">
              {autosaveOnBlur && <Check className="w-3.5 h-3.5" />}
            </span>
            <span>Autosave on blur</span>
          </button>
        </div>
      )}
    </div>
  );
}
