import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  loadPermissions,
  savePermission,
  isAutoApproved,
} from '@/core/ai/permissionStore';
import type { PermissionSuggestion } from '@/core/ai/types';

// ---------------------------------------------------------------------------
// Test fixture: temp directory per test
// ---------------------------------------------------------------------------

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `archcanvas-perm-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// loadPermissions
// ---------------------------------------------------------------------------

describe('loadPermissions', () => {
  it('returns empty array when no file exists', () => {
    expect(loadPermissions(testDir)).toEqual([]);
  });

  it('returns empty array for malformed JSON', () => {
    const dir = join(testDir, '.archcanvas');
    mkdirSync(dir, { recursive: true });
    const { writeFileSync } = require('fs');
    writeFileSync(join(dir, 'permissions.json'), 'not json', 'utf-8');
    expect(loadPermissions(testDir)).toEqual([]);
  });

  it('returns empty array for wrong version', () => {
    const dir = join(testDir, '.archcanvas');
    mkdirSync(dir, { recursive: true });
    const { writeFileSync } = require('fs');
    writeFileSync(
      join(dir, 'permissions.json'),
      JSON.stringify({ version: 99, permissions: [] }),
      'utf-8',
    );
    expect(loadPermissions(testDir)).toEqual([]);
  });

  it('loads saved permissions', () => {
    const rule: PermissionSuggestion = {
      type: 'addRules',
      rules: [{ toolName: 'Bash', ruleContent: 'archcanvas:*' }],
      behavior: 'allow',
      destination: 'localSettings',
    };
    savePermission(testDir, rule);
    const loaded = loadPermissions(testDir);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(rule);
  });
});

// ---------------------------------------------------------------------------
// savePermission
// ---------------------------------------------------------------------------

describe('savePermission', () => {
  it('creates .archcanvas directory and file', () => {
    const rule: PermissionSuggestion = {
      type: 'addRules',
      rules: [{ toolName: 'Bash' }],
      behavior: 'allow',
      destination: 'localSettings',
    };
    savePermission(testDir, rule);

    const path = join(testDir, '.archcanvas', 'permissions.json');
    expect(existsSync(path)).toBe(true);
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    expect(data.version).toBe(1);
    expect(data.permissions).toHaveLength(1);
  });

  it('deduplicates addRules', () => {
    const rule: PermissionSuggestion = {
      type: 'addRules',
      rules: [{ toolName: 'Bash', ruleContent: 'npm:*' }],
      behavior: 'allow',
      destination: 'localSettings',
    };
    savePermission(testDir, rule);
    savePermission(testDir, rule); // duplicate
    expect(loadPermissions(testDir)).toHaveLength(1);
  });

  it('deduplicates addDirectories', () => {
    const rule: PermissionSuggestion = {
      type: 'addDirectories',
      directories: ['/tmp/foo'],
      destination: 'localSettings',
    };
    savePermission(testDir, rule);
    savePermission(testDir, rule); // duplicate
    expect(loadPermissions(testDir)).toHaveLength(1);
  });

  it('allows different rules for the same tool', () => {
    const rule1: PermissionSuggestion = {
      type: 'addRules',
      rules: [{ toolName: 'Bash', ruleContent: 'npm:*' }],
      behavior: 'allow',
      destination: 'localSettings',
    };
    const rule2: PermissionSuggestion = {
      type: 'addRules',
      rules: [{ toolName: 'Bash', ruleContent: 'git:*' }],
      behavior: 'allow',
      destination: 'localSettings',
    };
    savePermission(testDir, rule1);
    savePermission(testDir, rule2);
    expect(loadPermissions(testDir)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// isAutoApproved — addRules
// ---------------------------------------------------------------------------

describe('isAutoApproved', () => {
  describe('addRules', () => {
    it('matches tool with no ruleContent (allow all)', () => {
      const perms: PermissionSuggestion[] = [
        { type: 'addRules', rules: [{ toolName: 'Read' }], behavior: 'allow', destination: 'localSettings' },
      ];
      expect(isAutoApproved(perms, 'Read', { file_path: '/any/file' })).toBe(true);
    });

    it('does not match different tool name', () => {
      const perms: PermissionSuggestion[] = [
        { type: 'addRules', rules: [{ toolName: 'Write' }], behavior: 'allow', destination: 'localSettings' },
      ];
      expect(isAutoApproved(perms, 'Read', { file_path: '/any/file' })).toBe(false);
    });

    it('skips deny rules', () => {
      const perms: PermissionSuggestion[] = [
        { type: 'addRules', rules: [{ toolName: 'Bash' }], behavior: 'deny', destination: 'localSettings' },
      ];
      expect(isAutoApproved(perms, 'Bash', { command: 'rm -rf /' })).toBe(false);
    });

    it('matches Claude Code executable:* pattern', () => {
      const perms: PermissionSuggestion[] = [
        { type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'archcanvas:*' }], behavior: 'allow', destination: 'localSettings' },
      ];
      expect(isAutoApproved(perms, 'Bash', { command: 'archcanvas list --json' })).toBe(true);
      expect(isAutoApproved(perms, 'Bash', { command: 'archcanvas add-node --name Foo' })).toBe(true);
      expect(isAutoApproved(perms, 'Bash', { command: 'archcanvas' })).toBe(true);
    });

    it('does not match different executable', () => {
      const perms: PermissionSuggestion[] = [
        { type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'archcanvas:*' }], behavior: 'allow', destination: 'localSettings' },
      ];
      expect(isAutoApproved(perms, 'Bash', { command: 'npm install' })).toBe(false);
      expect(isAutoApproved(perms, 'Bash', { command: 'rm -rf /' })).toBe(false);
    });

    it('matches npm:* pattern', () => {
      const perms: PermissionSuggestion[] = [
        { type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'npm:*' }], behavior: 'allow', destination: 'localSettings' },
      ];
      expect(isAutoApproved(perms, 'Bash', { command: 'npm install lodash' })).toBe(true);
      expect(isAutoApproved(perms, 'Bash', { command: 'npm test' })).toBe(true);
      expect(isAutoApproved(perms, 'Bash', { command: 'npx vitest' })).toBe(false);
    });

    it('handles command with pipes and redirects', () => {
      const perms: PermissionSuggestion[] = [
        { type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'archcanvas:*' }], behavior: 'allow', destination: 'localSettings' },
      ];
      expect(isAutoApproved(perms, 'Bash', {
        command: 'archcanvas list --json 2>/dev/null || echo \'{"empty": true}\'',
      })).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // isAutoApproved — addDirectories
  // ---------------------------------------------------------------------------

  describe('addDirectories', () => {
    it('matches file_path within allowed directory', () => {
      const perms: PermissionSuggestion[] = [
        { type: 'addDirectories', directories: ['/Users/vandang/GitProjects/archcanvas'], destination: 'localSettings' },
      ];
      expect(isAutoApproved(perms, 'Read', { file_path: '/Users/vandang/GitProjects/archcanvas/src/main.ts' })).toBe(true);
    });

    it('matches path parameter (Glob, Grep)', () => {
      const perms: PermissionSuggestion[] = [
        { type: 'addDirectories', directories: ['/Users/vandang/GitProjects/archcanvas'], destination: 'localSettings' },
      ];
      expect(isAutoApproved(perms, 'Glob', { path: '/Users/vandang/GitProjects/archcanvas/src', pattern: '*.ts' })).toBe(true);
    });

    it('does not match path outside allowed directory', () => {
      const perms: PermissionSuggestion[] = [
        { type: 'addDirectories', directories: ['/Users/vandang/GitProjects/archcanvas'], destination: 'localSettings' },
      ];
      expect(isAutoApproved(perms, 'Read', { file_path: '/etc/passwd' })).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // isAutoApproved — empty / no match
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('returns false for empty permissions', () => {
      expect(isAutoApproved([], 'Bash', { command: 'ls' })).toBe(false);
    });

    it('returns false when tool has ruleContent but input has no command', () => {
      const perms: PermissionSuggestion[] = [
        { type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'archcanvas:*' }], behavior: 'allow', destination: 'localSettings' },
      ];
      expect(isAutoApproved(perms, 'Bash', { some_other_field: 'value' })).toBe(false);
    });
  });
});
