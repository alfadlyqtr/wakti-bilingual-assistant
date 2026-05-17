import type { VisualAdsState } from '@/components/studio/VisualAdsGenerator';

type VisualAdsTextPresence = VisualAdsState['creativeSoul']['textPresence'];
type VisualAdsTextColorStyle = VisualAdsState['creativeSoul']['textColorStyle'];
type VisualAdsAspectRatio = VisualAdsState['campaignDNA']['platform'];

export type VisualAdsPosterTextSpec = {
  aspectRatio: VisualAdsAspectRatio | null;
  ctaText: string | null;
  featureChips: string[];
  textPresence: VisualAdsTextPresence;
  textColorStyle: VisualAdsTextColorStyle;
  language: 'en' | 'ar';
};

type PresenceProfile = {
  chipFontRatio: number;
  chipPaddingXRatio: number;
  chipPaddingYRatio: number;
  chipGapRatio: number;
  ctaFontRatio: number;
  ctaPaddingXRatio: number;
  ctaPaddingYRatio: number;
  sectionGapRatio: number;
  bottomMarginRatio: number;
  ctaMaxWidthRatio: number;
  scrimAlpha: number;
  shadowBlurRatio: number;
};

type OverlayPalette = {
  ctaFill: string;
  ctaText: string;
  ctaStroke: string;
  chipFill: string;
  chipText: string;
  chipStroke: string;
  glow: string;
  scrim: [string, string, string];
};

type RowLayout = {
  width: number;
  items: Array<{
    text: string;
    width: number;
  }>;
};

const FONT_STACK = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const PRESENCE_PROFILES: Record<VisualAdsTextPresence, PresenceProfile> = {
  quiet: {
    chipFontRatio: 0.025,
    chipPaddingXRatio: 0.020,
    chipPaddingYRatio: 0.011,
    chipGapRatio: 0.010,
    ctaFontRatio: 0.038,
    ctaPaddingXRatio: 0.040,
    ctaPaddingYRatio: 0.016,
    sectionGapRatio: 0.017,
    bottomMarginRatio: 0.065,
    ctaMaxWidthRatio: 0.46,
    scrimAlpha: 0.16,
    shadowBlurRatio: 0.020,
  },
  balanced: {
    chipFontRatio: 0.028,
    chipPaddingXRatio: 0.022,
    chipPaddingYRatio: 0.012,
    chipGapRatio: 0.012,
    ctaFontRatio: 0.045,
    ctaPaddingXRatio: 0.048,
    ctaPaddingYRatio: 0.019,
    sectionGapRatio: 0.020,
    bottomMarginRatio: 0.070,
    ctaMaxWidthRatio: 0.54,
    scrimAlpha: 0.20,
    shadowBlurRatio: 0.028,
  },
  'strong-cta': {
    chipFontRatio: 0.029,
    chipPaddingXRatio: 0.023,
    chipPaddingYRatio: 0.012,
    chipGapRatio: 0.013,
    ctaFontRatio: 0.053,
    ctaPaddingXRatio: 0.058,
    ctaPaddingYRatio: 0.023,
    sectionGapRatio: 0.022,
    bottomMarginRatio: 0.074,
    ctaMaxWidthRatio: 0.64,
    scrimAlpha: 0.24,
    shadowBlurRatio: 0.036,
  },
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const roundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
};

const hexToRgb = (hex: string) => {
  const normalized = hex.replace('#', '').trim();
  const safe = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized.padEnd(6, '0').slice(0, 6);
  const value = parseInt(safe, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const withAlpha = (hex: string, alpha: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getContrastText = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 160 ? '#0c0f14' : '#fcfefd';
};

const loadImageElement = async (url: string): Promise<HTMLImageElement> => {
  let fetchedObjectUrl: string | null = null;
  try {
    const response = await fetch(url);
    if (response.ok) {
      const blob = await response.blob();
      fetchedObjectUrl = URL.createObjectURL(blob);
    }
  } catch {
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (fetchedObjectUrl) URL.revokeObjectURL(fetchedObjectUrl);
      resolve(img);
    };
    img.onerror = () => {
      if (fetchedObjectUrl) {
        const directImg = new Image();
        directImg.decoding = 'async';
        directImg.crossOrigin = 'anonymous';
        directImg.onload = () => resolve(directImg);
        directImg.onerror = () => reject(new Error('Failed to load poster image'));
        directImg.src = url;
        URL.revokeObjectURL(fetchedObjectUrl);
        return;
      }
      reject(new Error('Failed to load poster image'));
    };
    img.src = fetchedObjectUrl || url;
  });
};

const canvasToBlob = (canvas: HTMLCanvasElement, type = 'image/png', quality?: number) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error('Failed to export poster image'));
  }, type, quality);
});

const sampleSceneBrightness = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const sampleX = Math.max(0, Math.round(width * 0.15));
  const sampleY = Math.max(0, Math.round(height * 0.58));
  const sampleWidth = Math.max(1, Math.round(width * 0.7));
  const sampleHeight = Math.max(1, Math.round(height * 0.28));
  const data = ctx.getImageData(sampleX, sampleY, sampleWidth, sampleHeight).data;
  const stride = Math.max(4, Math.floor(data.length / 32000));
  let total = 0;
  let count = 0;
  for (let index = 0; index < data.length; index += stride * 4) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3] / 255;
    if (a <= 0) continue;
    total += (((r * 299) + (g * 587) + (b * 114)) / 1000) * a;
    count += 1;
  }
  return count ? total / count : 128;
};

const resolvePalette = (textColorStyle: VisualAdsTextColorStyle, sceneIsLight: boolean): OverlayPalette => {
  if (textColorStyle === 'minimal-monochrome') {
    const ctaFill = sceneIsLight ? '#0c0f14' : '#fcfefd';
    return {
      ctaFill,
      ctaText: sceneIsLight ? '#fcfefd' : '#0c0f14',
      ctaStroke: sceneIsLight ? withAlpha('#fcfefd', 0.08) : withAlpha('#0c0f14', 0.12),
      chipFill: sceneIsLight ? withAlpha('#fcfefd', 0.78) : withAlpha('#0c0f14', 0.68),
      chipText: sceneIsLight ? '#16181d' : '#f5f5f5',
      chipStroke: sceneIsLight ? withAlpha('#0c0f14', 0.12) : withAlpha('#fcfefd', 0.16),
      glow: sceneIsLight ? withAlpha('#0c0f14', 0.10) : withAlpha('#fcfefd', 0.14),
      scrim: sceneIsLight
        ? ['rgba(252, 254, 253, 0)', 'rgba(252, 254, 253, 0.05)', 'rgba(252, 254, 253, 0.22)']
        : ['rgba(12, 15, 20, 0)', 'rgba(12, 15, 20, 0.08)', 'rgba(12, 15, 20, 0.30)'],
    };
  }

  if (textColorStyle === 'brand-accent') {
    const accent = sceneIsLight ? '#b76f1f' : '#d88a2c';
    return {
      ctaFill: accent,
      ctaText: getContrastText(accent),
      ctaStroke: withAlpha('#fcfefd', sceneIsLight ? 0.12 : 0.18),
      chipFill: sceneIsLight ? withAlpha('#fcfefd', 0.84) : withAlpha('#1b1d22', 0.72),
      chipText: sceneIsLight ? '#2b2113' : '#f6ead9',
      chipStroke: withAlpha(accent, sceneIsLight ? 0.30 : 0.42),
      glow: withAlpha(accent, sceneIsLight ? 0.18 : 0.28),
      scrim: sceneIsLight
        ? ['rgba(255, 250, 245, 0)', 'rgba(255, 250, 245, 0.08)', 'rgba(255, 250, 245, 0.24)']
        : ['rgba(19, 13, 7, 0)', 'rgba(19, 13, 7, 0.12)', 'rgba(19, 13, 7, 0.34)'],
    };
  }

  const ctaFill = sceneIsLight ? '#181d24' : '#f3f5f7';
  return {
    ctaFill,
    ctaText: sceneIsLight ? '#fcfefd' : '#0c0f14',
    ctaStroke: sceneIsLight ? withAlpha('#fcfefd', 0.08) : withAlpha('#0c0f14', 0.10),
    chipFill: sceneIsLight ? withAlpha('#fcfefd', 0.80) : withAlpha('#0c0f14', 0.68),
    chipText: sceneIsLight ? '#11141a' : '#f2f2f2',
    chipStroke: sceneIsLight ? withAlpha('#0c0f14', 0.10) : withAlpha('#fcfefd', 0.14),
    glow: sceneIsLight ? withAlpha('#0c0f14', 0.12) : withAlpha('#ffffff', 0.16),
    scrim: sceneIsLight
      ? ['rgba(252, 254, 253, 0)', 'rgba(252, 254, 253, 0.06)', 'rgba(252, 254, 253, 0.20)']
      : ['rgba(12, 15, 20, 0)', 'rgba(12, 15, 20, 0.10)', 'rgba(12, 15, 20, 0.28)'],
  };
};

const buildChipRows = (
  ctx: CanvasRenderingContext2D,
  texts: string[],
  maxWidth: number,
  fontSize: number,
  paddingX: number,
  gap: number,
) => {
  ctx.font = `600 ${fontSize}px ${FONT_STACK}`;
  return texts.reduce<RowLayout[]>((rows, text) => {
    const width = Math.ceil(ctx.measureText(text).width + paddingX * 2);
    const lastRow = rows[rows.length - 1];
    if (!lastRow || lastRow.width + gap + width > maxWidth) {
      rows.push({ width, items: [{ text, width }] });
    } else {
      lastRow.items.push({ text, width });
      lastRow.width += gap + width;
    }
    return rows;
  }, []);
};

export async function composeVisualAdsPoster(baseImageUrl: string, spec: VisualAdsPosterTextSpec): Promise<Blob> {
  const featureChips = spec.featureChips.map((chip) => chip.trim()).filter(Boolean).slice(0, 4);
  const ctaText = (spec.ctaText || '').trim();

  const image = await loadImageElement(baseImageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to prepare poster canvas');

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  if (!featureChips.length && !ctaText) {
    return canvasToBlob(canvas, 'image/png');
  }

  const baseSize = Math.min(canvas.width, canvas.height);
  const presence = PRESENCE_PROFILES[spec.textPresence] || PRESENCE_PROFILES.balanced;
  const chipFontSize = clamp(baseSize * presence.chipFontRatio, 16, 34);
  const chipPaddingX = clamp(baseSize * presence.chipPaddingXRatio, 14, 28);
  const chipPaddingY = clamp(baseSize * presence.chipPaddingYRatio, 8, 18);
  const chipGap = clamp(baseSize * presence.chipGapRatio, 10, 20);
  const chipHeight = Math.round(chipFontSize + chipPaddingY * 2);
  const ctaFontSize = clamp(baseSize * presence.ctaFontRatio, 24, 56);
  const ctaPaddingX = clamp(baseSize * presence.ctaPaddingXRatio, 24, 56);
  const ctaPaddingY = clamp(baseSize * presence.ctaPaddingYRatio, 14, 26);
  const ctaHeight = Math.round(ctaFontSize + ctaPaddingY * 2);
  const sectionGap = clamp(baseSize * presence.sectionGapRatio, 12, 28);
  const bottomMargin = clamp(baseSize * presence.bottomMarginRatio, 26, canvas.height * 0.12);
  const chipRows = buildChipRows(ctx, featureChips, canvas.width * 0.82, chipFontSize, chipPaddingX, chipGap);
  const chipsBlockHeight = chipRows.length
    ? chipRows.length * chipHeight + (chipRows.length - 1) * chipGap
    : 0;

  ctx.font = `700 ${ctaFontSize}px ${FONT_STACK}`;
  const ctaWidth = ctaText
    ? Math.min(canvas.width * presence.ctaMaxWidthRatio, Math.ceil(ctx.measureText(ctaText).width + ctaPaddingX * 2))
    : 0;

  const totalHeight = chipsBlockHeight + (chipsBlockHeight && ctaText ? sectionGap : 0) + (ctaText ? ctaHeight : 0);
  const groupTop = canvas.height - bottomMargin - totalHeight;
  const sceneBrightness = sampleSceneBrightness(ctx, canvas.width, canvas.height);
  const sceneIsLight = sceneBrightness > 162;
  const palette = resolvePalette(spec.textColorStyle, sceneIsLight);

  const scrim = ctx.createLinearGradient(0, Math.max(0, groupTop - bottomMargin), 0, canvas.height);
  scrim.addColorStop(0, palette.scrim[0]);
  scrim.addColorStop(0.55, palette.scrim[1]);
  scrim.addColorStop(1, palette.scrim[2]);
  ctx.fillStyle = scrim;
  ctx.fillRect(0, Math.max(0, groupTop - bottomMargin), canvas.width, canvas.height - Math.max(0, groupTop - bottomMargin));

  if (chipsBlockHeight) {
    let currentY = groupTop;
    ctx.font = `600 ${chipFontSize}px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const row of chipRows) {
      let currentX = (canvas.width - row.width) / 2;
      for (const item of row.items) {
        ctx.save();
        ctx.shadowColor = palette.glow;
        ctx.shadowBlur = baseSize * presence.shadowBlurRatio * 0.7;
        roundedRect(ctx, currentX, currentY, item.width, chipHeight, chipHeight / 2);
        ctx.fillStyle = palette.chipFill;
        ctx.fill();
        ctx.lineWidth = 1.25;
        ctx.strokeStyle = palette.chipStroke;
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = palette.chipText;
        ctx.fillText(item.text, currentX + item.width / 2, currentY + chipHeight / 2 + 1);
        currentX += item.width + chipGap;
      }
      currentY += chipHeight + chipGap;
    }
  }

  if (ctaText) {
    const ctaX = (canvas.width - ctaWidth) / 2;
    const ctaY = canvas.height - bottomMargin - ctaHeight;
    const ctaRadius = ctaHeight / 2;

    ctx.save();
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = baseSize * presence.shadowBlurRatio;
    roundedRect(ctx, ctaX, ctaY, ctaWidth, ctaHeight, ctaRadius);
    ctx.fillStyle = palette.ctaFill;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = palette.ctaStroke;
    ctx.stroke();
    ctx.restore();

    ctx.font = `700 ${ctaFontSize}px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = palette.ctaText;
    ctx.fillText(ctaText, ctaX + ctaWidth / 2, ctaY + ctaHeight / 2 + 1);
  }

  return canvasToBlob(canvas, 'image/png');
}
