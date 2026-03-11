/**
 * NodeBadges - Compact pill-shaped badges with Lucide icons for node footer counts.
 * Replaces emoji-based text badges (📝, 📎) with styled pill badges.
 * Each badge type has a distinct muted color. Badges only render when count > 0.
 */
import React from 'react';
import { MessageSquare, FileCode } from 'lucide-react';

interface NodeBadgesProps {
  noteCount: number;
  codeRefCount: number;
  className?: string;
  /** Optional color for the top divider line (hex with alpha, e.g. '#3B82F620') */
  dividerColor?: string;
}

interface BadgeConfig {
  count: number;
  icon: React.ElementType;
  label: string;
  testId: string;
  bgColor: string;
  textColor: string;
}

export function NodeBadges({
  noteCount,
  codeRefCount,
  className = '',
  dividerColor,
}: NodeBadgesProps) {
  const badges: BadgeConfig[] = [
    {
      count: noteCount,
      icon: MessageSquare,
      label: 'notes',
      testId: 'badge-notes',
      bgColor: 'bg-blue-500/15',
      textColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      count: codeRefCount,
      icon: FileCode,
      label: 'code references',
      testId: 'badge-coderefs',
      bgColor: 'bg-emerald-500/15',
      textColor: 'text-emerald-600 dark:text-emerald-400',
    },
  ];

  const visibleBadges = badges.filter((b) => b.count > 0);
  if (visibleBadges.length === 0) return null;

  return (
    <div
      className={`flex items-center gap-1.5 ${className}`}
      style={dividerColor ? { borderTop: `1px solid ${dividerColor}` } : undefined}
      data-testid="node-badges"
    >
      {visibleBadges.map(({ count, icon: Icon, label, testId, bgColor, textColor }) => (
        <span
          key={testId}
          className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-medium ${bgColor} ${textColor}`}
          title={`${count} ${label}`}
          data-testid={testId}
        >
          <Icon className="w-3 h-3 shrink-0" />
          {count}
        </span>
      ))}
    </div>
  );
}
