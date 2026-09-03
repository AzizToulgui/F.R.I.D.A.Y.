'use client';

import { useOrbCanvas } from '@/hooks/useOrbCanvas';
import type { OrbMode } from '@/types';

interface OrbProps {
  mode: OrbMode;
  isLight: boolean;
  size: 'home' | 'voice';
  /** Real mic/output level to react to, 0-1 - see useLiveSession. Omit for a purely synthetic animation. */
  getLevel?: () => number;
}

export function Orb({ mode, isLight, size, getLevel }: OrbProps) {
  const canvasRef = useOrbCanvas(mode, isLight, getLevel);
  const intrinsic = size === 'home' ? 360 : 760;

  return (
    <canvas
      ref={canvasRef}
      width={intrinsic}
      height={intrinsic}
      aria-hidden="true"
      className={
        size === 'home'
          ? 'aspect-square h-[180px] w-[180px]'
          : 'aspect-square h-full w-full max-h-[min(46vh,360px)] max-w-[min(100%,360px)]'
      }
    />
  );
}
