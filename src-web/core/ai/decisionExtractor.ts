import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { archcanvasPath, ARCHCANVAS_DIR } from './conversationHistory';
import type { StoredMessage } from './conversationHistory';

export interface Decision {
  title: string;
  date: string;
  decision: string;
}

/** Extract architecture decisions heuristically from a single user+assistant turn. */
export function extractDecisions(messages: StoredMessage[]): Decision[] {
  const decisions: Decision[] = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    const content = msg.content;

    // Match patterns like "I recommend...", "We decided to...", "Use X for Y",
    // "The decision is...", "We will use..."
    const patterns = [
      /(?:i recommend|we (?:should|will|decided to)|the decision is|use)\s+([^.!?\n]{10,80})/gi,
      /(?:architecture decision|adr):\s*([^.!?\n]{5,80})/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const title = match[1].trim().slice(0, 60);
        if (title.length >= 10) {
          decisions.push({ title, date: today, decision: match[0].trim().slice(0, 200) });
        }
      }
    }
  }

  return decisions;
}

/** Append new decisions to decisions.yaml, deduplicating by title (case-insensitive). */
export function mergeIntoAdrFile(cwd: string, newDecisions: Decision[]): void {
  if (newDecisions.length === 0) return;

  const dir = join(cwd, ARCHCANVAS_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const adrPath = archcanvasPath(cwd, 'decisions.yaml');
  let existing = '';
  const existingTitles = new Set<string>();

  if (existsSync(adrPath)) {
    existing = readFileSync(adrPath, 'utf-8');
    // Extract existing titles from YAML lines starting with "- title:"
    for (const line of existing.split('\n')) {
      const m = line.match(/^\s*-?\s*title:\s*['"]?(.+?)['"]?\s*$/);
      if (m) existingTitles.add(m[1].toLowerCase().trim());
    }
  }

  const newEntries = newDecisions
    .filter(d => !existingTitles.has(d.title.toLowerCase().trim()))
    .map(d => `- title: "${d.title}"\n  date: "${d.date}"\n  decision: "${d.decision.replace(/"/g, '\\"')}"`)
    .join('\n');

  if (!newEntries) return;

  const header = existing ? '' : '# Architecture Decision Records\n---\ndecisions:\n';
  const separator = existing && !existing.endsWith('\n') ? '\n' : '';
  writeFileSync(adrPath, `${header}${existing}${separator}${newEntries}\n`, 'utf-8');
}

/** Delete .archcanvas/decisions.yaml if it exists. No-op otherwise. */
export function deleteDecisions(cwd: string): void {
  const adrPath = archcanvasPath(cwd, 'decisions.yaml');
  if (existsSync(adrPath)) {
    unlinkSync(adrPath);
  }
}
