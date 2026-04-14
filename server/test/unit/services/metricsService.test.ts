import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetricsService } from '../../../src/services/metricsService';
import type { IMetricsRepository } from '../../../src/repositories/types';

function createMockMetricsRepo(): IMetricsRepository {
  return {
    incrementDownload: vi.fn(),
    getDownloadStats: vi.fn().mockReturnValue({ total: 0, byVersion: {} }),
    getTrending: vi.fn().mockReturnValue([]),
  };
}

describe('MetricsService', () => {
  let repo: IMetricsRepository;
  let currentTime: number;

  beforeEach(() => {
    repo = createMockMetricsRepo();
    currentTime = Date.now();
  });

  it('records a download on first request', () => {
    const svc = new MetricsService(repo, () => currentTime);
    svc.recordDownload(1, '1.0.0', '192.168.1.1');
    expect(repo.incrementDownload).toHaveBeenCalledOnce();
  });

  it('deduplicates downloads from same IP within 1 hour', () => {
    const svc = new MetricsService(repo, () => currentTime);

    svc.recordDownload(1, '1.0.0', '192.168.1.1');
    svc.recordDownload(1, '1.0.0', '192.168.1.1');
    svc.recordDownload(1, '1.0.0', '192.168.1.1');

    expect(repo.incrementDownload).toHaveBeenCalledOnce();
  });

  it('allows download after dedup window expires', () => {
    let time = currentTime;
    const svc = new MetricsService(repo, () => time);

    svc.recordDownload(1, '1.0.0', '192.168.1.1');
    expect(repo.incrementDownload).toHaveBeenCalledTimes(1);

    // Advance time by 1 hour + 1ms
    time += 3600001;
    svc.recordDownload(1, '1.0.0', '192.168.1.1');
    expect(repo.incrementDownload).toHaveBeenCalledTimes(2);
  });

  it('tracks different IPs separately', () => {
    const svc = new MetricsService(repo, () => currentTime);

    svc.recordDownload(1, '1.0.0', '192.168.1.1');
    svc.recordDownload(1, '1.0.0', '192.168.1.2');
    svc.recordDownload(1, '1.0.0', '10.0.0.1');

    expect(repo.incrementDownload).toHaveBeenCalledTimes(3);
  });

  it('tracks different NodeDefs separately', () => {
    const svc = new MetricsService(repo, () => currentTime);

    svc.recordDownload(1, '1.0.0', '192.168.1.1');
    svc.recordDownload(2, '1.0.0', '192.168.1.1');

    expect(repo.incrementDownload).toHaveBeenCalledTimes(2);
  });

  it('reports cache size', () => {
    const svc = new MetricsService(repo, () => currentTime);
    expect(svc.cacheSize).toBe(0);

    svc.recordDownload(1, '1.0.0', '192.168.1.1');
    expect(svc.cacheSize).toBe(1);

    svc.recordDownload(2, '1.0.0', '192.168.1.2');
    expect(svc.cacheSize).toBe(2);
  });

  it('delegates getTrending to repository', () => {
    const svc = new MetricsService(repo, () => currentTime);
    svc.getTrending(7, 10);
    expect(repo.getTrending).toHaveBeenCalledWith(7, 10);
  });
});
