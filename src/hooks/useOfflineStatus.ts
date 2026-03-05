import { useState, useEffect, useCallback } from 'react';

export interface OfflineStatus {
  /** Whether the browser is currently online */
  isOnline: boolean;
  /** Whether the app was offline and recently came back online (for sync banner) */
  wasOffline: boolean;
  /** Dismiss the "back online" notification */
  dismissReconnected: () => void;
}

/**
 * Hook to track online/offline status using navigator.onLine + events.
 * Returns reactive state that updates when connectivity changes.
 */
export function useOfflineStatus(): OfflineStatus {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(false); // Clear reconnected state when going offline
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const dismissReconnected = useCallback(() => {
    setWasOffline(false);
  }, []);

  return { isOnline, wasOffline, dismissReconnected };
}
