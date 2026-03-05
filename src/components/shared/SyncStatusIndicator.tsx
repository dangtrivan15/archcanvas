/**
 * SyncStatusIndicator — Shows the current sync queue status in the status bar.
 *
 * Displays:
 * - Nothing when idle (no pending operations)
 * - "2 pending" with clock icon when operations are queued
 * - "Syncing..." with spinning icon when flushing
 * - "Synced" with check icon after successful sync
 * - "Sync error" with alert icon when sync fails
 */

import { Clock, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import type { SyncStatus } from '@/core/sync/syncQueue';

interface SyncStatusIndicatorProps {
  syncStatus: SyncStatus;
  pendingCount: number;
}

export function SyncStatusIndicator({ syncStatus, pendingCount }: SyncStatusIndicatorProps) {
  if (syncStatus === 'idle') {
    return null;
  }

  return (
    <>
      <span className="mx-1 text-gray-300 status-bar-compact-hide">|</span>
      <span
        data-testid="sync-status-indicator"
        data-sync-status={syncStatus}
        className={`flex items-center gap-1 text-xs status-bar-compact-hide ${getStatusColor(syncStatus)}`}
      >
        {getStatusIcon(syncStatus)}
        {getStatusText(syncStatus, pendingCount)}
      </span>
    </>
  );
}

function getStatusColor(status: SyncStatus): string {
  switch (status) {
    case 'pending':
      return 'text-amber-600';
    case 'syncing':
      return 'text-blue-600';
    case 'synced':
      return 'text-green-600';
    case 'error':
      return 'text-red-600';
    default:
      return 'text-gray-500';
  }
}

function getStatusIcon(status: SyncStatus) {
  switch (status) {
    case 'pending':
      return <Clock className="w-3 h-3" />;
    case 'syncing':
      return <RefreshCw className="w-3 h-3 animate-spin" />;
    case 'synced':
      return <CheckCircle className="w-3 h-3" />;
    case 'error':
      return <AlertCircle className="w-3 h-3" />;
    default:
      return null;
  }
}

function getStatusText(status: SyncStatus, pendingCount: number): string {
  switch (status) {
    case 'pending':
      return `${pendingCount} pending`;
    case 'syncing':
      return 'Syncing...';
    case 'synced':
      return 'Synced';
    case 'error':
      return 'Sync error';
    default:
      return '';
  }
}
