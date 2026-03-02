/**
 * Tests for Feature #190: Invalid nodedef YAML shows validation error.
 *
 * Verifies that malformed nodedef YAML files produce clear Zod validation errors
 * that indicate which field is missing or invalid, and that the app continues
 * to work with built-in nodedefs even after encountering invalid YAML.
 */

import { describe, it, expect } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import {
  validateNodeDef,
  safeValidateNodeDef,
} from '@/core/registry/nodedefValidator';
import { parseNodeDefYaml } from '@/core/registry/loader';
import { RegistryManager } from '@/core/registry/registryManager';

/**
 * A valid YAML nodedef for reference — used as base to create invalid variants.
 */
const VALID_NODEDEF_YAML = `
kind: NodeDef
apiVersion: v1
metadata:
  name: test-service
  namespace: compute
  version: "1.0.0"
  displayName: Test Service
  description: A test service for validation tests
  icon: Server
  tags:
    - test
    - compute
spec:
  args:
    - name: language
      type: enum
      description: Primary language
      required: true
      options:
        - TypeScript
        - Python
      default: TypeScript
  ports:
    - name: http-in
      direction: inbound
      protocol:
        - HTTP
      description: Incoming HTTP requests
`;

/**
 * YAML with metadata field completely missing.
 */
const YAML_MISSING_METADATA = `
kind: NodeDef
apiVersion: v1
spec:
  args:
    - name: language
      type: string
      description: Primary language
  ports:
    - name: http-in
      direction: inbound
      protocol:
        - HTTP
`;

/**
 * YAML with spec field completely missing.
 */
const YAML_MISSING_SPEC = `
kind: NodeDef
apiVersion: v1
metadata:
  name: test-service
  namespace: compute
  version: "1.0.0"
  displayName: Test Service
  description: A test service
  icon: Server
  tags:
    - test
`;

/**
 * YAML with metadata.name field missing (required sub-field).
 */
const YAML_MISSING_METADATA_NAME = `
kind: NodeDef
apiVersion: v1
metadata:
  namespace: compute
  version: "1.0.0"
  displayName: Test Service
  description: A test service
  icon: Server
  tags:
    - test
spec:
  args: []
  ports: []
`;

/**
 * YAML with metadata.namespace field missing (required sub-field).
 */
const YAML_MISSING_METADATA_NAMESPACE = `
kind: NodeDef
apiVersion: v1
metadata:
  name: test-service
  version: "1.0.0"
  displayName: Test Service
  description: A test service
  icon: Server
  tags:
    - test
spec:
  args: []
  ports: []
`;

/**
 * YAML with metadata.icon field missing (required sub-field).
 */
const YAML_MISSING_METADATA_ICON = `
kind: NodeDef
apiVersion: v1
metadata:
  name: test-service
  namespace: compute
  version: "1.0.0"
  displayName: Test Service
  description: A test service
  tags:
    - test
spec:
  args: []
  ports: []
`;

/**
 * YAML with wrong kind value.
 */
const YAML_WRONG_KIND = `
kind: WrongKind
apiVersion: v1
metadata:
  name: test-service
  namespace: compute
  version: "1.0.0"
  displayName: Test Service
  description: A test service
  icon: Server
  tags:
    - test
spec:
  args: []
  ports: []
`;

/**
 * YAML with invalid arg type.
 */
const YAML_INVALID_ARG_TYPE = `
kind: NodeDef
apiVersion: v1
metadata:
  name: test-service
  namespace: compute
  version: "1.0.0"
  displayName: Test Service
  description: A test service
  icon: Server
  tags:
    - test
spec:
  args:
    - name: badarg
      type: invalid-type
      description: A bad arg
  ports: []
`;

/**
 * YAML with invalid port direction.
 */
const YAML_INVALID_PORT_DIRECTION = `
kind: NodeDef
apiVersion: v1
metadata:
  name: test-service
  namespace: compute
  version: "1.0.0"
  displayName: Test Service
  description: A test service
  icon: Server
  tags:
    - test
spec:
  args: []
  ports:
    - name: http-in
      direction: bidirectional
      protocol:
        - HTTP
`;

describe('Feature #190: Invalid nodedef YAML shows validation error', () => {
  describe('missing required top-level fields', () => {
    it('rejects YAML missing the metadata field with Zod error', () => {
      const parsed = parseNodeDefYaml(YAML_MISSING_METADATA);
      const result = safeValidateNodeDef(parsed);

      expect(result.success).toBe(false);
      if (!result.success) {
        // Verify it's a ZodError
        expect(result.error).toBeInstanceOf(z.ZodError);
        // Verify the error message indicates 'metadata' is the problem
        const paths = result.error.issues.map((issue) => issue.path.join('.'));
        expect(paths.some((p) => p === 'metadata' || p.startsWith('metadata'))).toBe(true);
      }
    });

    it('rejects YAML missing the spec field with Zod error', () => {
      const parsed = parseNodeDefYaml(YAML_MISSING_SPEC);
      const result = safeValidateNodeDef(parsed);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(z.ZodError);
        const paths = result.error.issues.map((issue) => issue.path.join('.'));
        expect(paths.some((p) => p === 'spec' || p.startsWith('spec'))).toBe(true);
      }
    });

    it('validateNodeDef() throws ZodError for YAML missing metadata', () => {
      const parsed = parseNodeDefYaml(YAML_MISSING_METADATA);
      expect(() => validateNodeDef(parsed)).toThrow(z.ZodError);
    });
  });

  describe('missing required metadata sub-fields', () => {
    it('rejects YAML missing metadata.name and error indicates the field', () => {
      const parsed = parseNodeDefYaml(YAML_MISSING_METADATA_NAME);
      const result = safeValidateNodeDef(parsed);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(z.ZodError);
        const issueMessages = result.error.issues.map(
          (issue) => `${issue.path.join('.')}: ${issue.message}`,
        );
        // Check error path references metadata.name
        expect(issueMessages.some((msg) => msg.includes('metadata.name'))).toBe(true);
      }
    });

    it('rejects YAML missing metadata.namespace and error indicates the field', () => {
      const parsed = parseNodeDefYaml(YAML_MISSING_METADATA_NAMESPACE);
      const result = safeValidateNodeDef(parsed);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(z.ZodError);
        const issueMessages = result.error.issues.map(
          (issue) => `${issue.path.join('.')}: ${issue.message}`,
        );
        expect(issueMessages.some((msg) => msg.includes('metadata.namespace'))).toBe(true);
      }
    });

    it('rejects YAML missing metadata.icon and error indicates the field', () => {
      const parsed = parseNodeDefYaml(YAML_MISSING_METADATA_ICON);
      const result = safeValidateNodeDef(parsed);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(z.ZodError);
        const issueMessages = result.error.issues.map(
          (issue) => `${issue.path.join('.')}: ${issue.message}`,
        );
        expect(issueMessages.some((msg) => msg.includes('metadata.icon'))).toBe(true);
      }
    });
  });

  describe('invalid field values produce clear error messages', () => {
    it('rejects YAML with wrong kind value and error mentions kind', () => {
      const parsed = parseNodeDefYaml(YAML_WRONG_KIND);
      const result = safeValidateNodeDef(parsed);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(z.ZodError);
        const paths = result.error.issues.map((issue) => issue.path.join('.'));
        expect(paths).toContain('kind');
      }
    });

    it('rejects YAML with invalid arg type and error path points to spec.args', () => {
      const parsed = parseNodeDefYaml(YAML_INVALID_ARG_TYPE);
      const result = safeValidateNodeDef(parsed);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(z.ZodError);
        const paths = result.error.issues.map((issue) => issue.path.join('.'));
        expect(paths.some((p) => p.startsWith('spec.args'))).toBe(true);
      }
    });

    it('rejects YAML with invalid port direction and error path points to spec.ports', () => {
      const parsed = parseNodeDefYaml(YAML_INVALID_PORT_DIRECTION);
      const result = safeValidateNodeDef(parsed);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(z.ZodError);
        const paths = result.error.issues.map((issue) => issue.path.join('.'));
        expect(paths.some((p) => p.startsWith('spec.ports'))).toBe(true);
      }
    });
  });

  describe('error messages are descriptive and actionable', () => {
    it('Zod error issues contain human-readable messages for each invalid field', () => {
      const parsed = parseNodeDefYaml(YAML_MISSING_METADATA);
      const result = safeValidateNodeDef(parsed);

      expect(result.success).toBe(false);
      if (!result.success) {
        // All issues should have a non-empty message
        for (const issue of result.error.issues) {
          expect(issue.message).toBeTruthy();
          expect(typeof issue.message).toBe('string');
          expect(issue.message.length).toBeGreaterThan(0);
        }
      }
    });

    it('error for missing metadata contains "Required" message', () => {
      const parsed = parseNodeDefYaml(YAML_MISSING_METADATA);
      const result = safeValidateNodeDef(parsed);

      expect(result.success).toBe(false);
      if (!result.success) {
        const metadataIssue = result.error.issues.find(
          (issue) => issue.path.join('.') === 'metadata' || issue.path[0] === 'metadata',
        );
        expect(metadataIssue).toBeDefined();
        expect(metadataIssue!.message).toMatch(/[Rr]equired/);
      }
    });

    it('error for invalid kind contains expected literal value', () => {
      const parsed = parseNodeDefYaml(YAML_WRONG_KIND);
      const result = safeValidateNodeDef(parsed);

      expect(result.success).toBe(false);
      if (!result.success) {
        const kindIssue = result.error.issues.find(
          (issue) => issue.path.join('.') === 'kind',
        );
        expect(kindIssue).toBeDefined();
        // Should mention "NodeDef" as the expected value
        expect(kindIssue!.message).toContain('NodeDef');
      }
    });
  });

  describe('app continues to work with built-in nodedefs after error', () => {
    it('RegistryManager loads built-in nodedefs successfully despite invalid YAML existing', () => {
      // Validate that registry can initialize properly with all built-in nodedefs
      const registry = new RegistryManager();
      expect(() => registry.initialize()).not.toThrow();
      expect(registry.isInitialized()).toBe(true);
      expect(registry.size).toBe(15);
    });

    it('built-in nodedefs can still be resolved after encountering invalid YAML', () => {
      // First, show that invalid YAML throws
      const invalidParsed = parseNodeDefYaml(YAML_MISSING_METADATA);
      const invalidResult = safeValidateNodeDef(invalidParsed);
      expect(invalidResult.success).toBe(false);

      // Then show the registry still works fine
      const registry = new RegistryManager();
      registry.initialize();
      expect(registry.resolve('compute/service')).toBeDefined();
      expect(registry.resolve('data/database')).toBeDefined();
      expect(registry.resolve('network/cdn')).toBeDefined();
    });

    it('valid YAML still passes after invalid YAML was rejected', () => {
      // Process invalid YAML first
      const invalidParsed = parseNodeDefYaml(YAML_MISSING_METADATA);
      const invalidResult = safeValidateNodeDef(invalidParsed);
      expect(invalidResult.success).toBe(false);

      // Now process valid YAML — should still work
      const validParsed = parseNodeDefYaml(VALID_NODEDEF_YAML);
      const validResult = safeValidateNodeDef(validParsed);
      expect(validResult.success).toBe(true);
      if (validResult.success) {
        expect(validResult.data.metadata.name).toBe('test-service');
        expect(validResult.data.metadata.namespace).toBe('compute');
      }
    });
  });
});
