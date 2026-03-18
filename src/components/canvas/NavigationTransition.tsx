import { useEffect, useRef, useState } from 'react';
import type { TransitionData } from './hooks/useNavigationTransition';

interface NavigationTransitionProps {
  data: TransitionData | null;
}

const TRANSITION_DURATION = 350; // ms — must match hook

export function NavigationTransition({ data }: NavigationTransitionProps) {
  const [phase, setPhase] = useState<'initial' | 'animate'>('initial');
  const overlayRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);

  // Reset phase when data changes
  useEffect(() => {
    if (!data) {
      setPhase('initial');
      completedRef.current = false;
      return;
    }
    // Start in initial phase, then trigger animation on next frame
    setPhase('initial');
    completedRef.current = false;
    const raf = requestAnimationFrame(() => {
      setPhase('animate');
    });
    return () => cancelAnimationFrame(raf);
  }, [data]);

  // Safety: call onComplete after duration if transitionend doesn't fire
  useEffect(() => {
    if (!data || phase !== 'animate') return;
    const timer = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        data.onComplete();
      }
    }, TRANSITION_DURATION + 50);
    return () => clearTimeout(timer);
  }, [data, phase]);

  if (!data) return null;

  const handleTransitionEnd = () => {
    if (!completedRef.current) {
      completedRef.current = true;
      data.onComplete();
    }
  };

  // -------------------------------------------------------------------
  // Dissolve transition (breadcrumb jumps)
  // -------------------------------------------------------------------
  if (data.direction === 'dissolve') {
    return (
      <div
        ref={overlayRef}
        className="navigation-transition-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          backgroundColor: 'var(--color-background)',
          opacity: phase === 'animate' ? 0 : 1,
          transition: `opacity ${TRANSITION_DURATION}ms ease-out`,
          pointerEvents: 'none',
        }}
        onTransitionEnd={handleTransitionEnd}
      />
    );
  }

  // -------------------------------------------------------------------
  // Morph transition (dive-in / go-up)
  // -------------------------------------------------------------------
  const isIn = data.direction === 'in';

  return (
    <div
      ref={overlayRef}
      className="navigation-transition-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Semi-transparent backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'var(--color-background)',
          opacity: phase === 'animate' ? (isIn ? 0 : 0.6) : (isIn ? 0.6 : 0),
          transition: `opacity ${TRANSITION_DURATION}ms ease-in-out`,
        }}
      />

      {/* Container border morph */}
      {data.containerRect && (
        <div
          style={{
            position: 'fixed',
            left: isIn
              ? (phase === 'animate' ? 0 : data.containerRect.left)
              : (phase === 'animate' ? data.containerRect.left : 0),
            top: isIn
              ? (phase === 'animate' ? 0 : data.containerRect.top)
              : (phase === 'animate' ? data.containerRect.top : 0),
            width: isIn
              ? (phase === 'animate' ? '100vw' : data.containerRect.width)
              : (phase === 'animate' ? data.containerRect.width : '100vw'),
            height: isIn
              ? (phase === 'animate' ? '100vh' : data.containerRect.height)
              : (phase === 'animate' ? data.containerRect.height : '100vh'),
            border: '2px dashed var(--color-node-ref-border)',
            borderRadius: phase === 'animate' && isIn ? '0px' : '8px',
            opacity: phase === 'animate' ? 0 : 1,
            transition: `all ${TRANSITION_DURATION}ms ease-in-out`,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Sibling nodes fade */}
      {data.siblings.map((sib) => (
        <div
          key={sib.id}
          style={{
            position: 'fixed',
            left: sib.rect.left,
            top: sib.rect.top,
            width: sib.rect.width,
            height: sib.rect.height,
            backgroundColor: 'var(--color-node-bg)',
            border: '1.5px solid var(--color-node-border)',
            borderRadius: '6px',
            opacity: isIn
              ? (phase === 'animate' ? 0 : 1)
              : (phase === 'animate' ? 1 : 0),
            transition: `opacity ${TRANSITION_DURATION * 0.6}ms ease-out`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            color: 'var(--color-foreground)',
            pointerEvents: 'none',
          }}
        >
          {sib.label}
        </div>
      ))}

      {/* Child nodes morph — last one triggers transitionend */}
      {data.nodes.map((node, i) => (
        <div
          key={node.id}
          style={{
            position: 'fixed',
            left: node.rect.left,
            top: node.rect.top,
            width: node.rect.width,
            height: node.rect.height,
            backgroundColor: 'var(--color-node-bg)',
            border: '1.5px solid var(--color-node-border)',
            borderRadius: '6px',
            opacity: phase === 'animate' ? 1 : 0,
            transform: phase === 'animate' ? 'scale(1)' : 'scale(0.5)',
            transition: `all ${TRANSITION_DURATION}ms ease-out`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            color: 'var(--color-foreground)',
            pointerEvents: 'none',
          }}
          onTransitionEnd={i === data.nodes.length - 1 ? handleTransitionEnd : undefined}
        >
          {node.label}
        </div>
      ))}

      {/* If no child nodes, use the backdrop transition to trigger end */}
      {data.nodes.length === 0 && (
        <div
          style={{
            opacity: phase === 'animate' ? 0 : 1,
            transition: `opacity ${TRANSITION_DURATION}ms ease-out`,
          }}
          onTransitionEnd={handleTransitionEnd}
        />
      )}
    </div>
  );
}
