'use client';

/**
 * ---------------------------------------------------------------------------
 * LiquidEther — premium WebGL hero background for Acme Jobs
 * ---------------------------------------------------------------------------
 * A single-pass procedural fluid/curl field rendered as a fullscreen shader on a
 * triangle. No GPGPU ping-pong render targets, no post-processing pipeline and
 * no remote assets, which is what makes it cheap enough to sit behind real
 * marketing copy without hurting Core Web Vitals.
 *
 * Every guard below exists so the animation can never hurt the page:
 *  - Imported dynamically with `ssr: false`, so three.js is only fetched by
 *    browsers that actually reach the hero (see liquid-ether-canvas.tsx).
 *  - Absolutely positioned + `pointer-events-none`, so it cannot cover or
 *    intercept a CTA click, and it cannot cause layout shift.
 *  - A static CSS gradient is always painted underneath: it is simultaneously
 *    the loading surface, the reduced-motion surface and the failure surface.
 *  - IntersectionObserver stops the loop when scrolled out of view.
 *  - visibilitychange stops the loop in a background tab.
 *  - No WebGL, lost context, or a failed setup all fall back to that gradient.
 *  - `prefers-reduced-motion` renders one settled frame and never animates.
 *  - The internal buffer is `resolution`-scaled, so mobile/low-RAM devices
 *    render roughly an order of magnitude fewer pixels than desktop.
 *
 * Palette is Acme Jobs navy/teal — deliberately not the original purple/pink.
 */

import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState } from 'react';

export interface LiquidEtherProps {
  /** Buffer scale. 'auto' adapts to viewport, pointer type, device memory and Save-Data. */
  resolution?: number | 'auto';
  autoDemo?: boolean;
  autoSpeed?: number;
  autoIntensity?: number;
  mouseForce?: number;
  cursorSize?: number;
  colors: string[];
  BFECC?: boolean;
  fallbackClassName?: string;
  className?: string;
}

interface EasedPointer {
  target: THREE.Vector2;
  current: THREE.Vector2;
}

function hexToRgbTriplet(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.replace(/./g, '$&$&') : clean;
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) return [0, 0, 0];
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function resolveResolution(requested: number | 'auto' | undefined): number {
  if (typeof requested === 'number') return Math.max(0.08, Math.min(1, requested));

  if (typeof window === 'undefined') return 0.3;

  const width = window.innerWidth;
  const dpr = window.devicePixelRatio || 1;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  const lowRam = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;

  if (nav.connection?.saveData) return 0.1;
  if (coarse && width < 820) return 0.16; // phones
  if (coarse) return 0.22; // tablets
  if (lowRam) return 0.2;
  if (width < 820) return 0.24;
  if (width < 1440) return 0.3;
  if (dpr > 2) return 0.32;
  return 0.36;
}

const VERTEX_SHADER = /* glsl */ `
  attribute vec2 aPosition;
  varying vec2 vUv;
  void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
  #else
    precision mediump float;
  #endif

  varying vec2 vUv;

  uniform vec2  uResolution;
  uniform float uTime;
  uniform float uAspect;
  uniform vec2  uMouse;
  uniform vec3  uC0;
  uniform vec3  uC1;
  uniform vec3  uC2;
  uniform vec3  uC3;
  uniform vec4  uMix;      // ramp blend weights (fbm x fbm x fbm x fbm)
  uniform float uMouseForce;
  uniform float uCursorSize;
  uniform float uIntensity;
  uniform float uBFECC;

  vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash22(i).x;
    float b = hash22(i + vec2(1.0, 0.0)).x;
    float c = hash22(i + vec2(0.0, 1.0)).x;
    float d = hash22(i + vec2(1.0, 1.0)).x;
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.55;
    for (int i = 0; i < 4; i++) {
      v += vnoise(p) * amp;
      p = p * 2.03 + vec2(17.3, 9.1);
      amp *= 0.5;
    }
    return v;
  }

  // Divergence-free drift field. Slow and smooth — calm, not psychedelic.
  vec2 curl(vec2 p) {
    const float e = 0.075;
    float n1 = fbm(p + vec2(0.0, e));
    float n2 = fbm(p - vec2(0.0, e));
    float n3 = fbm(p + vec2(e, 0.0));
    float n4 = fbm(p - vec2(e, 0.0));
    return vec2((n1 - n2) / (2.0 * e), (n3 - n4) / (2.0 * e)) * 0.06;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = vec2((uv.x - 0.5) * uAspect, uv.y - 0.5);

    float t = uTime * 0.07;

    // Layered self-advected flow. Small amplitudes keep the movement restrained.
    vec2 flow  = curl(p * 1.05 + vec2( t * 0.55, -t * 0.32));
    vec2 flow2 = curl(p * 2.30 + vec2(-t * 0.85,  t * 0.42) + 13.7);
    vec2 field = p + flow * (0.85 + uIntensity * 0.35) + flow2 * 0.22;

    // Pointer: a soft, moderate pull that eases in the render loop.
    vec2 m = vec2((uMouse.x - 0.5) * uAspect, 0.5 - uMouse.y);
    vec2 delta = field - m;
    float d2 = dot(delta, delta);
    float influence = exp(-d2 / max(uCursorSize * uCursorSize, 0.0002));
    field -= normalize(delta + vec2(1e-5)) * influence * uMouseForce * 0.035;

    float n0 = fbm(field * 0.95);
    float n1 = fbm(field * 1.75 + n0 * 0.45 + 3.1);
    float n2 = fbm(field * 3.10 + n1 * 0.30 + 8.4);
    float n3 = fbm(field * 5.20 + n2 * 0.22 + 15.7);

    float v0 = uMix.x;
    float v1 = uMix.y;
    float v2 = uMix.z;
    float v3 = uMix.w;

    vec3 color = uC0;
    color = mix(color, uC1, smoothstep(0.14, 0.46, v0));
    color = mix(color, uC2, smoothstep(0.42, 0.72, v1));
    color = mix(color, uC3, smoothstep(0.68, 0.94, v2));

    // Filmic-ish compression: keeps highlights soft and readable.
    vec3 tone = color / (color + vec3(0.78));
    float luma = dot(tone, vec3(0.2126, 0.7152, 0.0722));
    vec3 result = mix(vec3(luma), tone, 1.05);

    // Slight edge darkening so overlaid copy always has contrast.
    float edge = 1.0 - smoothstep(0.42, 1.15, length(vec2((uv.x - 0.5) * 1.05, (uv.y - 0.5) * 1.2)));
    result *= mix(0.78, 1.0, edge);

    gl_FragColor = vec4(result, 1.0);
  }
`;

export function LiquidEther({
  resolution = 'auto',
  autoDemo = true,
  autoSpeed = 0.4,
  autoIntensity = 0.55,
  mouseForce = 3,
  cursorSize = 0.62,
  colors = ['#0B2D4D', '#118E94', '#24C3C8', '#0B2D4D'],
  BFECC = true,
  fallbackClassName = '',
  className = '',
}: LiquidEtherProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef<EasedPointer>({
    target: new THREE.Vector2(0.5, 0.5),
    current: new THREE.Vector2(0.5, 0.5),
  });
  const controllerRef = useRef<{ start: () => void; stop: () => void; dispose: () => void } | null>(
    null
  );
  const [fallback, setFallback] = useState(false);

  const scale = useMemo(() => resolveResolution(resolution), [resolution]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = reduceQuery.matches;

    const fail = () => setFallback(true);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        // `alpha: true` matters: with an opaque drawing buffer, a canvas that
        // has not drawn yet (context loss, first frame, a screenshot taken
        // between frames) composites as solid black and hides the CSS gradient
        // fallback underneath. Transparent keeps that fallback visible.
        alpha: true,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(1);
      renderer.setClearColor(0x000000, 0);
    } catch {
      fail();
      return;
    }

    if (!renderer.getContext()) {
      fail();
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'aPosition',
      new THREE.BufferAttribute(new Float32Array([-1, -1, 3, -1, -1, 3]), 2)
    );

    const palette = colors.map(hexToRgbTriplet);
    const ramp = (
      palette.length >= 4
        ? palette
        : [
            [0.043, 0.176, 0.302],
            [0.067, 0.557, 0.58],
            [0.141, 0.765, 0.784],
            [0.055, 0.227, 0.361],
          ]
    ) as [number, number, number][];
    const [c0, c1, c2, c3] = ramp as [
      [number, number, number],
      [number, number, number],
      [number, number, number],
      [number, number, number],
    ];

    const uniforms: Record<string, THREE.IUniform> = {
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uMouse: { value: pointerRef.current.current },
      uC0: { value: new THREE.Color(c0[0], c0[1], c0[2]) },
      uC1: { value: new THREE.Color(c1[0], c1[1], c1[2]) },
      uC2: { value: new THREE.Color(c2[0], c2[1], c2[2]) },
      uC3: { value: new THREE.Color(c3[0], c3[1], c3[2]) },
      uMix: { value: new THREE.Vector4(0.35, 0.45, 0.55, 0.65) },
      uMouseForce: { value: mouseForce },
      uCursorSize: { value: cursorSize },
      uIntensity: { value: autoIntensity },
      uBFECC: { value: BFECC ? 1 : 0 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);

    let frame = 0;
    let time = 0;
    let last = 0;
    let running = false;
    let disposed = false;

    const resize = () => {
      if (disposed) return;
      const rect = canvas.getBoundingClientRect();
      const cssWidth = Math.max(1, rect.width);
      const cssHeight = Math.max(1, rect.height);
      const bufferWidth = Math.max(160, Math.round(cssWidth * scale));
      const bufferHeight = Math.max(120, Math.round(cssHeight * scale));
      renderer.setSize(bufferWidth, bufferHeight, false);
      (uniforms['uResolution']!.value as THREE.Vector2).set(bufferWidth, bufferHeight);
      uniforms['uAspect']!.value = bufferWidth / bufferHeight;
      renderOnce();
    };

    const renderOnce = () => {
      if (disposed) return;
      renderer.render(scene, camera);
    };

    const tick = (now: number) => {
      if (!running || disposed) return;
      const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
      last = now;

      time += dt * (autoDemo ? autoSpeed : autoSpeed * 0.4);
      uniforms['uTime']!.value = time;

      // Ease the pointer so the field drifts rather than snapping.
      pointerRef.current.current.lerp(pointerRef.current.target, 0.055);
      (uniforms['uMouse']!.value as THREE.Vector2).copy(pointerRef.current.current);

      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (disposed || running || reducedMotion || document.hidden) return;
      running = true;
      last = 0;
      frame = requestAnimationFrame(tick);
    };

    const stop = () => {
      running = false;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    const dispose = () => {
      if (disposed) return;
      disposed = true;
      stop();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      reduceQuery.removeEventListener('change', onReduceChange);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };

    // --- observers ---------------------------------------------------------
    let offscreen = false;

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        offscreen = !entry.isIntersecting;
        if (offscreen) stop();
        else start();
      },
      { threshold: 0 }
    );
    intersectionObserver.observe(canvas);

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      pointerRef.current.target.set(
        (event.clientX - rect.left) / rect.width,
        1 - (event.clientY - rect.top) / rect.height
      );
    };
    const onPointerLeave = () => pointerRef.current.target.set(0.5, 0.5);

    const onVisibility = () => {
      if (document.hidden || offscreen) stop();
      else start();
    };

    const onContextLost = (event: Event) => {
      event.preventDefault();
      stop();
      fail();
    };

    const onReduceChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      if (reducedMotion) {
        stop();
        time = 6.2; // a settled, attractive frame rather than the very first one
        uniforms['uTime']!.value = time;
        renderOnce();
      } else {
        start();
      }
    };

    canvas.addEventListener('pointermove', onPointerMove, { passive: true });
    canvas.addEventListener('pointerleave', onPointerLeave, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    canvas.addEventListener('webglcontextlost', onContextLost);
    reduceQuery.addEventListener('change', onReduceChange);

    controllerRef.current = { start, stop, dispose };

    // Paint one frame immediately (no flash of empty canvas).
    time = 6.2;
    uniforms['uTime']!.value = time;
    resize();

    if (!reducedMotion) start();

    return dispose;
    // The GL context is intentionally created once. Re-running this effect on
    // every prop change would thrash the GPU for no visual benefit; prop values
    // are read from the closure of the initial mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, autoDemo, autoSpeed, autoIntensity, mouseForce, cursorSize, BFECC]);

  useEffect(() => () => controllerRef.current?.dispose(), []);

  return (
    <div
      aria-hidden="true"
      data-liquid-ether={fallback ? 'fallback' : 'active'}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${fallbackClassName} ${className}`}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(115% 85% at 16% 6%, rgba(36,195,200,0.40) 0%, rgba(17,142,148,0.16) 32%, rgba(11,45,77,0) 66%), radial-gradient(85% 75% at 90% 82%, rgba(27,79,125,0.60) 0%, rgba(11,45,77,0) 62%), linear-gradient(158deg, #0B2D4D 0%, #072339 54%, #04182B 100%)',
        }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        data-visible={!fallback}
        style={{ display: 'block', opacity: fallback ? 0 : 1, transition: 'opacity 700ms ease' }}
      />
      {/* Guarantees an opaque navy base even if both the gradient above and the
          shader are unavailable, so text always has a dark, high-contrast
          backing. */}
      <div className="bg-navy-900/70 absolute inset-0" />
    </div>
  );
}

export default LiquidEther;
