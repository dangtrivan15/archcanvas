import { describe, it, expect } from 'vitest';
import { arePortsCompatible } from '@/core/protocol/compatibility';

describe('arePortsCompatible', () => {
  it('compatible when protocols overlap', () => {
    const result = arePortsCompatible(
      { name: 'http-out', direction: 'outbound', protocol: ['HTTP', 'HTTPS'] },
      { name: 'http-in', direction: 'inbound', protocol: ['HTTP', 'gRPC'] },
    );
    expect(result.compatible).toBe(true);
  });

  it('incompatible when no overlap', () => {
    const result = arePortsCompatible(
      { name: 'http-out', direction: 'outbound', protocol: ['HTTP', 'HTTPS'] },
      { name: 'query-in', direction: 'inbound', protocol: ['SQL'] },
    );
    expect(result.compatible).toBe(false);
    expect(result.fromPortName).toBe('http-out');
    expect(result.toPortName).toBe('query-in');
    expect(result.fromProtocols).toEqual(['HTTP', 'HTTPS']);
    expect(result.toProtocols).toEqual(['SQL']);
  });

  it('compatible when from port undefined', () => {
    expect(
      arePortsCompatible(undefined, {
        name: 'x',
        direction: 'inbound',
        protocol: ['SQL'],
      }).compatible,
    ).toBe(true);
  });

  it('compatible when to port undefined', () => {
    expect(
      arePortsCompatible(
        { name: 'x', direction: 'outbound', protocol: ['HTTP'] },
        undefined,
      ).compatible,
    ).toBe(true);
  });

  it('compatible when protocol array empty on from port', () => {
    expect(
      arePortsCompatible(
        { name: 'x', direction: 'outbound', protocol: [] },
        { name: 'y', direction: 'inbound', protocol: ['SQL'] },
      ).compatible,
    ).toBe(true);
  });

  it('compatible when protocol array empty on to port', () => {
    expect(
      arePortsCompatible(
        { name: 'x', direction: 'outbound', protocol: ['HTTP'] },
        { name: 'y', direction: 'inbound', protocol: [] },
      ).compatible,
    ).toBe(true);
  });

  it('same protocol always compatible', () => {
    expect(
      arePortsCompatible(
        { name: 'a', direction: 'outbound', protocol: ['SQL'] },
        { name: 'b', direction: 'inbound', protocol: ['SQL'] },
      ).compatible,
    ).toBe(true);
  });

  it('returns port names and protocols on incompatibility', () => {
    const result = arePortsCompatible(
      { name: 'grpc-out', direction: 'outbound', protocol: ['gRPC'] },
      { name: 'sql-in', direction: 'inbound', protocol: ['SQL', 'JDBC'] },
    );
    expect(result).toEqual({
      compatible: false,
      fromPortName: 'grpc-out',
      fromProtocols: ['gRPC'],
      toPortName: 'sql-in',
      toProtocols: ['SQL', 'JDBC'],
    });
  });
});
