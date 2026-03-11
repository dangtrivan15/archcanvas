/**
 * Tests for Feature #7: NodeDef Zod validation passes for all built-in definitions.
 *
 * Validates that all 15 YAML-loaded nodedef definitions pass Zod schema validation
 * and contain the expected metadata fields, spec.args, and spec.ports.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parse as parseYaml } from 'yaml';
import {
  validateNodeDef,
  safeValidateNodeDef,
  nodeDefSchema,
} from '@/core/registry/nodedefValidator';

// Path to the builtins YAML directory
const BUILTINS_DIR = path.resolve(__dirname, '../../../src/core/registry/builtins/core');

/**
 * All 15 expected YAML files organized by namespace.
 */
const ALL_YAML_FILES = [
  { namespace: 'compute', file: 'service.yaml', name: 'service' },
  { namespace: 'compute', file: 'function.yaml', name: 'function' },
  { namespace: 'compute', file: 'worker.yaml', name: 'worker' },
  { namespace: 'compute', file: 'api-gateway.yaml', name: 'api-gateway' },
  { namespace: 'data', file: 'database.yaml', name: 'database' },
  { namespace: 'data', file: 'cache.yaml', name: 'cache' },
  { namespace: 'data', file: 'object-storage.yaml', name: 'object-storage' },
  { namespace: 'data', file: 'repository.yaml', name: 'repository' },
  { namespace: 'messaging', file: 'message-queue.yaml', name: 'message-queue' },
  { namespace: 'messaging', file: 'event-bus.yaml', name: 'event-bus' },
  { namespace: 'messaging', file: 'stream-processor.yaml', name: 'stream-processor' },
  { namespace: 'network', file: 'load-balancer.yaml', name: 'load-balancer' },
  { namespace: 'network', file: 'cdn.yaml', name: 'cdn' },
  { namespace: 'observability', file: 'logging.yaml', name: 'logging' },
  { namespace: 'observability', file: 'monitoring.yaml', name: 'monitoring' },
];

/**
 * Helper: read and parse a YAML file from disk.
 */
function loadYamlFile(namespace: string, filename: string): unknown {
  const filePath = path.join(BUILTINS_DIR, namespace, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseYaml(content);
}

describe('NodeDef Zod validation', () => {
  describe('all 15 nodedefs pass Zod schema validation', () => {
    for (const { namespace, file, name } of ALL_YAML_FILES) {
      it(`validates ${namespace}/${name} without errors`, () => {
        const parsed = loadYamlFile(namespace, file);
        const result = safeValidateNodeDef(parsed);

        if (!result.success) {
          // Show detailed error for debugging
          const errors = result.error.issues
            .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
            .join('\n');
          throw new Error(`Zod validation failed for ${namespace}/${name}:\n${errors}`);
        }

        expect(result.success).toBe(true);
      });
    }
  });

  describe('validateNodeDef() does not throw for any built-in', () => {
    for (const { namespace, file, name } of ALL_YAML_FILES) {
      it(`validateNodeDef() succeeds for ${namespace}/${name}`, () => {
        const parsed = loadYamlFile(namespace, file);
        expect(() => validateNodeDef(parsed)).not.toThrow();
      });
    }
  });

  describe('metadata fields are present and valid', () => {
    for (const { namespace, file, name } of ALL_YAML_FILES) {
      it(`${namespace}/${name} has all required metadata fields`, () => {
        const parsed = loadYamlFile(namespace, file);
        const validated = validateNodeDef(parsed);

        // Check all required metadata fields
        expect(validated.metadata.name).toBe(name);
        expect(validated.metadata.namespace).toBe(namespace);
        expect(validated.metadata.displayName).toBeTruthy();
        expect(validated.metadata.description).toBeTruthy();
        expect(validated.metadata.icon).toBeTruthy();
        expect(validated.metadata.version).toBeTruthy();
        expect(Array.isArray(validated.metadata.tags)).toBe(true);
        expect(validated.metadata.tags.length).toBeGreaterThan(0);
      });
    }
  });

  describe('spec.args is a valid array of ArgDef objects', () => {
    for (const { namespace, file, name } of ALL_YAML_FILES) {
      it(`${namespace}/${name} has valid args array`, () => {
        const parsed = loadYamlFile(namespace, file);
        const validated = validateNodeDef(parsed);

        expect(Array.isArray(validated.spec.args)).toBe(true);
        expect(validated.spec.args.length).toBeGreaterThan(0);

        for (const arg of validated.spec.args) {
          expect(arg.name).toBeTruthy();
          expect(['string', 'number', 'boolean', 'enum', 'duration']).toContain(arg.type);
          expect(typeof arg.description).toBe('string');

          // Enum args must have options
          if (arg.type === 'enum') {
            expect(
              Array.isArray(arg.options),
              `${name} arg '${arg.name}' is enum but missing options`,
            ).toBe(true);
            expect(arg.options!.length).toBeGreaterThan(0);
          }
        }
      });
    }
  });

  describe('spec.ports is a valid array of PortDef objects', () => {
    for (const { namespace, file, name } of ALL_YAML_FILES) {
      it(`${namespace}/${name} has valid ports array`, () => {
        const parsed = loadYamlFile(namespace, file);
        const validated = validateNodeDef(parsed);

        expect(Array.isArray(validated.spec.ports)).toBe(true);
        expect(validated.spec.ports.length).toBeGreaterThan(0);

        for (const port of validated.spec.ports) {
          expect(port.name).toBeTruthy();
          expect(['inbound', 'outbound']).toContain(port.direction);
          expect(Array.isArray(port.protocol)).toBe(true);
          expect(port.protocol.length).toBeGreaterThan(0);
        }
      });
    }
  });

  describe('Zod schema rejects invalid data', () => {
    it('rejects object with missing kind', () => {
      const invalid = {
        apiVersion: 'v1',
        metadata: {
          name: 'test',
          namespace: 'test',
          version: '1.0.0',
          displayName: 'Test',
          description: 'Test',
          icon: 'Test',
          tags: [],
        },
        spec: { args: [], ports: [] },
      };
      const result = safeValidateNodeDef(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects object with wrong kind value', () => {
      const invalid = {
        kind: 'WrongKind',
        apiVersion: 'v1',
        metadata: {
          name: 'test',
          namespace: 'test',
          version: '1.0.0',
          displayName: 'Test',
          description: 'Test',
          icon: 'Test',
          tags: [],
        },
        spec: { args: [], ports: [] },
      };
      const result = safeValidateNodeDef(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects object with invalid arg type', () => {
      const invalid = {
        kind: 'NodeDef',
        apiVersion: 'v1',
        metadata: {
          name: 'test',
          namespace: 'test',
          version: '1.0.0',
          displayName: 'Test',
          description: 'Test',
          icon: 'Test',
          tags: [],
        },
        spec: {
          args: [{ name: 'bad', type: 'invalid-type', description: 'Bad arg' }],
          ports: [],
        },
      };
      const result = safeValidateNodeDef(invalid);
      expect(result.success).toBe(false);
    });
  });
});
