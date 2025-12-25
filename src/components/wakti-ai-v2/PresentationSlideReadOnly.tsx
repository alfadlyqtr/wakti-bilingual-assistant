import React from 'react';

import type { ShareLanguage, ShareSlideDataV2 } from '@/utils/presentationShare';
import { getColorStyle } from '@/components/ui/ColorPickerWithGradient';

type ImageTransform = {
  scale: number;
  xPct: number;
  yPct: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

const CROP_OVERSCAN_SCALE = 1.08;

const clampTransformForCrop = (t: ImageTransform): ImageTransform => {
  const scale = clamp(t.scale ?? 1, 1, 3);
  return {
    scale,
    xPct: clamp(t.xPct ?? 0, -50, 50),
    yPct: clamp(t.yPct ?? 0, -50, 50),
  };
};

const getDefaultImageTransform = (): ImageTransform => ({ scale: 1, xPct: 0, yPct: 0 });

type FontSize = 'small' | 'medium' | 'large';

function getFontSizeClass(size?: FontSize, variant?: 'title'): string {
  if (variant === 'title') {
    if (size === 'small') return 'text-2xl md:text-3xl';
    if (size === 'large') return 'text-4xl md:text-5xl';
    return 'text-3xl md:text-4xl';
  }

  if (size === 'small') return 'text-sm md:text-base';
  if (size === 'large') return 'text-lg md:text-xl';
  return 'text-base md:text-lg';
}

function getThemeAccentHex(theme: string): string {
  if (theme === 'pitch_deck') return 'hsl(142 76% 55%)';
  if (theme === 'creative') return 'hsl(25 95% 60%)';
  if (theme === 'professional') return 'hsl(210 100% 65%)';
  if (theme === 'academic') return 'hsl(280 70% 65%)';
  return 'hsl(210 100% 65%)';
}

function buildCropImageStyle(slide: ShareSlideDataV2): React.CSSProperties {
  const raw = (slide.imageTransform || getDefaultImageTransform()) as ImageTransform;
  const t = clampTransformForCrop(raw);
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
}

function renderSlideImage(slide: ShareSlideDataV2): React.ReactNode {
  if (!slide.imageUrl) return null;
  const fit = slide.imageFit || 'crop';

  if (fit === 'crop') {
    return (
      <div className="w-full h-full relative overflow-hidden rounded-2xl border border-white/10 bg-black/20">
        <img src={slide.imageUrl} alt={slide.title} className="w-full h-full" style={buildCropImageStyle(slide)} />
      </div>
    );
  }

  const cls = fit === 'fit' ? 'object-contain' : fit === 'fill' ? 'object-fill' : 'object-cover';
  return (
    <div className="w-full h-full relative overflow-hidden rounded-2xl border border-white/10 bg-black/20">
      <img src={slide.imageUrl} alt={slide.title} className={`w-full h-full ${cls}`} />
    </div>
  );
}

export default function PresentationSlideReadOnly(props: {
  slide: ShareSlideDataV2;
  theme: string;
  language: ShareLanguage;
  slideIndex: number;
  totalSlides: number;
}): React.ReactElement {
  const { slide, theme, language, slideIndex, totalSlides } = props;
  const accentHex = slide.accentColor || getThemeAccentHex(theme);

  const bgStyle = slide.slideBg ? getColorStyle(slide.slideBg, 'background') : undefined;

  const bgGradientClass =
    theme === 'academic'
      ? 'from-slate-900 via-slate-800 to-slate-900'
      : theme === 'pitch_deck'
        ? 'from-slate-900 via-emerald-900/20 to-slate-900'
        : theme === 'creative'
          ? 'from-orange-600 via-pink-600 to-purple-700'
          : theme === 'professional'
            ? 'from-slate-800 via-indigo-900 to-slate-900'
            : 'from-slate-800 to-slate-900';

  return (
    <div className="aspect-video rounded-2xl overflow-hidden relative" style={bgStyle}>
      {!slide.slideBg && <div className={`absolute inset-0 bg-gradient-to-br ${bgGradientClass}`} />}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/10 via-transparent to-black/25" />

      <div className="relative h-full p-4 sm:p-6 md:p-8 lg:p-10 flex flex-col">
        {slide.role === 'thank_you' ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <h1
              className={`${getFontSizeClass(slide.titleStyle?.fontSize, 'title')} ${slide.titleStyle?.fontWeight === 'normal' ? 'font-normal' : 'font-bold'} leading-tight`}
              style={{ color: slide.titleStyle?.color || '#ffffff' }}
            >
              {slide.title || (language === 'ar' ? 'شكراً لكم' : 'Thank You')}
            </h1>
            {slide.subtitle && (
              <p className={`${getFontSizeClass(slide.subtitleStyle?.fontSize)} mt-3`} style={{ color: slide.subtitleStyle?.color || '#e2e8f0' }}>
                {slide.subtitle}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="mb-4 text-center">
              <h2
                className={`${getFontSizeClass(slide.titleStyle?.fontSize, 'title')} ${slide.titleStyle?.fontWeight === 'normal' ? 'font-normal' : 'font-bold'} ${slide.titleStyle?.fontStyle === 'italic' ? 'italic' : ''} ${slide.titleStyle?.textDecoration === 'underline' ? 'underline' : ''}`}
                style={{ color: slide.titleStyle?.color || '#ffffff' }}
              >
                {(slide.title || '').split(' ').map((word, i) =>
                  i === 1 ? (
                    <span
                      key={i}
                      className={`${slide.accentFontSize === 'small' ? 'text-[0.85em]' : slide.accentFontSize === 'large' ? 'text-[1.15em]' : ''} ${slide.accentFontWeight === 'normal' ? 'font-normal' : 'font-bold'} ${slide.accentFontStyle === 'italic' ? 'italic' : ''}`}
                      style={{ color: slide.accentColor || accentHex }}
                    >
                      {word}{' '}
                    </span>
                  ) : (
                    `${word} `
                  )
                )}
              </h2>
              {slide.subtitle && (
                <p className={`${getFontSizeClass(slide.subtitleStyle?.fontSize)} mt-2`} style={{ color: slide.subtitleStyle?.color || '#94a3b8' }}>
                  {slide.subtitle}
                </p>
              )}
            </div>

            {slide.imageUrl ? (
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 items-center">
                <div className="flex flex-col pr-2">
                  <ul className="space-y-1">
                    {(slide.bullets || []).slice(0, 6).map((b, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-2 w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: slide.bulletDotColor || accentHex }} />
                        <span
                          className={`${getFontSizeClass(slide.bulletStyle?.fontSize)} leading-tight ${slide.bulletStyle?.fontWeight === 'bold' ? 'font-bold' : ''} ${slide.bulletStyle?.fontStyle === 'italic' ? 'italic' : ''}`}
                          style={{ color: slide.bulletStyle?.color || '#e2e8f0' }}
                        >
                          {b}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={`${slide.imageSize === 'small' ? 'max-w-[70%]' : slide.imageSize === 'large' ? 'max-w-full' : slide.imageSize === 'full' ? 'max-w-full' : 'max-w-[85%]'} mx-auto aspect-[16/9] w-full`}
                >
                  {renderSlideImage(slide)}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center">
                <ul className="space-y-2 max-w-3xl mx-auto">
                  {(slide.bullets || []).slice(0, 7).map((b, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-2 w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: slide.bulletDotColor || accentHex }} />
                      <span
                        className={`${getFontSizeClass(slide.bulletStyle?.fontSize)} leading-snug ${slide.bulletStyle?.fontWeight === 'bold' ? 'font-bold' : ''}`}
                        style={{ color: slide.bulletStyle?.color || '#e2e8f0' }}
                      >
                        {b}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <div className="absolute bottom-3 left-4 flex items-center gap-2 text-xs opacity-80">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentHex }} />
          <span>{slide.footer || 'Wakti AI'}</span>
        </div>
        <div className="absolute bottom-3 right-4 text-xs opacity-50 font-mono">
          {String(slideIndex + 1).padStart(2, '0')}
        </div>
        <div className="absolute top-3 left-3 rounded-full bg-black/70 px-2.5 py-1 text-xs border border-white/20">
          {slideIndex + 1}/{totalSlides}
        </div>
      </div>
    </div>
  );
}
