/**
 * Tests for Feature #6: All 15 built-in NodeDef YAML files parse correctly.
 *
 * Verifies that each YAML file in builtins/core/ loads, parses with the yaml
 * package, and produces objects with the required top-level fields:
 * kind, apiVersion, metadata, spec.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parse as parseYaml } from 'yaml';

// Path to the builtins YAML directory
const BUILTINS_DIR = path.resolve(__dirname, '../../../src/core/registry/builtins/core');

/**
 * All 15 expected YAML files organized by namespace.
 */
const EXPECTED_YAML_FILES: Record<string, string[]> = {
  compute: ['service.yaml', 'function.yaml', 'worker.yaml', 'api-gateway.yaml'],
  data: ['database.yaml', 'cache.yaml', 'object-storage.yaml', 'repository.yaml'],
  messaging: ['message-queue.yaml', 'event-bus.yaml', 'stream-processor.yaml'],
  network: ['load-balancer.yaml', 'cdn.yaml'],
  observability: ['logging.yaml', 'monitoring.yaml'],
};

/**
 * Helper: read and parse a YAML file from disk.
 */
function loadYamlFile(namespace: string, filename: string): unknown {
  const filePath = path.join(BUILTINS_DIR, namespace, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseYaml(content);
}

describe('NodeDef YAML file parsing', () => {
  // Compute namespace (4 files)
  describe('Compute namespace', () => {
    it('loads service.yaml and verifies it parses', () => {
      const parsed = loadYamlFile('compute', 'service.yaml') as Record<string, unknown>;
      expect(parsed).toBeDefined();
      expect(parsed.kind).toBe('NodeDef');
      expect(parsed.apiVersion).toBe('v1');
      expect(parsed.metadata).toBeDefined();
      expect(parsed.spec).toBeDefined();
    });

    it('loads function.yaml and verifies it parses', () => {
      const parsed = loadYamlFile('compute', 'function.yaml') as Record<string, unknown>;
      expect(parsed).toBeDefined();
      expect(parsed.kind).toBe('NodeDef');
      expect(parsed.apiVersion).toBe('v1');
      expect(parsed.metadata).toBeDefined();
      expect(parsed.spec).toBeDefined();
    });

    it('loads worker.yaml and verifies it parses', () => {
      const parsed = loadYamlFile('compute', 'worker.yaml') as Record<string, unknown>;
      expect(parsed).toBeDefined();
      expect(parsed.kind).toBe('NodeDef');
      expect(parsed.apiVersion).toBe('v1');
      expect(parsed.metadata).toBeDefined();
      expect(parsed.spec).toBeDefined();
    });

    it('loads api-gateway.yaml and verifies it parses', () => {
      const parsed = loadYamlFile('compute', 'api-gateway.yaml') as Record<string, unknown>;
      expect(parsed).toBeDefined();
      expect(parsed.kind).toBe('NodeDef');
      expect(parsed.apiVersion).toBe('v1');
      expect(parsed.metadata).toBeDefined();
      expect(parsed.spec).toBeDefined();
    });
  });

  // Data namespace (4 files)
  describe('Data namespace', () => {
    it('loads database.yaml and verifies it parses', () => {
      const parsed = loadYamlFile('data', 'database.yaml') as Record<string, unknown>;
      expect(parsed).toBeDefined();
      expect(parsed.kind).toBe('NodeDef');
      expect(parsed.apiVersion).toBe('v1');
      expect(parsed.metadata).toBeDefined();
      expect(parsed.spec).toBeDefined();
    });

    it('loads cache.yaml and verifies it parses', () => {
      const parsed = loadYamlFile('data', 'cache.yaml') as Record<string, unknown>;
      expect(parsed).toBeDefined();
      expect(parsed.kind).toBe('NodeDef');
      expect(parsed.apiVersion).toBe('v1');
      expect(parsed.metadata).toBeDefined();
      expect(parsed.spec).toBeDefined();
    });

    it('loads object-storage.yaml and verifies it parses', () => {
      const parsed = loadYamlFile('data', 'object-storage.yaml') as Record<string, unknown>;
      expect(parsed).toBeDefined();
      expect(parsed.kind).toBe('NodeDef');
      expect(parsed.apiVersion).toBe('v1');
      expect(parsed.metadata).toBeDefined();
      expect(parsed.spec).toBeDefined();
    });

    it('loads repository.yaml and verifies it parses', () => {
      const parsed = loadYamlFile('data', 'repository.yaml') as Record<string, unknown>;
      expect(parsed).toBeDefined();
      expect(parsed.kind).toBe('NodeDef');
      expect(parsed.apiVersion).toBe('v1');
      expect(parsed.metadata).toBeDefined();
      expect(parsed.spec).toBeDefined();
    });
  });

  // Messaging namespace (3 files)
  describe('Messaging namespace', () => {
    it('loads message-queue.yaml and verifies it parses', () => {
      const parsed = loadYamlFile('messaging', 'message-queue.yaml') as Record<string, unknown>;
      expect(parsed).toBeDefined();
      expect(parsed.kind).toBe('NodeDef');
      expect(parsed.apiVersion).toBe('v1');
      expect(parsed.metadata).toBeDefined();
      expect(parsed.spec).toBeDefined();
    });

    it('loads event-bus.yaml and verifies it parses', () => {
      const parsed = loadYamlFile('messaging', 'event-bus.yaml') as Record<string, unknown>;
      expect(parsed).toBeDefined();
      expect(parsed.kind).toBe('NodeDef');
      expect(parsed.apiVersion).toBe('v1');
      expect(parsed.metadata).toBeDefined();
      expect(parsed.spec).toBeDefined();
    });

    it('loads stream-processor.yaml and verifies it parses', () => {
      const parsed = loadYamlFile('messaging', 'stream-processor.yaml') as Record<string, unknown>;
      expect(parsed).toBeDefined();
      expect(parsed.kind).toBe('NodeDef');
      expect(parsed.apiVersion).toBe('v1');
      expect(parsed.metadata).toBeDefined();
      expect(parsed.spec).toBeDefined();
    });
  });

  // Network namespace (2 files)
  describe('Network namespace', () => {
    it('loads load-balancer.yaml and verifies it parses', () => {
      const parsed = loadYamlFile('network', 'load-balancer.yaml') as Record<string, unknown>;
      expect(parsed).toBeDefined();
      expect(parsed.kind).toBe('NodeDef');
      expect(parsed.apiVersion).toBe('v1');
      expect(parsed.metadata).toBeDefined();
      expect(parsed.spec).toBeDefined();
    });

    it('loads cdn.yaml and verifies it parses', () => {
      const parsed = loadYamlFile('network', 'cdn.yaml') as Record<string, unknown>;
      expect(parsed).toBeDefined();
      expect(parsed.kind).toBe('NodeDef');
      expect(parsed.apiVersion).toBe('v1');
      expect(parsed.metadata).toBeDefined();
      expect(parsed.spec).toBeDefined();
    });
  });

  // Observability namespace (2 files)
  describe('Observability namespace', () => {
    it('loads logging.yaml and verifies it parses', () => {
      const parsed = loadYamlFile('observability', 'logging.yaml') as Record<string, unknown>;
      expect(parsed).toBeDefined();
      expect(parsed.kind).toBe('NodeDef');
      expect(parsed.apiVersion).toBe('v1');
      expect(parsed.metadata).toBeDefined();
      expect(parsed.spec).toBeDefined();
    });

    it('loads monitoring.yaml and verifies it parses', () => {
      const parsed = loadYamlFile('observability', 'monitoring.yaml') as Record<string, unknown>;
      expect(parsed).toBeDefined();
      expect(parsed.kind).toBe('NodeDef');
      expect(parsed.apiVersion).toBe('v1');
      expect(parsed.metadata).toBeDefined();
      expect(parsed.spec).toBeDefined();
    });
  });

  // Verify all 15 files exist and parse
  describe('completeness', () => {
    it('has exactly 15 YAML files across all namespaces', () => {
      const totalExpected = Object.values(EXPECTED_YAML_FILES).flat().length;
      expect(totalExpected).toBe(15);
    });

    it('all expected YAML files exist on disk', () => {
      for (const [namespace, files] of Object.entries(EXPECTED_YAML_FILES)) {
        for (const filename of files) {
          const filePath = path.join(BUILTINS_DIR, namespace, filename);
          expect(fs.existsSync(filePath), `Missing: ${namespace}/${filename}`).toBe(true);
        }
      }
    });

    it('all YAML files parse with required fields: kind, apiVersion, metadata, spec', () => {
      for (const [namespace, files] of Object.entries(EXPECTED_YAML_FILES)) {
        for (const filename of files) {
          const parsed = loadYamlFile(namespace, filename) as Record<string, unknown>;
          expect(parsed.kind, `${namespace}/${filename} missing kind`).toBe('NodeDef');
          expect(parsed.apiVersion, `${namespace}/${filename} missing apiVersion`).toBeDefined();
          expect(parsed.metadata, `${namespace}/${filename} missing metadata`).toBeDefined();
          expect(parsed.spec, `${namespace}/${filename} missing spec`).toBeDefined();
        }
      }
    });
  });
});
