import React, { useMemo } from 'react';
import { compositeToSvg } from '@/editor/lib/composite';
import type { Layer } from '@/lib/storage';

export interface ThumbnailProps {
  layers: Layer[];
  /** Logical canvas dimensions; passed through to the compositor. */
  canvasWidth: number;
  canvasHeight: number;
  /** When false, every layer is treated as fully visible and opaque
   *  regardless of its stored `visible` / `opacity`. Used by per-layer
   *  thumbnails that should preview hidden layers too. Default true. */
  respectVisibility?: boolean;
  /** Rendered img size in CSS pixels. Omit to let CSS / className size it. */
  width?: number;
  height?: number;
  className?: string;
  /** Merged on top of the built-in `image-rendering: pixelated`, so callers
   *  can override it if they really want smooth scaling. */
  style?: React.CSSProperties;
  alt?: string;
}

/** Canvas thumbnail: composites a layer stack to an inline SVG data URL and
 *  renders it pixelated. Memoises the SVG build so parent re-renders (zoom
 *  ticks, hover state, etc) don't rebuild the rect-per-cell string. */
const Thumbnail: React.FC<ThumbnailProps> = ({
  layers,
  canvasWidth,
  canvasHeight,
  respectVisibility = true,
  width,
  height,
  className,
  style,
  alt = '',
}) => {
  const src = useMemo(() => {
    const effective = respectVisibility
      ? layers
      : layers.map((l) => ({ ...l, visible: true, opacity: 1 }));
    return `data:image/svg+xml,${encodeURIComponent(
      compositeToSvg(effective, canvasWidth, canvasHeight),
    )}`;
  }, [layers, canvasWidth, canvasHeight, respectVisibility]);

  return (
    <img
      src={src}
      width={width}
      height={height}
      className={className}
      style={{ imageRendering: 'pixelated', ...style }}
      alt={alt}
      aria-hidden={alt === '' ? true : undefined}
    />
  );
};

export default Thumbnail;
