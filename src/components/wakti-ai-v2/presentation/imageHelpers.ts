import type { ImageFit, ImageFocusX, ImageFocusY, ImageTransform, Slide } from './types';
import type { CSSProperties } from 'react';

export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export const CROP_OVERSCAN_SCALE = 1.15;

export const clampTransformForCrop = (t: ImageTransform): ImageTransform => {
  // In crop mode we pan using object-position (not translating the image element).
  // That means we can safely clamp the offsets to [-50, 50] (maps to object-position 0..100).
  const scale = clamp(t.scale ?? 1, 1, 3);
  return {
    scale,
    xPct: clamp(t.xPct ?? 0, -50, 50),
    yPct: clamp(t.yPct ?? 0, -50, 50),
  };
};

export const getDefaultImageTransform = (): ImageTransform => ({ scale: 1, xPct: 0, yPct: 0 });

export const focusToXY = (fx?: ImageFocusX, fy?: ImageFocusY): { xPct: number; yPct: number } => {
  const xPct = fx === 'left' ? -25 : fx === 'right' ? 25 : 0;
  const yPct = fy === 'top' ? -25 : fy === 'bottom' ? 25 : 0;
  return { xPct, yPct };
};

export const focusToXYForCrop = (fx?: ImageFocusX, fy?: ImageFocusY): { xPct: number; yPct: number } => {
  // Crop panning uses object-position.
  // We store xPct/yPct as offsets from center in percentage points.
  // object-position uses 0%..100% where 50% is centered.
  // So left/top are -50, right/bottom are +50.
  // We define xPct/yPct in "move the image" space (positive = image moves right/down).
  // That means the object-position is inverted when applied.
  const xPct = fx === 'left' ? 50 : fx === 'right' ? -50 : 0;
  const yPct = fy === 'top' ? 50 : fy === 'bottom' ? -50 : 0;
  return { xPct, yPct };
};

export const getEffectiveTransform = (slide: Slide): ImageTransform => {
  return slide.imageTransform || getDefaultImageTransform();
};

export const buildCropImageStyle = (slide: Slide): CSSProperties => {
  const t = clampTransformForCrop(getEffectiveTransform(slide));
  // Invert mapping so +xPct moves the image right (object-position shifts left).
  const objX = clamp(50 - (t.xPct ?? 0), 0, 100);
  const objY = clamp(50 - (t.yPct ?? 0), 0, 100);
  const effectiveScale = (t.scale ?? 1) * CROP_OVERSCAN_SCALE;
  return {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: `${objX}% ${objY}%`,
    transform: `scale(${effectiveScale})`,
    transformOrigin: 'center center',
  };
};

// Helper to get image fit class
export const getImageFitClass = (fit?: ImageFit) => {
  switch (fit) {
    case 'fit': return 'object-contain';
    case 'fill': return 'object-fill';
    default: return 'object-cover';
  }
};
