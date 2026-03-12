import { describe, it, expect } from 'vitest';
import {
  ArgType,
  PortDirection,
  Shape,
  ArgDef,
  PortDef,
  ChildConstraint,
  AiHints,
  Variant,
  NodeDefMetadata,
  NodeDefSpec,
  NodeDef,
} from '@/types';

// --- Minimal valid NodeDef for reuse ---
const validNodeDef = {
  kind: 'NodeDef' as const,
  apiVersion: 'v1' as const,
  metadata: {
    name: 'service',
    namespace: 'compute',
    version: '1.0.0',
    displayName: 'Service',
    description: 'A deployable backend service',
    icon: 'Server',
    tags: ['backend', 'microservice'],
    shape: 'rectangle' as const,
  },
  spec: {
    args: [
      {
        name: 'language',
        type: 'enum' as const,
        required: true,
        options: ['TypeScript', 'Python', 'Go'],
        default: 'TypeScript',
        description: 'Primary programming language',
      },
    ],
    ports: [
      {
        name: 'http-in',
        direction: 'inbound' as const,
        protocol: ['HTTP', 'HTTPS'],
        description: 'Incoming HTTP requests',
      },
    ],
    children: [{ nodedef: 'compute/function', min: 0, max: 50 }],
    ai: {
      context: 'This is a backend service.',
      reviewHints: ['Check for single points of failure'],
    },
  },
  variants: [
    {
      name: 'REST API',
      description: 'RESTful HTTP service',
      args: { framework: 'Express' },
    },
  ],
};

describe('ArgType', () => {
  it.each(['string', 'number', 'boolean', 'enum', 'duration'])(
    'accepts %s',
    (val) => {
      expect(ArgType.parse(val)).toBe(val);
    },
  );

  it('rejects invalid type', () => {
    expect(() => ArgType.parse('object')).toThrow();
  });
});

describe('PortDirection', () => {
  it('accepts inbound', () => {
    expect(PortDirection.parse('inbound')).toBe('inbound');
  });
  it('accepts outbound', () => {
    expect(PortDirection.parse('outbound')).toBe('outbound');
  });
  it('rejects invalid', () => {
    expect(() => PortDirection.parse('bidirectional')).toThrow();
  });
});

describe('Shape', () => {
  const shapes = [
    'rectangle', 'cylinder', 'hexagon', 'parallelogram',
    'cloud', 'stadium', 'document', 'badge', 'container',
  ];
  it.each(shapes)('accepts %s', (val) => {
    expect(Shape.parse(val)).toBe(val);
  });
  it('rejects invalid shape', () => {
    expect(() => Shape.parse('circle')).toThrow();
  });
});

describe('ArgDef', () => {
  it('accepts minimal arg', () => {
    expect(ArgDef.parse({ name: 'language', type: 'string' })).toEqual({
      name: 'language',
      type: 'string',
    });
  });
  it('accepts full arg', () => {
    const arg = {
      name: 'language',
      type: 'enum',
      required: true,
      options: ['TypeScript', 'Python'],
      default: 'TypeScript',
      description: 'Primary language',
    };
    expect(ArgDef.parse(arg)).toEqual(arg);
  });
  it('accepts number default', () => {
    expect(ArgDef.parse({ name: 'replicas', type: 'number', default: 3 }))
      .toEqual({ name: 'replicas', type: 'number', default: 3 });
  });
  it('accepts boolean default', () => {
    expect(ArgDef.parse({ name: 'enabled', type: 'boolean', default: true }))
      .toEqual({ name: 'enabled', type: 'boolean', default: true });
  });
  it('rejects missing name', () => {
    expect(() => ArgDef.parse({ type: 'string' })).toThrow();
  });
  it('rejects invalid type', () => {
    expect(() => ArgDef.parse({ name: 'x', type: 'object' })).toThrow();
  });
});

describe('PortDef', () => {
  it('accepts valid port', () => {
    const port = {
      name: 'http-in',
      direction: 'inbound',
      protocol: ['HTTP', 'HTTPS'],
      description: 'Incoming requests',
    };
    expect(PortDef.parse(port)).toEqual(port);
  });
  it('accepts port without description', () => {
    const port = { name: 'out', direction: 'outbound', protocol: ['TCP'] };
    expect(PortDef.parse(port)).toEqual(port);
  });
  it('rejects missing protocol', () => {
    expect(() => PortDef.parse({ name: 'out', direction: 'outbound' })).toThrow();
  });
  it('rejects invalid direction', () => {
    expect(() =>
      PortDef.parse({ name: 'x', direction: 'both', protocol: ['HTTP'] }),
    ).toThrow();
  });
});

describe('ChildConstraint', () => {
  it('accepts minimal', () => {
    expect(ChildConstraint.parse({ nodedef: 'compute/function' })).toEqual({
      nodedef: 'compute/function',
    });
  });
  it('accepts with min/max', () => {
    expect(
      ChildConstraint.parse({ nodedef: 'compute/function', min: 0, max: 10 }),
    ).toEqual({ nodedef: 'compute/function', min: 0, max: 10 });
  });
});

describe('AiHints', () => {
  it('accepts empty', () => {
    expect(AiHints.parse({})).toEqual({});
  });
  it('accepts full', () => {
    const hints = { context: 'A service', reviewHints: ['Check scaling'] };
    expect(AiHints.parse(hints)).toEqual(hints);
  });
});

describe('Variant', () => {
  it('accepts variant', () => {
    const variant = {
      name: 'REST API',
      description: 'RESTful service',
      args: { framework: 'Express' },
    };
    expect(Variant.parse(variant)).toEqual(variant);
  });
  it('rejects missing args', () => {
    expect(() => Variant.parse({ name: 'X' })).toThrow();
  });
});

describe('NodeDefMetadata', () => {
  it('accepts valid metadata', () => {
    expect(NodeDefMetadata.parse(validNodeDef.metadata)).toEqual(
      validNodeDef.metadata,
    );
  });
  it('accepts without optional tags', () => {
    const { tags: _, ...noTags } = validNodeDef.metadata;
    expect(NodeDefMetadata.parse(noTags)).toEqual(noTags);
  });
  it('rejects missing displayName', () => {
    const { displayName: _, ...bad } = validNodeDef.metadata;
    expect(() => NodeDefMetadata.parse(bad)).toThrow();
  });
  it('rejects invalid shape', () => {
    expect(() =>
      NodeDefMetadata.parse({ ...validNodeDef.metadata, shape: 'triangle' }),
    ).toThrow();
  });
});

describe('NodeDefSpec', () => {
  it('accepts empty spec', () => {
    expect(NodeDefSpec.parse({})).toEqual({});
  });
  it('accepts full spec', () => {
    expect(NodeDefSpec.parse(validNodeDef.spec)).toEqual(validNodeDef.spec);
  });
});

describe('NodeDef', () => {
  it('accepts full valid NodeDef', () => {
    expect(NodeDef.parse(validNodeDef)).toEqual(validNodeDef);
  });

  it('accepts minimal NodeDef (no optional fields)', () => {
    const minimal = {
      kind: 'NodeDef',
      apiVersion: 'v1',
      metadata: {
        name: 'test',
        namespace: 'compute',
        version: '1.0.0',
        displayName: 'Test',
        description: 'A test node',
        icon: 'Box',
        shape: 'rectangle',
      },
      spec: {},
    };
    expect(NodeDef.parse(minimal)).toEqual(minimal);
  });

  it('rejects wrong kind', () => {
    expect(() => NodeDef.parse({ ...validNodeDef, kind: 'Resource' })).toThrow();
  });

  it('rejects wrong apiVersion', () => {
    expect(() =>
      NodeDef.parse({ ...validNodeDef, apiVersion: 'v2' }),
    ).toThrow();
  });

  it('rejects missing metadata', () => {
    const { metadata: _, ...bad } = validNodeDef;
    expect(() => NodeDef.parse(bad)).toThrow();
  });

  it('rejects missing spec', () => {
    const { spec: _, ...bad } = validNodeDef;
    expect(() => NodeDef.parse(bad)).toThrow();
  });
});
