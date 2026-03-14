import { useRegistryStore } from '@/store/registryStore';
import type { OutputOptions } from '../output';
import { printSuccess } from '../output';

export interface CatalogFlags {
  namespace?: string;
}

export function catalogCommand(flags: CatalogFlags, options: OutputOptions): void {
  const allDefs = flags.namespace
    ? useRegistryStore.getState().listByNamespace(flags.namespace)
    : useRegistryStore.getState().list();

  if (options.json) {
    const nodeTypes = allDefs.map((def) => ({
      type: `${def.metadata.namespace}/${def.metadata.name}`,
      displayName: def.metadata.displayName,
      namespace: def.metadata.namespace,
      description: def.metadata.description,
      tags: def.metadata.tags ?? [],
    }));
    printSuccess({ nodeTypes }, options);
    return;
  }

  // Human-readable: group by namespace
  const grouped = new Map<string, typeof allDefs>();
  for (const def of allDefs) {
    const ns = def.metadata.namespace;
    if (!grouped.has(ns)) grouped.set(ns, []);
    grouped.get(ns)!.push(def);
  }

  const lines: string[] = [];
  for (const [ns, defs] of grouped) {
    lines.push(`\n${ns}/`);
    for (const def of defs) {
      const type = `${ns}/${def.metadata.name}`;
      const padded = type.padEnd(32);
      lines.push(`  ${padded} ${def.metadata.displayName.padEnd(20)} ${def.metadata.description}`);
    }
  }

  process.stdout.write(lines.join('\n') + '\n');
}
