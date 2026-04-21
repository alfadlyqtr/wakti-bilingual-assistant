import React from 'react';

import { buildCropImageStyle, getImageFitClass } from './imageHelpers';
import { getThemeAccent } from './themeHelpers';
import type { Slide } from './types';

// Helper to render text with **bold** markdown - Theme-aware badges for stats
export const renderBoldText = (text: string, themeKey: string = 'starter'): React.ReactNode => {
  if (!text) return null;
  const accent = getThemeAccent(themeKey);
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const content = part.slice(2, -2);
      // Check if it's a stat (number, percentage, currency)
      const isStat = /^[\d$€£¥%.,]+[%KMB]?$/.test(content.trim()) || /^\$?\d/.test(content.trim());
      if (isStat) {
        return <span key={i} className={`inline-block px-2 py-0.5 ${accent.bg} text-white text-sm font-bold rounded`}>{content}</span>;
      }
      return <strong key={i} className={`font-bold ${accent.text}`}>{content}</strong>;
    }
    return part;
  });
};

// Helper to get font size class from style - LARGER sizes for better readability
export const getFontSizeClass = (size?: 'small' | 'medium' | 'large', type: 'title' | 'bullet' = 'bullet') => {
  if (type === 'title') {
    switch (size) {
      case 'small': return 'text-lg sm:text-xl md:text-2xl lg:text-3xl';
      case 'large': return 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl';
      default: return 'text-xl sm:text-2xl md:text-3xl lg:text-4xl';
    }
  }
  switch (size) {
    case 'small': return 'text-xs sm:text-sm md:text-base';
    case 'large': return 'text-base sm:text-lg md:text-xl';
    default: return 'text-sm sm:text-base md:text-lg';
  }
};

export const renderSlideImage = (
  slide: Slide,
  args?: {
    className?: string;
    enableDrag?: boolean;
    onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
    onPointerMove?: React.PointerEventHandler<HTMLDivElement>;
    onPointerUp?: React.PointerEventHandler<HTMLDivElement>;
    onPointerCancel?: React.PointerEventHandler<HTMLDivElement>;
  }
): React.ReactNode => {
  if (!slide.imageUrl) return null;

  const fit = slide.imageFit || 'crop';
  const className = args?.className || 'w-full h-full';

  const frameClassName = `${className} relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-background to-muted/20 shadow-soft`;
  const fitFrameClassName = `${className} relative overflow-hidden rounded-2xl border border-border/60 bg-transparent shadow-soft`;

  // For crop mode, we render as a transformable layer inside an overflow-hidden frame.
  if (fit === 'crop') {
    return (
      <div
        className={`${frameClassName} ${args?.enableDrag ? 'touch-none select-none' : ''}`}
        onPointerDown={args?.onPointerDown}
        onPointerMove={args?.onPointerMove}
        onPointerUp={args?.onPointerUp}
        onPointerCancel={args?.onPointerCancel || args?.onPointerUp}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/25" />
        <div className="pointer-events-none absolute inset-0 ring-1 ring-white/10" />
        <img
          src={slide.imageUrl}
          alt={slide.title}
          draggable={false}
          className="w-full h-full"
          style={buildCropImageStyle(slide)}
        />
      </div>
    );
  }

  // Fit / Fill fallback (no transform)
  return (
    <div className={fit === 'fit' ? fitFrameClassName : frameClassName}>
      {fit !== 'fit' && (
        <>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/25" />
          <div className="pointer-events-none absolute inset-0 ring-1 ring-white/10" />
        </>
      )}
      <img src={slide.imageUrl} alt={slide.title} className={`w-full h-full ${getImageFitClass(slide.imageFit)}`} />
    </div>
  );
};

// Helper to render bullet shape
export const renderBulletShape = (
  shape: 'dot' | 'diamond' | 'arrow' | 'dash' | 'number' | 'letter' | undefined,
  index: number,
  size: 'small' | 'medium' | 'large' | undefined,
  color: string
): React.ReactNode => {
  const sizeClass = size === 'medium' ? 'text-sm' : size === 'large' ? 'text-base' : 'text-xs';
  const dotSizeClass = size === 'medium' ? 'w-1.5 h-1.5' : size === 'large' ? 'w-2 h-2' : 'w-1 h-1';
  
  switch (shape) {
    case 'diamond':
      return <span className={`${sizeClass} flex-shrink-0 mt-0.5`} style={{ color }}>◆</span>;
    case 'arrow':
      return <span className={`${sizeClass} flex-shrink-0 mt-0.5`} style={{ color }}>➤</span>;
    case 'dash':
      return <span className={`${sizeClass} flex-shrink-0 mt-0.5`} style={{ color }}>—</span>;
    case 'number':
      return <span className={`${sizeClass} flex-shrink-0 mt-0.5 font-medium`} style={{ color }}>{index + 1}.</span>;
    case 'letter':
      return <span className={`${sizeClass} flex-shrink-0 mt-0.5 font-medium`} style={{ color }}>{String.fromCharCode(97 + index)}.</span>;
    default:
      return <span className={`${dotSizeClass} rounded-full mt-1.5 flex-shrink-0`} style={{ backgroundColor: color }} />;
  }
};

// Helper to get slide background class from slideBg key
export const getSlideBgClass = (bgKey?: string) => {
  const bgMap: Record<string, string> = {
    'black': 'from-black to-gray-900',
    'dark': 'from-slate-900 to-slate-800',
    'slate': 'from-slate-800 to-slate-700',
    'gray': 'from-gray-700 to-gray-600',
    'navy': 'from-[#060541] to-[#0a0a6b]',
    'blue-dark': 'from-blue-900 to-blue-800',
    'blue': 'from-blue-700 to-blue-600',
    'blue-light': 'from-blue-500 to-blue-400',
    'indigo': 'from-indigo-900 to-indigo-800',
    'purple-dark': 'from-purple-900 to-purple-800',
    'purple': 'from-purple-700 to-purple-600',
    'violet': 'from-violet-600 to-violet-500',
    'pink-dark': 'from-pink-900 to-pink-800',
    'pink': 'from-pink-600 to-pink-500',
    'rose': 'from-rose-600 to-rose-500',
    'red': 'from-red-700 to-red-600',
    'orange': 'from-orange-700 to-orange-600',
    'amber': 'from-amber-600 to-amber-500',
    'yellow': 'from-yellow-600 to-yellow-500',
    'green-dark': 'from-emerald-900 to-emerald-800',
    'green': 'from-emerald-700 to-emerald-600',
    'green-light': 'from-emerald-500 to-emerald-400',
    'teal': 'from-teal-700 to-teal-600',
    'cyan': 'from-cyan-700 to-cyan-600',
    'grad-navy': 'from-[#060541] to-blue-900',
    'grad-purple': 'from-purple-900 to-pink-900',
    'grad-night': 'from-slate-900 to-purple-900',
    'grad-ocean': 'from-blue-700 to-cyan-600',
    'grad-sunset': 'from-orange-600 to-rose-600',
    'grad-fire': 'from-red-600 to-orange-500',
    'grad-pink': 'from-pink-500 via-rose-500 to-orange-400',
    'grad-candy': 'from-pink-500 to-purple-600',
    'grad-green': 'from-emerald-900 to-teal-700',
    'grad-mint': 'from-teal-500 to-emerald-500',
    'grad-aurora': 'from-green-400 via-cyan-500 to-blue-500',
    'grad-royal': 'from-indigo-600 to-purple-700',
  };
  return bgMap[bgKey || 'dark'] || 'from-slate-900 to-slate-800';
};
