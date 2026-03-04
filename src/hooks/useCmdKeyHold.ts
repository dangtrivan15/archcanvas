/**
 * useCmdKeyHold - Detects when the Cmd (Meta) key is held for 1 second
 * without any other key press. Used to trigger the iPadOS-style keyboard
 * shortcuts overlay on iPad/Mac platforms.
 *
 * Returns `true` while the overlay should be visible (Cmd held ≥1s).
 * Dismisses on Cmd release or any other key press.
 * Only activates on Cmd-based platforms (Mac/iPad).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getCurrentPlatform, isCmdPlatform } from '@/core/input';

const CMD_HOLD_DELAY_MS = 1000;

export function useCmdKeyHold(): boolean {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cmdDownRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const platform = getCurrentPlatform();
    if (!isCmdPlatform(platform)) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger on bare Meta key (no other keys pressed alongside)
      if (e.key === 'Meta') {
        if (!cmdDownRef.current) {
          cmdDownRef.current = true;
          clearTimer();
          timerRef.current = setTimeout(() => {
            setVisible(true);
          }, CMD_HOLD_DELAY_MS);
        }
        return;
      }

      // Any other key press while Cmd is down: cancel timer and dismiss overlay
      clearTimer();
      cmdDownRef.current = false;
      setVisible(false);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Meta') {
        clearTimer();
        cmdDownRef.current = false;
        setVisible(false);
      }
    };

    // Also dismiss if window loses focus (e.g., Cmd+Tab)
    const handleBlur = () => {
      clearTimer();
      cmdDownRef.current = false;
      setVisible(false);
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleBlur);

    return () => {
      clearTimer();
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleBlur);
    };
  }, [clearTimer]);

  return visible;
}
