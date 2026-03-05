import { WifiOff, Wifi, X, HardDrive } from 'lucide-react';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { useCachedFiles } from '@/hooks/useCachedFiles';

/**
 * Banner that appears when the app is offline, showing connectivity status
 * and indicating how many files are available offline.
 * Also briefly shows a "back online" notification when reconnecting.
 */
export function OfflineBanner() {
  const { isOnline, wasOffline, dismissReconnected } = useOfflineStatus();
  const { cachedFileCount } = useCachedFiles();

  // Show nothing when online and no reconnection notification pending
  if (isOnline && !wasOffline) {
    return null;
  }

  // "Back online" banner
  if (isOnline && wasOffline) {
    return (
      <div
        data-testid="offline-banner-reconnected"
        className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border-b border-green-200 text-green-800 text-sm"
        role="status"
        aria-live="polite"
      >
        <Wifi className="w-4 h-4 shrink-0" />
        <span>Back online — syncing queued changes</span>
        <button
          type="button"
          onClick={dismissReconnected}
          className="ml-auto p-0.5 rounded hover:bg-green-100 transition-colors"
          aria-label="Dismiss notification"
          data-testid="offline-banner-dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Offline banner
  return (
    <div
      data-testid="offline-banner"
      className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm"
      role="alert"
      aria-live="assertive"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>You are offline — changes will be saved locally</span>
      {cachedFileCount > 0 && (
        <span
          className="flex items-center gap-1 ml-auto text-xs text-amber-600"
          data-testid="offline-cached-count"
        >
          <HardDrive className="w-3.5 h-3.5" />
          {cachedFileCount} file{cachedFileCount !== 1 ? 's' : ''} available offline
        </span>
      )}
    </div>
  );
}
