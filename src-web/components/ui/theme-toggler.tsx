import { useCallback, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useReducedMotion } from 'motion/react';
import { useThemeStore } from '@/store/themeStore';

type Direction = 'btt' | 'ttb' | 'ltr' | 'rtl';
type Mode = 'light' | 'dark' | 'system';

function getClipKeyframes(direction: Direction): [string, string] {
  switch (direction) {
    case 'ltr':
      return ['inset(0 100% 0 0)', 'inset(0 0 0 0)'];
    case 'rtl':
      return ['inset(0 0 0 100%)', 'inset(0 0 0 0)'];
    case 'ttb':
      return ['inset(0 0 100% 0)', 'inset(0 0 0 0)'];
    case 'btt':
      return ['inset(100% 0 0 0)', 'inset(0 0 0 0)'];
  }
}

let styleInjected = false;
function ensureViewTransitionStyle() {
  if (styleInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent =
    '::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal;}';
  document.head.appendChild(style);
  styleInjected = true;
}

/**
 * Hook that wraps themeStore.setMode() with a View Transitions API clip-path
 * reveal animation. Falls back to a plain setMode() when the API is unavailable
 * or the user prefers reduced motion.
 *
 * Adapted from animate-ui's ThemeToggler primitive.
 */
export function useThemeToggler(direction: Direction = 'ltr') {
  const prefersReduced = useReducedMotion();
  const transitioning = useRef(false);

  useEffect(() => {
    ensureViewTransitionStyle();
  }, []);

  const [fromClip, toClip] = getClipKeyframes(direction);

  const toggleTheme = useCallback(
    async (mode: Mode) => {
      const { setMode } = useThemeStore.getState();

      if (prefersReduced || !document.startViewTransition || transitioning.current) {
        setMode(mode);
        return;
      }

      transitioning.current = true;

      try {
        const transition = document.startViewTransition(() => {
          flushSync(() => {
            setMode(mode);
          });
        });

        await transition.ready;

        document.documentElement
          .animate(
            { clipPath: [fromClip, toClip] },
            {
              duration: 700,
              easing: 'ease-in-out',
              pseudoElement: '::view-transition-new(root)',
            },
          )
          .finished.finally(() => {
            transitioning.current = false;
          });
      } catch {
        transitioning.current = false;
      }
    },
    [prefersReduced, fromClip, toClip],
  );

  return { toggleTheme };
}
