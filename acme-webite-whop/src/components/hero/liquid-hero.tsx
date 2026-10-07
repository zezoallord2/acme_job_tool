'use client';

import { LiquidEtherCanvas } from '@/components/fx/liquid-ether-canvas';
import { liquidEtherPresets, liquidPalette } from '@/content/marketing';

export interface LiquidHeroProps {
  /** `hero` for the main banner, `band` for the secondary premium CTA block. */
  variant?: 'hero' | 'band';
  className?: string;
  children?: React.ReactNode;
}

/**
 * LiquidEther background layer.
 *
 * The static navy/teal gradient is painted by CSS on the section itself, so:
 *  - there is never an empty frame while three.js loads,
 *  - reduced-motion users get a designed gradient instead of a blank space,
 *  - a WebGL failure changes nothing,
 *  - and the layer is `pointer-events-none`, so it can never swallow a CTA click.
 */
export function LiquidHero({ variant = 'hero', className = '', children }: LiquidHeroProps) {
  const preset = liquidEtherPresets[variant];

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{
        backgroundImage:
          'radial-gradient(115% 88% at 14% 4%, rgba(36,195,200,0.42) 0%, rgba(17,142,148,0.16) 30%, rgba(11,45,77,0) 64%), radial-gradient(88% 78% at 92% 84%, rgba(27,79,125,0.62) 0%, rgba(11,45,77,0) 60%), linear-gradient(158deg, #0B2D4D 0%, #072339 52%, #04182B 100%)',
      }}
    >
      <LiquidEtherCanvas
        colors={[...liquidPalette]}
        autoDemo={preset.autoDemo}
        autoSpeed={preset.autoSpeed}
        autoIntensity={preset.autoIntensity}
        mouseForce={preset.mouseForce}
        cursorSize={preset.cursorSize}
        resolution={preset.resolution}
        BFECC={preset.BFECC}
        eager={variant === 'hero'}
        className="absolute inset-0"
      />
      {children}
    </div>
  );
}

export default LiquidHero;
