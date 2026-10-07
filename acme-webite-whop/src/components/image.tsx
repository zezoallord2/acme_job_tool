import * as React from 'react';

/**
 * Drop-in replacement for `next/image`.
 *
 * The only consumer is the product gallery, which ships an empty manifest today.
 * This renders a plain, lazy, decoding-async <img> with explicit dimensions so
 * layout is reserved and no CLS is introduced, without pulling in a framework.
 */
export interface ImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  sizes?: string;
  loading?: 'lazy' | 'eager';
  priority?: boolean;
  quality?: number;
  style?: React.CSSProperties;
}

export function Image({
  src,
  alt,
  width,
  height,
  fill,
  className,
  sizes,
  loading,
  priority,
  quality: _quality,
  style,
}: ImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      width={fill ? undefined : (width ?? 1400)}
      height={fill ? undefined : (height ?? 900)}
      sizes={sizes}
      loading={priority ? 'eager' : (loading ?? 'lazy')}
      decoding="async"
      className={className}
      style={
        fill
          ? { position: 'absolute', inset: 0, width: '100%', height: '100%', ...style }
          : style
      }
    />
  );
}

export default Image;
