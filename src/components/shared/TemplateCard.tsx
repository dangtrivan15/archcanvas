/**
 * TemplateCard - displays a single template in the gallery grid.
 * Shows icon, name, description snippet, domain badge, node count,
 * and a visual indicator for built-in vs imported templates.
 */

import {
  Rocket, Layers, MessageSquare, MessageCircle, Brain, Smartphone,
  Zap, BarChart3, Network, HeartPulse, Users, Wrench, ShoppingCart,
  Landmark, Radio, FileBox,
} from 'lucide-react';
import type { TemplateMetadata } from '@/templates/types';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Rocket,
  Layers,
  MessageSquare,
  MessageCircle,
  Brain,
  Smartphone,
  Zap,
  BarChart3,
  Network,
  HeartPulse,
  Users,
  Wrench,
  ShoppingCart,
  Landmark,
  Radio,
  FileBox,
};

interface TemplateCardProps {
  metadata: TemplateMetadata;
  onClick?: () => void;
}

export function TemplateCard({ metadata, onClick }: TemplateCardProps) {
  const IconComponent = ICON_MAP[metadata.icon] || Rocket;
  const isImported = metadata.source === 'imported';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-4 rounded-lg border border-[hsl(var(--border))] hover:border-blue-400 hover:bg-[hsl(var(--muted)/0.3)] transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
      data-testid={`template-card-${metadata.id}`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50 transition-colors">
          <IconComponent className="w-5 h-5 text-blue-600" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Name */}
          <div className="font-medium text-[hsl(var(--foreground))] text-sm leading-tight truncate">
            {metadata.name}
          </div>

          {/* Description snippet */}
          <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1 line-clamp-2">
            {metadata.description}
          </div>

          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {/* Domain badge */}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium uppercase tracking-wide">
              {metadata.category}
            </span>

            {/* Node count */}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {metadata.nodeCount} nodes
            </span>

            {/* Edge count */}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              {metadata.edgeCount} edges
            </span>

            {/* Source indicator */}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                isImported
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}
              data-testid={`template-source-${metadata.id}`}
            >
              {isImported ? 'Imported' : 'Built-in'}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
