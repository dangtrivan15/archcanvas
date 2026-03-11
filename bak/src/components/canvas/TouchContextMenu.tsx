/**
 * TouchContextMenu - iOS-native-feeling context menu base component.
 * Features: blur backdrop, rounded corners, spring animation, swipe-to-dismiss,
 * edge-aware positioning, cascading submenu support.
 * Used by CanvasContextMenu, NodeContextMenu, and EdgeContextMenu.
 */

import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';

// ---------- Types ----------

export interface ContextMenuItem {
  label: string;
  icon: LucideIcon;
  action?: () => void;
  testId?: string;
  disabled?: boolean;
  isDanger?: boolean;
  /** If set, this item opens a cascading submenu */
  submenu?: ContextMenuItem[];
}

export interface TouchContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  header?: ReactNode;
  items: ContextMenuItem[];
}

// ---------- Edge-aware positioning ----------

function clampPosition(x: number, y: number, menuW: number, menuH: number) {
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let cx = x;
  let cy = y;
  if (cx + menuW + pad > vw) cx = vw - menuW - pad;
  if (cy + menuH + pad > vh) cy = vh - menuH - pad;
  if (cx < pad) cx = pad;
  if (cy < pad) cy = pad;
  return { x: cx, y: cy };
}

// ---------- Component ----------

export function TouchContextMenu({ x, y, onClose, header, items }: TouchContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  const [visible, setVisible] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const submenuRef = useRef<HTMLDivElement>(null);

  // Swipe-to-dismiss state
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeOffsetRef = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);

  // Edge-aware position + spring-in animation
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      setPos(clampPosition(x, y, rect.width, rect.height));
    }
    // Trigger spring animation after mount
    requestAnimationFrame(() => setVisible(true));
  }, [x, y]);

  // Close on outside click (touch or mouse)
  useEffect(() => {
    const handle = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        (!submenuRef.current || !submenuRef.current.contains(target))
      ) {
        onClose();
      }
    };
    const id = setTimeout(() => {
      document.addEventListener('mousedown', handle);
      document.addEventListener('touchstart', handle, { passive: true });
    }, 10);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('touchstart', handle);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  // Swipe-to-dismiss handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0] as Touch | undefined;
    if (!t) return;
    swipeStartRef.current = { x: t.clientX, y: t.clientY };
    swipeOffsetRef.current = 0;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipeStartRef.current) return;
    const t = e.touches[0] as Touch | undefined;
    if (!t) return;
    const dy = t.clientY - swipeStartRef.current.y;
    // Only allow downward swipe-to-dismiss
    if (dy > 0) {
      swipeOffsetRef.current = dy;
      setSwipeOffset(dy);
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (swipeOffsetRef.current > 80) {
      // Dismiss threshold
      onClose();
    } else {
      setSwipeOffset(0);
    }
    swipeStartRef.current = null;
    swipeOffsetRef.current = 0;
  }, [onClose]);

  // Submenu positioning
  const getSubmenuPos = useCallback((itemEl: HTMLElement) => {
    const rect = itemEl.getBoundingClientRect();
    const submenuW = 200;
    const submenuH = 200; // estimate
    const pad = 8;
    let sx = rect.right + 4;
    let sy = rect.top;
    // If overflows right, show on left
    if (sx + submenuW + pad > window.innerWidth) {
      sx = rect.left - submenuW - 4;
    }
    // If overflows bottom
    if (sy + submenuH + pad > window.innerHeight) {
      sy = window.innerHeight - submenuH - pad;
    }
    if (sy < pad) sy = pad;
    return { x: sx, y: sy };
  }, []);

  const [submenuPos, setSubmenuPos] = useState({ x: 0, y: 0 });
  const activeSubmenuItems = items.find((it) => it.label === activeSubmenu)?.submenu ?? [];

  const handleSubmenuHover = useCallback(
    (label: string, el: HTMLElement) => {
      setActiveSubmenu(label);
      setSubmenuPos(getSubmenuPos(el));
    },
    [getSubmenuPos],
  );

  const dismissOpacity = Math.max(0, 1 - swipeOffset / 200);

  return (
    <>
      {/* Backdrop - subtle dark overlay for context */}
      <div
        className="fixed inset-0 z-[99]"
        style={{ opacity: dismissOpacity * 0.15, backgroundColor: 'black' }}
        onClick={onClose}
      />

      {/* Main menu */}
      <div
        ref={menuRef}
        className="fixed z-[100] min-w-[200px] max-w-[280px]"
        style={{
          left: pos.x,
          top: pos.y,
          transform: visible
            ? `translateY(${swipeOffset}px) scale(1)`
            : 'translateY(-8px) scale(0.92)',
          opacity: visible ? dismissOpacity : 0,
          transition:
            swipeOffset > 0
              ? 'none'
              : 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.18s ease-out',
          transformOrigin: 'top left',
        }}
        role="menu"
        data-testid="touch-context-menu"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="rounded-xl overflow-hidden shadow-2xl border border-white/20"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          }}
        >
          {/* Optional header */}
          {header && (
            <div className="px-4 py-2.5 text-xs font-semibold text-gray-500 border-b border-gray-200/60 truncate tracking-wide uppercase">
              {header}
            </div>
          )}

          {/* Menu items */}
          <div className="py-1">
            {items.map((item) => {
              const Icon = item.icon;
              const hasSubmenu = item.submenu && item.submenu.length > 0;
              const isActive = activeSubmenu === item.label;

              return (
                <button
                  key={item.label}
                  onClick={(e) => {
                    if (item.disabled) return;
                    if (hasSubmenu) {
                      handleSubmenuHover(item.label, e.currentTarget);
                      return;
                    }
                    item.action?.();
                  }}
                  onPointerEnter={(e) => {
                    if (hasSubmenu) {
                      handleSubmenuHover(item.label, e.currentTarget);
                    } else {
                      setActiveSubmenu(null);
                    }
                  }}
                  disabled={item.disabled}
                  className={`
                    flex items-center gap-3 w-full px-4 py-2.5 text-[14px] text-left
                    transition-colors duration-100 touch-target-row select-none
                    ${
                      item.disabled
                        ? 'text-gray-300 cursor-not-allowed'
                        : item.isDanger
                          ? 'text-red-500 active:bg-red-100/80 hover:bg-red-50/80'
                          : isActive
                            ? 'bg-blue-500/10 text-blue-600'
                            : 'text-gray-800 active:bg-gray-200/60 hover:bg-gray-100/60'
                    }
                  `}
                  role="menuitem"
                  data-testid={item.testId}
                >
                  <Icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.8} />
                  <span className="flex-1 font-medium">{item.label}</span>
                  {hasSubmenu && <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cascading submenu */}
      {activeSubmenu && activeSubmenuItems.length > 0 && (
        <div
          ref={submenuRef}
          className="fixed z-[101] min-w-[180px] max-w-[240px]"
          style={{
            left: submenuPos.x,
            top: submenuPos.y,
            transform: 'scale(1)',
            opacity: 1,
            animation: 'touchMenuIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            transformOrigin: 'top left',
          }}
          role="menu"
          data-testid="touch-context-submenu"
        >
          <div
            className="rounded-xl overflow-hidden shadow-2xl border border-white/20"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.88)',
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            }}
          >
            <div className="py-1">
              {activeSubmenuItems.map((sub) => {
                const SubIcon = sub.icon;
                return (
                  <button
                    key={sub.label}
                    onClick={() => {
                      if (!sub.disabled) sub.action?.();
                    }}
                    disabled={sub.disabled}
                    className={`
                      flex items-center gap-3 w-full px-4 py-2.5 text-[14px] text-left
                      transition-colors duration-100 touch-target-row select-none
                      ${
                        sub.disabled
                          ? 'text-gray-300 cursor-not-allowed'
                          : sub.isDanger
                            ? 'text-red-500 active:bg-red-100/80 hover:bg-red-50/80'
                            : 'text-gray-800 active:bg-gray-200/60 hover:bg-gray-100/60'
                      }
                    `}
                    role="menuitem"
                    data-testid={sub.testId}
                  >
                    <SubIcon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.8} />
                    <span className="flex-1 font-medium">{sub.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Keyframe for submenu animation */}
      <style>{`
        @keyframes touchMenuIn {
          from { transform: translateY(-4px) scale(0.95); opacity: 0; }
          to   { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}
