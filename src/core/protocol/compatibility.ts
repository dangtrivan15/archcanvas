import type { PortDef } from '../../types/nodeDefSchema';

export interface ProtocolCheckResult {
  compatible: boolean;
  fromPortName?: string;
  fromProtocols?: string[];
  toPortName?: string;
  toProtocols?: string[];
}

export function arePortsCompatible(
  fromPort: PortDef | undefined,
  toPort: PortDef | undefined,
): ProtocolCheckResult {
  if (!fromPort || !toPort) return { compatible: true };
  if (!fromPort.protocol.length || !toPort.protocol.length) return { compatible: true };

  const compatible = fromPort.protocol.some((p) => toPort.protocol.includes(p));
  if (compatible) return { compatible: true };

  return {
    compatible: false,
    fromPortName: fromPort.name,
    fromProtocols: fromPort.protocol,
    toPortName: toPort.name,
    toProtocols: toPort.protocol,
  };
}
