/**
 * ImportTemplateDialog - modal for editing name/category before saving an imported .archc template.
 */

import { useState } from 'react';
import { Upload, X } from 'lucide-react';

const CATEGORIES = ['general', 'ai-ml', 'cloud-native', 'enterprise', 'consumer', 'data'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  'ai-ml': 'AI/ML',
  'cloud-native': 'Cloud-native',
  enterprise: 'Enterprise',
  consumer: 'Consumer',
  data: 'Data',
};

interface ImportTemplateDialogProps {
  /** Pre-filled name from the Architecture.name */
  defaultName: string;
  /** Node count from the deserialized architecture */
  nodeCount: number;
  /** Edge count from the deserialized architecture */
  edgeCount: number;
  /** Called with the user's chosen name and category */
  onConfirm: (name: string, category: string) => void;
  /** Called when user cancels */
  onCancel: () => void;
}

export function ImportTemplateDialog({
  defaultName,
  nodeCount,
  edgeCount,
  onConfirm,
  onCancel,
}: ImportTemplateDialogProps) {
  const [name, setName] = useState(defaultName || 'Imported Template');
  const [category, setCategory] = useState<string>('general');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed, category);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      data-testid="import-template-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-template-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="bg-background border border-border rounded-lg shadow-xl w-[420px] max-w-[90vw]"
        data-testid="import-template-dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-iris" />
            <h3 id="import-template-title" className="text-sm font-semibold text-foreground">Import Template</h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded hover:bg-muted transition-colors"
            aria-label="Cancel import"
            data-testid="import-template-cancel-x"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Template name */}
          <div>
            <label
              htmlFor="import-template-name"
              className="block text-xs font-medium text-foreground mb-1"
            >
              Template Name
            </label>
            <input
              id="import-template-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="import-template-name-input"
              autoFocus
              maxLength={100}
            />
          </div>

          {/* Category select */}
          <div>
            <label
              htmlFor="import-template-category"
              className="block text-xs font-medium text-foreground mb-1"
            >
              Category
            </label>
            <select
              id="import-template-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="import-template-category-select"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>

          {/* Info */}
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="px-2 py-1 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {nodeCount} nodes
            </span>
            <span className="px-2 py-1 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              {edgeCount} edges
            </span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm rounded-md border border-border text-foreground hover:bg-muted transition-colors"
              data-testid="import-template-cancel-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 text-sm rounded-md bg-iris text-white hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="import-template-confirm-btn"
            >
              Import
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
