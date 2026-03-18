import { useEffect, useRef, useState } from 'react';
import type { TransitionData } from './hooks/useNavigationTransition';

interface NavigationTransitionProps {
  data: TransitionData | null;
}

const TRANSITION_DURATION = 350; // ms — must match hook

export function NavigationTransition({ data }: NavigationTransitionProps) {
  const [phase, setPhase] = useState<'source' | 'animate'>('source');
  const overlayRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);
  const currentTransitionRef = useRef<string | null>(null);

  // Phase management: distinguish "new transition" from "targets arrived"
  useEffect(() => {
    if (!data) {
      setPhase('source');
      currentTransitionRef.current = null;
      completedRef.current = false;
      return;
    }

    // New transition: reset to source phase
    if (data.fromCanvasId !== currentTransitionRef.current) {
      currentTransitionRef.current = data.fromCanvasId;
      setPhase('source');
      completedRef.current = false;
      // Don't return — fall through to check targetsReady (dissolve is ready immediately)
    }

    // Advance to animate when targets are ready (after one frame for layout)
    if (data.targetsReady && phase === 'source') {
      const raf = requestAnimationFrame(() => setPhase('animate'));
      return () => cancelAnimationFrame(raf);
    }
  }, [data, phase]);

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
  // Dissolve transition (breadcrumb jumps) — unchanged
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

  // Build matched + unmatched node lists
  const matchedSource = data.sourceNodes.map((src) => ({
    src,
    tgt: data.targetNodes.find((t) => t.id === src.id) ?? null,
  }));
  const unmatchedTargets = data.targetNodes.filter(
    (tgt) => !data.sourceNodes.some((src) => src.id === tgt.id),
  );
  // For transitionend: pick the last rendered clone
  const totalClones = matchedSource.length + unmatchedTargets.length;
  let cloneIndex = 0;

  // Determine container rects for source/target
  const srcContainer = data.containerRect;
  const tgtContainer = data.targetContainerRect;

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
      {/* Opaque backdrop — covers canvas during source phase, fades on animate */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'var(--color-background)',
          opacity: phase === 'animate' ? 0 : 0.95,
          transition: `opacity ${TRANSITION_DURATION}ms ease-in-out`,
        }}
      />

      {/* Container border morph — explicit per-direction rects */}
      {(() => {
        // Dive-in: container starts at containerRect, expands to viewport
        // Go-up: container starts at viewport, shrinks to targetContainerRect
        // Only render when we have the relevant rect
        const rect = isIn ? srcContainer : tgtContainer;
        if (!rect) return null;

        const startLeft = isIn ? rect.left : 0;
        const startTop = isIn ? rect.top : 0;
        const startWidth = isIn ? rect.width : '100vw';
        const startHeight = isIn ? rect.height : '100vh';
        const endLeft = isIn ? 0 : rect.left;
        const endTop = isIn ? 0 : rect.top;
        const endWidth = isIn ? '100vw' : rect.width;
        const endHeight = isIn ? '100vh' : rect.height;

        return (
          <div
            style={{
              position: 'fixed',
              left: phase === 'animate' ? endLeft : startLeft,
              top: phase === 'animate' ? endTop : startTop,
              width: phase === 'animate' ? endWidth : startWidth,
              height: phase === 'animate' ? endHeight : startHeight,
              border: '2px dashed var(--color-node-ref-border)',
              borderRadius: '8px',
              opacity: phase === 'animate' ? 0.3 : 1,
              transition: `all ${TRANSITION_DURATION}ms ease-in-out`,
              pointerEvents: 'none',
            }}
          />
        );
      })()}

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

      {/* Matched clones: morph from source → target positions */}
      {matchedSource.map(({ src, tgt }) => {
        const idx = cloneIndex++;
        const isAnimating = phase === 'animate' && tgt;

        return (
          <div
            key={src.id}
            style={{
              position: 'fixed',
              left: isAnimating ? tgt.rect.left : src.rect.left,
              top: isAnimating ? tgt.rect.top : src.rect.top,
              width: isAnimating ? tgt.rect.width : src.rect.width,
              height: isAnimating ? tgt.rect.height : src.rect.height,
              backgroundColor: src.color
                ? `color-mix(in srgb, ${src.color} 15%, var(--color-node-bg))`
                : 'var(--color-node-bg)',
              border: `1.5px solid ${src.color || 'var(--color-node-border)'}`,
              borderRadius: '6px',
              opacity: phase === 'animate' && !tgt ? 0 : 1,
              transition: `all ${TRANSITION_DURATION}ms ease-in-out`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isAnimating ? '12px' : '7px',
              color: 'var(--color-foreground)',
              pointerEvents: 'none',
              overflow: 'hidden',
            }}
            onTransitionEnd={idx === totalClones - 1 ? handleTransitionEnd : undefined}
          >
            {isAnimating ? tgt.label : src.label}
          </div>
        );
      })}

      {/* Unmatched target clones: fade in at target positions */}
      {unmatchedTargets.map((tgt) => {
        const idx = cloneIndex++;

        return (
          <div
            key={tgt.id}
            style={{
              position: 'fixed',
              left: tgt.rect.left,
              top: tgt.rect.top,
              width: tgt.rect.width,
              height: tgt.rect.height,
              backgroundColor: 'var(--color-node-bg)',
              border: '1.5px solid var(--color-node-border)',
              borderRadius: '6px',
              opacity: phase === 'animate' ? 1 : 0,
              transition: `opacity ${TRANSITION_DURATION}ms ease-in-out`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: 'var(--color-foreground)',
              pointerEvents: 'none',
            }}
            onTransitionEnd={idx === totalClones - 1 ? handleTransitionEnd : undefined}
          >
            {tgt.label}
          </div>
        );
      })}

      {/* If no clones at all, use the backdrop to trigger end */}
      {totalClones === 0 && (
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
