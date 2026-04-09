import { describe, it, expect } from 'vitest';
import { parseNodeDef } from '@/core/registry/validator';

const validYaml = `
kind: NodeDef
apiVersion: v1
metadata:
  name: service
  namespace: compute
  version: "1.0.0"
  displayName: Service
  description: A deployable backend service
  icon: Server
  tags: [backend]
  shape: rectangle
spec:
  ports:
    - name: http-in
      direction: inbound
      protocol: [HTTP]
`;

describe('parseNodeDef', () => {
  it('parses valid YAML into NodeDef', () => {
    const result = parseNodeDef(validYaml);
    expect('nodeDef' in result).toBe(true);
    if ('nodeDef' in result) {
      expect(result.nodeDef.metadata.name).toBe('service');
      expect(result.nodeDef.metadata.namespace).toBe('compute');
      expect(result.nodeDef.spec.ports).toHaveLength(1);
    }
  });

  it('returns error for malformed YAML', () => {
    const result = parseNodeDef('{ invalid: yaml: broken');
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('Invalid YAML');
    }
  });

  it('returns error for schema violations', () => {
    const badYaml = `
kind: NodeDef
apiVersion: v1
metadata:
  name: test
  namespace: compute
  version: "1.0.0"
  displayName: Test
  description: A test
  icon: Box
  shape: triangle
spec: {}
`;
    const result = parseNodeDef(badYaml);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('Schema validation failed');
      expect(result.error).toContain('shape');
    }
  });

  it('returns error for missing required fields', () => {
    const badYaml = `
kind: NodeDef
apiVersion: v1
metadata:
  name: test
spec: {}
`;
    const result = parseNodeDef(badYaml);
    expect('error' in result).toBe(true);
  });

  it('returns error for wrong kind', () => {
    const badYaml = `
kind: Resource
apiVersion: v1
metadata:
  name: test
  namespace: compute
  version: "1.0.0"
  displayName: Test
  description: A test
  icon: Box
  shape: rectangle
spec: {}
`;
    const result = parseNodeDef(badYaml);
    expect('error' in result).toBe(true);
  });

  it('parses YAML with new built-in shape name', () => {
    const yaml = `
kind: NodeDef
apiVersion: v1
metadata:
  name: fn
  namespace: compute
  version: "1.0.0"
  displayName: Function
  description: A serverless function
  icon: Zap
  shape: diamond
spec: {}
`;
    const result = parseNodeDef(yaml);
    expect('nodeDef' in result).toBe(true);
    if ('nodeDef' in result) {
      expect(result.nodeDef.metadata.shape).toBe('diamond');
    }
  });

  it('parses YAML with custom shape object', () => {
    const yaml = `
kind: NodeDef
apiVersion: v1
metadata:
  name: custom-node
  namespace: custom
  version: "1.0.0"
  displayName: Custom Node
  description: A node with custom shape
  icon: Box
  shape:
    clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)"
spec: {}
`;
    const result = parseNodeDef(yaml);
    expect('nodeDef' in result).toBe(true);
    if ('nodeDef' in result) {
      expect(result.nodeDef.metadata.shape).toEqual({
        clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
      });
    }
  });

  it('rejects YAML with invalid shape object (missing clipPath)', () => {
    const yaml = `
kind: NodeDef
apiVersion: v1
metadata:
  name: bad-node
  namespace: custom
  version: "1.0.0"
  displayName: Bad Node
  description: A node with invalid shape
  icon: Box
  shape:
    fill: red
spec: {}
`;
    const result = parseNodeDef(yaml);
    expect('error' in result).toBe(true);
  });

  it('parses NodeDef with all optional fields', () => {
    const fullYaml = `
kind: NodeDef
apiVersion: v1
metadata:
  name: service
  namespace: compute
  version: "1.0.0"
  displayName: Service
  description: A backend service
  icon: Server
  tags: [backend, microservice]
  shape: rectangle
spec:
  args:
    - name: language
      type: enum
      required: true
      options: [TypeScript, Python]
      default: TypeScript
      description: Primary language
  ports:
    - name: http-in
      direction: inbound
      protocol: [HTTP, HTTPS]
  children:
    - nodedef: compute/function
      min: 0
      max: 50
  ai:
    context: A backend service
    reviewHints:
      - Check scaling
variants:
  - name: REST API
    description: RESTful service
    args:
      framework: Express
`;
    const result = parseNodeDef(fullYaml);
    expect('nodeDef' in result).toBe(true);
    if ('nodeDef' in result) {
      expect(result.nodeDef.spec.args).toHaveLength(1);
      expect(result.nodeDef.spec.children).toHaveLength(1);
      expect(result.nodeDef.variants).toHaveLength(1);
    }
  });
});
