"use client";

import { useEffect, useRef } from "react";

/**
 * Lightweight, brand-safe interpretation of the supplied neon tube reference.
 * Canvas keeps the public hero interactive without shipping a WebGL engine into
 * the authenticated product. Motion is disabled for reduced-motion users.
 */
export function TubesHero({ children }: { children: React.ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let frame = 0;
    let time = 0;
    let pointerX = 0.62;
    let pointerY = 0.42;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const drawTube = (
      offset: number,
      color: string,
      thickness: number,
      phase: number,
    ) => {
      const drift = reduced.matches ? 0 : Math.sin(time * 0.00042 + phase) * 28;
      const influenceX = (pointerX - 0.5) * 105;
      const influenceY = (pointerY - 0.5) * 90;
      context.beginPath();
      context.moveTo(-80, height * (0.18 + offset));
      context.bezierCurveTo(
        width * 0.22 + drift,
        height * (0.04 + offset) + influenceY,
        width * 0.48 + influenceX,
        height * (0.78 - offset) - drift,
        width + 90,
        height * (0.3 + offset * 0.45),
      );
      context.strokeStyle = color;
      context.lineWidth = thickness;
      context.lineCap = "round";
      context.shadowColor = color;
      context.shadowBlur = thickness * 2.8;
      context.globalAlpha = 0.7;
      context.stroke();
      context.shadowBlur = 0;
      context.globalAlpha = 1;
    };

    const draw = (now: number) => {
      time = now;
      context.clearRect(0, 0, width, height);
      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#07131f");
      gradient.addColorStop(0.55, "#0b2031");
      gradient.addColorStop(1, "#08141f");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      drawTube(-0.08, "#24c3c8", 8, 0);
      drawTube(0.08, "#59d8dc", 5, 1.7);
      drawTube(0.22, "#1b4a76", 10, 3.1);
      drawTube(0.34, "#118e94", 4, 4.3);

      if (!reduced.matches && document.visibilityState === "visible") {
        frame = requestAnimationFrame(draw);
      }
    };

    const move = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerX = Math.max(
        0,
        Math.min(1, (event.clientX - rect.left) / rect.width),
      );
      pointerY = Math.max(
        0,
        Math.min(1, (event.clientY - rect.top) / rect.height),
      );
    };
    const visibility = () => {
      cancelAnimationFrame(frame);
      if (document.visibilityState === "visible")
        frame = requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    canvas.addEventListener("pointermove", move);
    document.addEventListener("visibilitychange", visibility);
    resize();
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointermove", move);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  return (
    <section className="relative isolate min-h-[560px] overflow-hidden border-b border-white/10">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_42%,rgba(36,195,200,0.14),transparent_42%),linear-gradient(90deg,rgba(5,15,24,0.18),rgba(5,15,24,0.72))]" />
      <div className="relative z-10">{children}</div>
    </section>
  );
}
