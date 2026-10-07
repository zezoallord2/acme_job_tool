'use client';

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { LiquidEtherProps } from './liquid-ether';

/**
 * three.js is code-split: this lazy import means the WebGL bundle is fetched
 * only by browsers that reach a section containing the effect. Pages without a
 * LiquidEther section never download it at all.
 *
 * React.lazy + Suspense is used instead of a framework dynamic import so the
 * chunk is still fetched on demand, and the Suspense boundary keeps the static
 * gradient visible while it is in flight.
 */
const LazyLiquidEther = lazy(() => import('./liquid-ether').then((mod) => ({ default: mod.LiquidEther })));

type Mount = 'idle' | 'inview';

export interface LiquidEtherCanvasProps extends LiquidEtherProps {
  /** Load as soon as the browser is idle instead of waiting for scroll proximity. */
  eager?: boolean;
}

/**
 * Lazily mounts the WebGL effect.
 *
 * The static gradient fallback is owned by the caller's section background, so
 * nothing is ever visually empty while three.js is in flight.
 */
export function LiquidEtherCanvas({ eager = false, ...props }: LiquidEtherCanvasProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [mount, setMount] = useState<Mount>(eager ? 'inview' : 'idle');

  useEffect(() => {
    if (mount === 'inview') return;

    const sentinel = sentinelRef.current;
    const activate = () => setMount('inview');

    const hasIdle = typeof window.requestIdleCallback === 'function';
    const idleId: number = hasIdle
      ? window.requestIdleCallback(activate, { timeout: 2500 })
      : window.setTimeout(activate, 600);

    const cancelIdle = () => {
      if (hasIdle) window.cancelIdleCallback?.(idleId);
      else window.clearTimeout(idleId);
    };

    if (!sentinel || !('IntersectionObserver' in window)) {
      return cancelIdle;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setMount('inview');
          observer.disconnect();
        }
      },
      { rootMargin: '320px 0px' }
    );
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      cancelIdle();
    };
  }, [mount, eager]);

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="absolute inset-0 -z-10" />
      {mount === 'inview' ? (
        <Suspense fallback={null}>
          <LazyLiquidEther {...props} />
        </Suspense>
      ) : null}
    </>
  );
}

export default LiquidEtherCanvas;
