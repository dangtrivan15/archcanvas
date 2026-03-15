import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  parseCanvas,
  serializeCanvas,
  ParseError,
  SerializeError,
} from '@/storage/yamlCodec';

const fixture = (name: string) =>
  readFileSync(resolve(import.meta.dirname, '../../fixtures/yaml', name), 'utf-8');

describe('parseCanvas', () => {
  it('parses a valid root canvas', () => {
    const result = parseCanvas(fixture('simple-root.yaml'));
    expect(result.data.project?.name).toBe('Test Project');
    expect(result.data.nodes).toHaveLength(2);
    expect(result.data.entities).toHaveLength(1);
    expect(result.data.edges).toHaveLength(1);
    expect(result.doc).toBeDefined();
  });

  it('parses a valid subsystem canvas', () => {
    const result = parseCanvas(fixture('subsystem.yaml'));
    expect(result.data.id).toBe('svc-api');
    expect(result.data.type).toBe('compute/service');
    expect(result.data.nodes).toHaveLength(2);
  });

  it('returns a yaml.Document for format preservation', () => {
    const result = parseCanvas(fixture('with-comments.yaml'));
    expect(result.doc).toBeDefined();
    // Document should preserve the comment
    const output = result.doc.toString();
    expect(output).toContain('# Project header comment');
  });

  it('throws ParseError on invalid YAML syntax', () => {
    expect(() => parseCanvas('{')).toThrow(ParseError);
  });

  it('throws ParseError on schema validation failure', () => {
    const invalidYaml = 'project:\n  name: 123'; // name must be string
    expect(() => parseCanvas(invalidYaml)).toThrow(ParseError);
  });
});

describe('serializeCanvas', () => {
  it('serializes a Canvas to valid YAML', () => {
    const data = {
      project: { name: 'Test' },
      nodes: [{ id: 'svc-api', type: 'compute/service' }],
    };
    const yaml = serializeCanvas(data);
    expect(yaml).toContain('name: Test');
    expect(yaml).toContain('id: svc-api');
  });

  it('throws SerializeError on invalid data', () => {
    const invalid = { project: { name: 123 } } as any;
    expect(() => serializeCanvas(invalid)).toThrow(SerializeError);
  });

  it('preserves formatting when doc is provided', () => {
    const original = fixture('with-comments.yaml');
    const parsed = parseCanvas(original);
    const reserialized = serializeCanvas(parsed.data, parsed.doc);
    expect(reserialized).toContain('# Project header comment');
  });

  it('round-trips data without loss', () => {
    const original = fixture('simple-root.yaml');
    const parsed = parseCanvas(original);
    const serialized = serializeCanvas(parsed.data, parsed.doc);
    const reparsed = parseCanvas(serialized);
    expect(reparsed.data).toEqual(parsed.data);
  });
});
