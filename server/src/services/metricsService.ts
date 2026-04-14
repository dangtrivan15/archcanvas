import crypto from 'crypto';
import type { IMetricsRepository } from '../repositories/types';

export class MetricsService {
  private dedupCache = new Map<string, number>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private nowFn: () => number;

  constructor(
    private metricsRepo: IMetricsRepository,
    nowFn?: () => number,
  ) {
    this.nowFn = nowFn || (() => Date.now());
  }

  recordDownload(nodedefId: number, version: string, clientIp: string): void {
    const ipHash = this.hashIp(clientIp);
    const key = `${nodedefId}:${ipHash}`;
    const now = this.nowFn();
    const lastCounted = this.dedupCache.get(key);

    // Dedup: skip if counted within last hour (3600000 ms)
    if (lastCounted !== undefined && now - lastCounted < 3600000) {
      return;
    }

    this.dedupCache.set(key, now);

    const today = new Date(now).toISOString().split('T')[0];
    this.metricsRepo.incrementDownload(nodedefId, version, today);
  }

  startCleanup(): void {
    // Sweep expired entries every 10 minutes
    this.cleanupInterval = setInterval(() => {
      this.sweepExpired();
    }, 10 * 60 * 1000);
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  getTrending(
    days: number = 7,
    limit: number = 20,
  ): Array<{ nodedefId: number; downloads: number }> {
    return this.metricsRepo.getTrending(days, limit);
  }

  private sweepExpired(): void {
    const now = this.nowFn();
    for (const [key, timestamp] of this.dedupCache) {
      if (now - timestamp >= 3600000) {
        this.dedupCache.delete(key);
      }
    }
  }

  private hashIp(ip: string): string {
    return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
  }

  /** Exposed for testing */
  get cacheSize(): number {
    return this.dedupCache.size;
  }
}
