import { useState, useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { ArchTemplate, TemplateCategory } from '@/core/templates/schema';
import { getAllTemplates, getTemplatesByCategory } from '@/core/templates/loader';
import { TemplatePreview } from '@/components/onboarding/TemplatePreview';
import { resolveIcon } from '@/components/nodes/iconMap';

// ---------------------------------------------------------------------------
// Category filter chips
// ---------------------------------------------------------------------------

const CATEGORIES: { value: TemplateCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'backend', label: 'Backend' },
  { value: 'frontend', label: 'Frontend' },
  { value: 'fullstack', label: 'Full Stack' },
  { value: 'data', label: 'Data' },
  { value: 'devops', label: 'DevOps' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TemplateGridProps {
  onSelect: (template: ArchTemplate) => void;
  selectedId?: string;
  /** Compact mode shows smaller cards (for dialogs) */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateGrid({ onSelect, selectedId, compact = false }: TemplateGridProps) {
  const [category, setCategory] = useState<TemplateCategory | 'all'>('all');
  const prefersReduced = useReducedMotion();

  const templates = useMemo(() => {
    if (category === 'all') return getAllTemplates();
    return getTemplatesByCategory(category);
  }, [category]);

  return (
    <div className="flex flex-col gap-4">
      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              category === cat.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Template cards */}
      <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-3'}`}>
        {templates.map((template, i) => {
          const Icon = resolveIcon(template.icon);
          const isSelected = selectedId === template.id;

          return (
            <motion.button
              key={template.id}
              onClick={() => onSelect(template)}
              className={`flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background hover:bg-accent hover:text-accent-foreground'
              }`}
              initial={prefersReduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: i * 0.03 }}
              whileHover={prefersReduced ? undefined : { y: -2 }}
            >
              {/* Header */}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  {Icon ? <Icon className="h-4 w-4" /> : '📐'}
                </span>
                <span className="text-sm font-semibold truncate">{template.name}</span>
              </div>

              {/* Preview */}
              <TemplatePreview
                template={template}
                className={`w-full ${compact ? 'h-16' : 'h-24'} rounded bg-muted/30`}
              />

              {/* Description */}
              <p className={`text-xs text-muted-foreground ${compact ? 'line-clamp-2' : 'line-clamp-3'}`}>
                {template.description}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1">
                {template.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </motion.button>
          );
        })}
      </div>

      {templates.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No templates in this category.
        </p>
      )}
    </div>
  );
}
