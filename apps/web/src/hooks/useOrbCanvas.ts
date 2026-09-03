'use client';

import { useEffect, useRef } from 'react';
import type { OrbMode } from '@/types';

// `level` is the real, smoothed 0-1 mic/output level (see useOrbCanvas's
// renderFrame) - listening/speaking blend a gentle ambient idle motion with
// however loud the actual audio is right now, so the orb visibly breathes
// with speech instead of just playing a canned loop. Modes with no
// corresponding real audio signal (thinking/error/idle) stay purely synthetic.
function ampFor(mode: OrbMode, t: number, level: number): number {
  if (mode === 'listening') {
    const ambient = 0.22 + 0.05 * Math.sin(t * 1.3);
    return ambient + level * 0.68;
  }
  if (mode === 'speaking') {
    const ambient = 0.26 + 0.05 * Math.sin(t * 1.7);
    return ambient + level * 0.78;
  }
  if (mode === 'thinking') return 0.3 + 0.06 * Math.sin(t * 2.2);
  if (mode === 'error') return 0.18 + 0.04 * Math.sin(t * 1.6);
  return 0.16 + 0.07 * Math.sin(t * 0.9);
}

function drawOrb(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  scale: number,
  mode: OrbMode,
  amp: number,
  isLight: boolean,
) {
  const cx = w / 2;
  const cy = h / 2;
  const err = mode === 'error';
  const hue = err ? (isLight ? [200, 70, 70] : [255, 150, 150]) : isLight ? [10, 130, 175] : [95, 216, 255];
  const C = (a: number) => `rgba(${hue[0]},${hue[1]},${hue[2]},${a})`;
  const base = w * 0.2 * scale;
  const r = base * (1 + amp * 0.18);
  ctx.clearRect(0, 0, w, h);

  const field = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.6);
  field.addColorStop(0, C(0.34 + amp * 0.2));
  field.addColorStop(0.35, C(0.09));
  field.addColorStop(1, C(0));
  ctx.fillStyle = field;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.6, 0, Math.PI * 2);
  ctx.fill();

  const core = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.25, 0, cx, cy, r);
  core.addColorStop(0, isLight ? C(0.95) : `rgba(255,255,255,${0.72 + amp * 0.2})`);
  core.addColorStop(0.4, C(0.5));
  core.addColorStop(1, C(0.05));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.52, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 3; i++) {
    const rr = r * (0.78 + i * 0.34) + amp * r * 0.12 * (i + 1);
    ctx.strokeStyle = C(0.2 - i * 0.05);
    ctx.lineWidth = w * 0.0016;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.stroke();
  }

  const arcs = mode === 'thinking' ? 5 : 3;
  for (let i = 0; i < arcs; i++) {
    const sp = (i % 2 ? -1 : 1) * (0.35 + i * 0.22) * (mode === 'thinking' ? 2.4 : 1);
    const rr = r * (1.02 + i * 0.24);
    const a0 = t * sp + i * 1.7;
    const len = 0.6 + 0.5 * Math.sin(t * 0.7 + i);
    ctx.strokeStyle = C(0.5 - i * 0.08);
    ctx.lineWidth = w * (i === 0 ? 0.0042 : 0.0024);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, rr, a0, a0 + len);
    ctx.stroke();
  }

  const n = 108;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const wobble = Math.sin(a * 6 + t * 4.2) * 0.5 + Math.sin(a * 13 - t * 2.6) * 0.5;
    const len = r * (0.1 + amp * 0.55 * (0.45 + 0.55 * Math.abs(wobble)));
    const r0 = r * 1.5;
    ctx.strokeStyle = C(0.1 + amp * 0.4 * (0.3 + 0.7 * Math.abs(wobble)));
    ctx.lineWidth = w * 0.0015;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
    ctx.stroke();
  }

  const pc = 22;
  for (let i = 0; i < pc; i++) {
    const a = t * (0.18 + (i % 5) * 0.07) + i * 2.399;
    const rr = r * (1.7 + ((i * 37) % 60) / 100) + Math.sin(t + i) * r * 0.05;
    ctx.fillStyle = C(0.25 + 0.4 * ((i % 3) / 3) * (0.5 + amp));
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, w * 0.0022, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draws the JARVIS orb (idle/listening/thinking/speaking/interrupted/error)
 * on a canvas via rAF. `getLevel`, when given, is polled every frame (not a
 * React value - audio levels change far faster than a re-render should) and
 * smoothed here before feeding ampFor, so raw analyser jitter doesn't make
 * the orb flicker.
 */
export function useOrbCanvas(mode: OrbMode, isLight: boolean, getLevel?: () => number) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let t = 0;
    let scale = 1;
    let smoothedLevel = 0;
    let raf = 0;

    const renderFrame = () => {
      const target = mode === 'interrupted' ? 0.72 : 1;
      scale += (target - scale) * 0.22;
      const rawLevel = getLevel ? getLevel() : 0;
      smoothedLevel += (rawLevel - smoothedLevel) * 0.35;
      drawOrb(ctx, canvas.width, canvas.height, t, scale, mode, ampFor(mode, t, smoothedLevel), isLight);
    };

    if (reduceMotion) {
      renderFrame();
      return;
    }

    const loop = () => {
      t += 1 / 60;
      renderFrame();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mode, isLight, getLevel]);

  return canvasRef;
}
