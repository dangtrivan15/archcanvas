/**
 * NodeDef types for the architecture node type registry.
 * NodeDefs are loaded from YAML files and define the schema for each node type.
 */

export interface NodeDef {
  kind: 'NodeDef';
  apiVersion: string;
  metadata: NodeDefMetadata;
  spec: NodeDefSpec;
  variants?: VariantDef[];
}

export interface NodeDefMetadata {
  name: string;
  namespace: string;
  version: string;
  displayName: string;
  description: string;
  icon: string;
  tags: string[];
  author?: string;
}

export interface NodeDefSpec {
  args: ArgDef[];
  ports: PortDef[];
  children?: ChildSlotDef[];
  ai?: {
    context?: string;
    reviewHints?: string[];
  };
}

export type ArgType = 'string' | 'number' | 'boolean' | 'enum' | 'duration';

export interface ArgDef {
  name: string;
  type: ArgType;
  description: string;
  required?: boolean;
  options?: string[];
  default?: string | number | boolean;
}

export interface PortDef {
  name: string;
  direction: 'inbound' | 'outbound';
  protocol: string[];
  description?: string;
  condition?: string;
}

export interface ChildSlotDef {
  nodedef: string;
  min: number;
  max: number;
}

export interface VariantDef {
  name: string;
  description: string;
  args: Record<string, string | number | boolean>;
}
