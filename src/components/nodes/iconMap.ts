import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowRightLeft,
  Bell,
  Bot,
  Boxes,
  Brain,
  Clock,
  Cloud,
  Cog,
  Container,
  Database,
  ExternalLink,
  FileText,
  GitBranch,
  Globe,
  HardDrive,
  Layers,
  Lock,
  MemoryStick,
  MessageSquare,
  Monitor,
  Radio,
  Route,
  Scale,
  Search,
  Server,
  Shield,
  ShieldCheck,
  Smartphone,
  Terminal,
  Webhook,
  Zap,
} from 'lucide-react';

/**
 * Map from Lucide icon component names (as used in NodeDef YAML `icon` field)
 * to the actual React component. Keep sorted alphabetically for maintainability.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  Activity,
  ArrowRightLeft,
  Bell,
  Bot,
  Boxes,
  Brain,
  Clock,
  Cloud,
  Cog,
  Container,
  Database,
  ExternalLink,
  FileText,
  GitBranch,
  Globe,
  HardDrive,
  Layers,
  Lock,
  MemoryStick,
  MessageSquare,
  Monitor,
  Radio,
  Route,
  Scale,
  Search,
  Server,
  Shield,
  ShieldCheck,
  Smartphone,
  Terminal,
  Webhook,
  Zap,
};

/**
 * Resolve a Lucide icon name string to the actual React component.
 * Returns null if the name is undefined or not in the map.
 */
export function resolveIcon(name: string | undefined): LucideIcon | null {
  if (!name) return null;
  return ICON_MAP[name] ?? null;
}
