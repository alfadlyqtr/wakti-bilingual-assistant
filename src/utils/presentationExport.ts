/**
 * Presentation Export Utilities
 * Exports slides as PDF (card-style) or PPTX (PowerPoint)
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import * as htmlToImage from 'html-to-image';

// Text style interface
interface TextStyle {
  fontSize?: 'small' | 'medium' | 'large';
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  color?: string;
}

// Layout types
type LayoutVariant = 'text_left' | 'image_left' | 'image_top' | 'image_bottom' | 'text_only';
type ImageSize = 'small' | 'medium' | 'large' | 'full';
type ImageFit = 'crop' | 'fit' | 'fill';

type ImageFocusX = 'left' | 'center' | 'right';
type ImageFocusY = 'top' | 'center' | 'bottom';

interface ImageTransform {
  scale: number;
  xPct: number;
  yPct: number;
}

// Bullet dot shape type
type BulletDotShape = 'dot' | 'diamond' | 'arrow' | 'dash' | 'number' | 'letter';

// Slide interface (matches PresentationTab)
interface ExportSlide {
  id: string;
  slideNumber: number;
  role: string;
  layoutType: string;
  theme: string;
  title: string;
  subtitle?: string;
  bullets: string[];
  highlightedStats?: string[];
  columns?: { title: string; description: string; icon?: string }[];
  imageUrl?: string;
  slideBg?: string; // Custom background color (hex or gradient string)
  // Custom styling
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
  bulletStyle?: TextStyle;
  // Accent/keyword styling
  accentColor?: string;
  accentFontWeight?: 'normal' | 'bold';
  accentFontStyle?: 'normal' | 'italic';
  accentFontSize?: 'small' | 'medium' | 'large';
  // Bullet dot styling
  bulletDotColor?: string;
  bulletDotSize?: 'small' | 'medium' | 'large';
  bulletDotShape?: BulletDotShape;
  // Layout options
  layoutVariant?: LayoutVariant;
  imageSize?: ImageSize;
  imageFit?: ImageFit;
  imageTransform?: ImageTransform;
  imageFocusX?: ImageFocusX;
  imageFocusY?: ImageFocusY;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const EXPORT_CANVAS_W = 1920;

function get16by9Height(widthPx: number): number {
  return Math.round((widthPx * 9) / 16);
}

function getSideImageWidthPctForCover(imageSize?: ImageSize): number {
  if (imageSize === 'small') return 1 / 3;
  if (imageSize === 'large') return 2 / 3;
  return 1 / 2;
}

function getSideImageWidthPctForContent(imageSize?: ImageSize): number {
  switch (imageSize) {
    case 'small':
      return 0.35;
    case 'large':
      return 0.55;
    case 'full':
      return 0.6;
    default:
      return 0.45;
  }
}

function getTopBottomWidthPct(imageSize?: ImageSize): number {
  if (imageSize === 'small') return 0.7;
  if (imageSize === 'large' || imageSize === 'full') return 1;
  return 0.85;
}

function focusToXY(fx?: ImageFocusX, fy?: ImageFocusY): { xPct: number; yPct: number } {
  const xPct = fx === 'left' ? -25 : fx === 'right' ? 25 : 0;
  const yPct = fy === 'top' ? -25 : fy === 'bottom' ? 25 : 0;
  return { xPct, yPct };
}

function getExportImageStyle(slide: ExportSlide): { wrapperStyle: string; imgStyle: string } {
  const fit = slide.imageFit || 'crop';

  // For crop, we mimic the in-app behavior: overflow-hidden wrapper, and transformed img.
  if (fit === 'crop') {
    const t = slide.imageTransform || { scale: 1, xPct: 0, yPct: 0 };
    const scale = clamp(t.scale ?? 1, 1, 3);
    const effectiveScale = scale * 1.15;
    const xPct = clamp(t.xPct ?? 0, -50, 50);
    const yPct = clamp(t.yPct ?? 0, -50, 50);
    // Match PresentationTab crop behavior: xPct/yPct represent moving the image itself
    // (positive moves image right/down), so object-position is inverted.
    const objX = clamp(50 - xPct, 0, 100);
    const objY = clamp(50 - yPct, 0, 100);

    const wrapperStyle = 'position: relative; overflow: hidden; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.3);';
    const imgStyle = `width: 100%; height: 100%; object-fit: cover; object-position: ${objX}% ${objY}%; transform: scale(${effectiveScale}); transform-origin: center center;`;
    return { wrapperStyle, imgStyle };
  }

  // For fit/fill, use object-fit and object-position from focus (if any)
  const fitMode = fit === 'fit' ? 'contain' : 'fill';
  const focus = focusToXY(slide.imageFocusX, slide.imageFocusY);
  // Map focus percentages into object-position percentage space (50% is center)
  const objX = clamp(50 + focus.xPct, 0, 100);
  const objY = clamp(50 + focus.yPct, 0, 100);

  const wrapperStyle = 'position: relative; overflow: hidden; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.3);';
  const imgStyle = `width: 100%; height: 100%; object-fit: ${fitMode}; object-position: ${objX}% ${objY}%;`;
  return { wrapperStyle, imgStyle };
}

// Theme colors for PDF/PPTX - bg now uses gradients matching PresentationTab
const THEME_COLORS: Record<string, { bg: string; accent: string; text: string }> = {
  starter: { bg: 'linear-gradient(135deg, #1e293b, #0f172a)', accent: '#3b82f6', text: '#ffffff' },
  professional: { bg: 'linear-gradient(135deg, #1e293b, #312e81, #0f172a)', accent: '#6366f1', text: '#ffffff' },
  pitch_deck: { bg: 'linear-gradient(135deg, #0f172a, #064e3b, #0f172a)', accent: '#10b981', text: '#ffffff' },
  // creative: from-orange-600 (#ea580c) via-pink-600 (#db2777) to-purple-700 (#7e22ce)
  creative: { bg: 'linear-gradient(135deg, #ea580c, #db2777, #7e22ce)', accent: '#f97316', text: '#ffffff' },
  academic: { bg: 'linear-gradient(135deg, #0f172a, #1e293b, #0f172a)', accent: '#06b6d4', text: '#ffffff' },
};

// Slide background colors - maps slideBg key to CSS background value (solid or gradient)
const SLIDE_BG_COLORS: Record<string, string> = {
  // Solid colors
  'black': '#000000',
  'dark': '#0f172a',
  'slate': '#334155',
  'gray': '#4b5563',
  'navy': '#060541',
  'blue-dark': '#1e3a8a',
  'blue': '#1d4ed8',
  'blue-light': '#3b82f6',
  'indigo': '#312e81',
  'purple-dark': '#581c87',
  'purple': '#7c3aed',
  'violet': '#7c3aed',
  'pink-dark': '#831843',
  'pink': '#db2777',
  'rose': '#e11d48',
  'red': '#b91c1c',
  'orange': '#c2410c',
  'amber': '#d97706',
  'yellow': '#ca8a04',
  'green-dark': '#064e3b',
  'green': '#047857',
  'green-light': '#10b981',
  'teal': '#0f766e',
  'cyan': '#0e7490',
  // Gradients - Dark/Cool
  'grad-navy': 'linear-gradient(135deg, #060541, #1e3a8a)',
  'grad-purple': 'linear-gradient(135deg, #581c87, #831843)',
  'grad-night': 'linear-gradient(135deg, #0f172a, #581c87)',
  'grad-ocean': 'linear-gradient(135deg, #1d4ed8, #0891b2)',
  // Gradients - Warm/Vibrant
  'grad-sunset': 'linear-gradient(135deg, #ea580c, #e11d48)',
  'grad-fire': 'linear-gradient(135deg, #dc2626, #f97316)',
  'grad-pink': 'linear-gradient(135deg, #ec4899, #f43f5e, #fb923c)',
  'grad-candy': 'linear-gradient(135deg, #ec4899, #9333ea)',
  // Gradients - Nature
  'grad-green': 'linear-gradient(135deg, #064e3b, #0f766e)',
  'grad-mint': 'linear-gradient(135deg, #14b8a6, #10b981)',
  'grad-aurora': 'linear-gradient(135deg, #4ade80, #06b6d4, #3b82f6)',
  'grad-royal': 'linear-gradient(135deg, #4f46e5, #7c3aed)',
};

// Parse gradient string from ColorPickerWithGradient: "gradient:#color1,#color2,angle"
function parseGradientString(value: string): { color1: string; color2: string; angle: number } | null {
  if (!value.startsWith('gradient:')) return null;
  const parts = value.replace('gradient:', '').split(',');
  if (parts.length >= 2) {
    return {
      color1: parts[0] || '#000000',
      color2: parts[1] || '#ffffff',
      angle: parseInt(parts[2]) || 135,
    };
  }
  return null;
}

// Convert color value to CSS background string
function colorToCssBackground(value: string): string {
  if (!value) return '#1e293b';
  
  // Check if it's a gradient string from ColorPickerWithGradient
  const gradient = parseGradientString(value);
  if (gradient) {
    return `linear-gradient(${gradient.angle}deg, ${gradient.color1}, ${gradient.color2})`;
  }
  
  // Check if it's a hex color
  if (value.startsWith('#')) {
    return value;
  }
  
  // Check if it's a predefined key
  if (SLIDE_BG_COLORS[value]) {
    return SLIDE_BG_COLORS[value];
  }
  
  return value;
}

// Get background for a slide (uses slideBg if set, otherwise theme default)
function getSlideBackground(slide: ExportSlide, themeColors: { bg: string }): string {
  if (slide.slideBg) {
    return colorToCssBackground(slide.slideBg);
  }
  return themeColors.bg;
}

// Get bullet shape HTML - use CSS triangles for better PDF compatibility
function getBulletShapeHtml(shape: BulletDotShape | undefined, index: number, color: string, size: string): string {
  const sizeMap = { small: '10px', medium: '14px', large: '18px' };
  const fontSize = sizeMap[size as keyof typeof sizeMap] || '12px';
  const dotSize = size === 'large' ? '14px' : size === 'medium' ? '12px' : '10px';
  const arrowSize = size === 'large' ? '8px' : size === 'medium' ? '6px' : '5px';
  
  switch (shape) {
    case 'diamond':
      return `<span style="font-size: ${fontSize}; color: ${color}; flex-shrink: 0; margin-top: 6px;">◆</span>`;
    case 'arrow':
      // Use CSS triangle for better PDF rendering
      return `<div style="width: 0; height: 0; border-top: ${arrowSize} solid transparent; border-bottom: ${arrowSize} solid transparent; border-left: ${arrowSize} solid ${color}; flex-shrink: 0; margin-top: 8px;"></div>`;
    case 'dash':
      return `<div style="width: 12px; height: 3px; background: ${color}; flex-shrink: 0; margin-top: 12px;"></div>`;
    case 'number':
      return `<span style="font-size: ${fontSize}; color: ${color}; flex-shrink: 0; margin-top: 6px; font-weight: 500;">${index + 1}.</span>`;
    case 'letter':
      return `<span style="font-size: ${fontSize}; color: ${color}; flex-shrink: 0; margin-top: 6px; font-weight: 500;">${String.fromCharCode(97 + index)}.</span>`;
    default: // dot
      return `<div style="width: ${dotSize}; height: ${dotSize}; border-radius: 50%; background: ${color}; flex-shrink: 0; margin-top: 8px;"></div>`;
  }
}

/**
 * Export slides as PDF by capturing each slide element from DOM
 */
export async function exportSlidesToPDF(
  slideContainerId: string,
  slides: ExportSlide[],
  topic: string,
  theme: string,
  language: 'en' | 'ar',
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  // Create PDF in landscape (16:9 aspect ratio)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [297, 167], // 16:9 aspect ratio in mm
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Get the slide container element
  const container = document.getElementById(slideContainerId);
  if (!container) {
    throw new Error('Slide container not found');
  }

  // Capture each slide
  for (let i = 0; i < slides.length; i++) {
    if (i > 0) {
      doc.addPage([297, 167], 'landscape');
    }

    onProgress?.(i + 1, slides.length);

    // Find the slide element (we'll capture the current visible slide)
    const slideEl = container.querySelector('[data-slide-canvas]') as HTMLElement;
    if (!slideEl) continue;

    try {
      const canvas = await html2canvas(slideEl, {
        backgroundColor: THEME_COLORS[theme]?.bg || '#0f172a',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      
      // Fit image to page with small margin
      const margin = 2;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = pageHeight - margin * 2;
      
      doc.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
    } catch (err) {
      console.error(`Failed to capture slide ${i + 1}:`, err);
    }
  }

  // Add footer to last page
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  const footerText = language === 'ar' ? 'تم الإنشاء بواسطة Wakti AI' : 'Created with Wakti AI';
  doc.text(footerText, pageWidth / 2, pageHeight - 3, { align: 'center' });

  return doc.output('blob');
}

/**
 * Export slides as PDF by rendering each slide to canvas first
 * This properly supports Arabic text by using the browser's text rendering
 */
export async function exportSlidesToPDFClean(
  slides: ExportSlide[],
  topic: string,
  theme: string,
  language: 'en' | 'ar',
  onProgress?: (current: number, total: number) => void,
  enhancedHtmlMap?: Record<number, string>
): Promise<Blob> {
  // If we have any enhanced HTML, use the server-side Browserless pipeline.
  // This avoids all in-browser CORS/cssRules issues with html2canvas/html-to-image.
  if (enhancedHtmlMap && Object.keys(enhancedHtmlMap).length > 0) {
    onProgress?.(1, 1);

    const parser = new DOMParser();
    const pages: string[] = [];

    for (let i = 0; i < slides.length; i++) {
      const enhanced = enhancedHtmlMap[i];
      const fallback = renderSlideToHTML(
        slides[i],
        THEME_COLORS[theme] || THEME_COLORS.starter,
        language === 'ar',
        language,
        false
      );

      const html = enhanced || fallback;
      const doc = parser.parseFromString(html, 'text/html');

      const styleTags = Array.from(doc.querySelectorAll('style'))
        .map((s) => s.outerHTML)
        .join('\n');
      const linkTags = Array.from(doc.querySelectorAll('link[rel="stylesheet"], link[href*="fonts"], link[href*="googleapis"], link[href*="gstatic"]'))
        .map((l) => l.outerHTML)
        .join('\n');
      const bodyContent = doc.body?.innerHTML || html;

      pages.push(`\n<div class="page">\n  <div class="frame">\n    ${linkTags}\n    ${styleTags}\n    ${bodyContent}\n  </div>\n</div>`);
    }

    // 1920x1080 slide content scaled to 297mm x 167mm page.
    // 297mm @ 96dpi ~= 1122px. scale = 1122 / 1920.
    const scale = 1122 / 1920;

    const printableHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: 297mm 167mm; margin: 0; }
    html, body { margin: 0; padding: 0; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { width: 297mm; height: 167mm; overflow: hidden; page-break-after: always; position: relative; }
    .frame { width: 1920px; height: 1080px; transform: scale(${scale}); transform-origin: top left; }
  </style>
</head>
<body>
${pages.join('\n')}
</body>
</html>`;

    const apiBase = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
    const normalizedBase = (apiBase || '').replace(/\/+$/, '');
    const endpoint = `${normalizedBase}/api/presentations/pdf`;

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html: printableHtml,
        pdfOptions: {
          landscape: true,
          printBackground: true,
          preferCSSPageSize: true,
          margin: { top: '0', right: '0', bottom: '0', left: '0' },
        },
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      if (resp.status === 404 && !normalizedBase) {
        throw new Error(
          'Server PDF export endpoint not found (404). In local dev, Vite does not serve Vercel /api routes. Run `vercel dev` or set VITE_API_BASE_URL to your deployed Vercel site URL.'
        );
      }
      throw new Error(`Server PDF export failed (${resp.status}): ${txt.slice(0, 500)}`);
    }

    return await resp.blob();
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [297, 167],
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const colors = THEME_COLORS[theme] || THEME_COLORS.starter;
  const isRtl = language === 'ar';

  // Create a hidden container for rendering non-enhanced slides
  const container = document.createElement('div');
  container.style.cssText = 'position: fixed; left: -9999px; top: 0; width: 1920px; height: 1080px; overflow: hidden;';
  document.body.appendChild(container);

  // Fetch an external URL and return a base64 data URL, or null on failure
  async function fetchAsDataUrl(url: string): Promise<string | null> {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) return null;
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  // Replace all external image URLs in an HTML string with inline base64 data URLs.
  // If a fetch fails (CORS/network), uses a transparent 1x1 placeholder so the slide isn't black.
  async function inlineExternalImages(html: string): Promise<string> {
    const TRANSPARENT_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    const urlPattern = /(?:src=["']|url\(["']?)(https?:\/\/[^"')>\s]+)/g;
    const urlsFound = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = urlPattern.exec(html)) !== null) {
      urlsFound.add(match[1]);
    }

    if (urlsFound.size === 0) return html;

    // Fetch all in parallel; fall back to placeholder on any failure
    const replacements = new Map<string, string>();
    await Promise.all(Array.from(urlsFound).map(async (url) => {
      const dataUrl = await fetchAsDataUrl(url);
      replacements.set(url, dataUrl ?? TRANSPARENT_PLACEHOLDER);
    }));

    let result = html;
    replacements.forEach((dataUrl, originalUrl) => {
      result = result.split(originalUrl).join(dataUrl);
    });
    return result;
  }

  // Helper: capture an enhanced slide HTML as a JPEG data URL.
  // Strategy: inline all external images as base64, write to a Blob URL,
  // load in a hidden iframe (no sandbox = fonts/scripts work), then use
  // html-to-image inside the iframe's own document context so it never
  // touches the main page's cross-origin stylesheets.
  async function captureEnhancedSlide(html: string): Promise<string> {
    // Step 1: inline all external images to avoid cross-origin taint
    const inlinedHtml = await inlineExternalImages(html);

    // Step 2: strip ALL cross-origin font references to avoid SecurityError
    // Remove @import url(...fonts.googleapis...) from <style> tags
    // Remove <link> tags that load Google Fonts
    const cleanedHtml = inlinedHtml
      .replace(/(@import\s+url\([^)]*fonts\.googleapis[^)]*\)[^;]*;?|@import\s+["'][^"']*fonts\.googleapis[^"']*["'][^;]*;?)/gi, '')
      .replace(/<link[^>]*href=["'][^"']*fonts\.googleapis[^"']*["'][^>]*\/?>/gi, '')
      .replace(/<link[^>]*href=["'][^"']*fonts\.gstatic[^"']*["'][^>]*\/?>/gi, '');

    // Step 3: write to a Blob URL so the iframe treats it as same-origin
    const blob = new Blob([cleanedHtml], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:0;top:0;width:1920px;height:1080px;border:none;z-index:-9999;pointer-events:none;opacity:0.01;';
      document.body.appendChild(iframe);

      const cleanup = () => {
        URL.revokeObjectURL(blobUrl);
        try { document.body.removeChild(iframe); } catch (_) { /* ignore */ }
      };

      iframe.onload = async () => {
        try {
          const iDoc = iframe.contentDocument;
          if (!iDoc || !iDoc.body) { cleanup(); reject(new Error('iframe doc unavailable')); return; }

          // Wait for fonts inside the iframe
          if (iDoc.fonts) await iDoc.fonts.ready;
          await new Promise(res => setTimeout(res, 400));

          // Preload images
          const imgs = Array.from(iDoc.querySelectorAll('img'));
          if (imgs.length > 0) {
            await Promise.all(imgs.map(img => new Promise<void>(res => {
              if (img.complete && img.naturalWidth > 0) { res(); return; }
              img.onload = () => res(); img.onerror = () => res();
            })));
            await new Promise(res => setTimeout(res, 200));
          }

          const targetEl = (iDoc.body.firstElementChild || iDoc.body) as HTMLElement;

          // html2canvas with the iframe's own window — this avoids the main page
          // stylesheet SecurityError while still rasterizing the full document correctly
          // foreignObjectRendering: false — the foreignObject path tries to read
          // cssRules on cross-origin sheets and crashes. The classic rasterizer
          // renders text directly onto canvas without stylesheet access.
          const canvas = await html2canvas(targetEl, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: null,
            logging: false,
            removeContainer: false,
            foreignObjectRendering: false,
            width: 1920,
            height: 1080,
            windowWidth: 1920,
            windowHeight: 1080,
          });
          const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

          cleanup();
          resolve(dataUrl);
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      iframe.onerror = () => { cleanup(); reject(new Error('iframe load error')); };
      iframe.src = blobUrl;
    });
  }

  try {
    for (let i = 0; i < slides.length; i++) {
      if (i > 0) {
        doc.addPage([297, 167], 'landscape');
      }

      onProgress?.(i + 1, slides.length);
      const slide = slides[i];

      let slideImgData: string;

      if (enhancedHtmlMap && enhancedHtmlMap[i]) {
        // Enhanced slide: render in hidden iframe to preserve full-document styles/fonts
        slideImgData = await captureEnhancedSlide(enhancedHtmlMap[i]);
      } else {
        // Normal slide: render HTML into off-screen div and capture
        container.innerHTML = renderSlideToHTML(slide, colors, isRtl, language, false);

        await document.fonts.ready;

        const images = Array.from(container.querySelectorAll('img'));
        if (images.length > 0) {
          await Promise.all(images.map(img => new Promise<void>((res) => {
            if (img.complete && img.naturalWidth > 0) { res(); return; }
            img.onload = () => res();
            img.onerror = () => res();
          })));
          await new Promise(res => setTimeout(res, 300));
        }

        const canvas = await html2canvas(container.firstElementChild as HTMLElement, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: null,
          logging: false,
          removeContainer: false,
        });
        slideImgData = canvas.toDataURL('image/jpeg', 0.95);
      }

      doc.addImage(slideImgData, 'JPEG', 0, 0, pageWidth, pageHeight);
    }
  } finally {
    document.body.removeChild(container);
  }

  return doc.output('blob');
}

/**
 * Render a slide to HTML for canvas capture - Respects all custom styles
 */
// Helper to convert **keyword** to highlighted HTML
function highlightKeywords(text: string, accentColor: string, fontWeight: string = 'bold', fontStyle: string = 'normal'): string {
  return text.replace(/\*\*([^*]+)\*\*/g, `<span style="color: ${accentColor}; font-weight: ${fontWeight}; font-style: ${fontStyle};">$1</span>`);
}

// Helper to highlight the second word of a title (matching UI behavior)
// Includes font size scaling based on accentFontSize setting
function highlightSecondWord(
  text: string, 
  accentColor: string, 
  fontWeight: string = 'bold', 
  fontStyle: string = 'normal',
  fontSize: 'small' | 'medium' | 'large' | undefined = undefined
): string {
  const words = text.split(' ');
  if (words.length < 2) return text;
  
  // Font size scaling: small = 0.85em, medium = 1em, large = 1.15em
  const fontSizeStyle = fontSize === 'small' ? 'font-size: 0.85em;' : 
                        fontSize === 'large' ? 'font-size: 1.25em;' : '';
  
  return words.map((word, i) => {
    if (i === 1) {
      return `<span style="color: ${accentColor}; font-weight: ${fontWeight}; font-style: ${fontStyle}; ${fontSizeStyle}">${word}</span>`;
    }
    return word;
  }).join(' ');
}

function renderSlideToHTML(
  slide: ExportSlide, 
  colors: { bg: string; accent: string; text: string },
  isRtl: boolean,
  language: 'en' | 'ar',
  usePlaceholderForImage: boolean = false
): string {
  // If usePlaceholderForImage is true, we'll render a placeholder instead of the actual image
  // The actual image will be drawn directly to PDF with correct aspect ratio
  const hasImage = !usePlaceholderForImage && slide.imageUrl && slide.role !== 'cover' && slide.role !== 'thank_you';
  const hasImagePlaceholder = usePlaceholderForImage && slide.imageUrl && slide.role !== 'cover' && slide.role !== 'thank_you';
  const isCoverOrThankYou = slide.role === 'cover' || slide.role === 'thank_you';
  
  // Use custom slide background if set, otherwise use theme default
  const bgColor = getSlideBackground(slide, colors);
  
  // Get custom colors or use defaults - handle gradient strings
  const titleColor = colorToCssBackground(slide.titleStyle?.color || colors.text);
  const bulletColor = colorToCssBackground(slide.bulletStyle?.color || '#e2e8f0');
  const subtitleColor = colorToCssBackground(slide.subtitleStyle?.color || '#94a3b8');
  const accentColor = colorToCssBackground(slide.accentColor || colors.accent);
  const bulletDotColor = colorToCssBackground(slide.bulletDotColor || slide.accentColor || colors.accent);
  const bulletDotSize = slide.bulletDotSize || 'small';
  const bulletDotShape = slide.bulletDotShape || 'dot';
  const accentFontWeight = slide.accentFontWeight || 'bold';
  const accentFontStyle = slide.accentFontStyle || 'normal';
  const accentFontSize = slide.accentFontSize; // Can be 'small', 'medium', 'large', or undefined
  
  // Font size mapping for bullets - MUCH larger for 1920x1080 canvas
  // small = 32px, medium = 40px, large = 48px (was 24px before!)
  const bulletFontSizeMap: Record<string, string> = {
    small: '32px',
    medium: '40px',
    large: '48px',
  };
  const bulletFontSize = bulletFontSizeMap[slide.bulletStyle?.fontSize || 'medium'] || '40px';
  
  // Title font size mapping - also larger
  // small = 48px, medium = 56px, large = 64px
  const titleFontSizeMap: Record<string, string> = {
    small: '48px',
    medium: '56px',
    large: '64px',
  };
  const titleFontSize = titleFontSizeMap[slide.titleStyle?.fontSize || 'medium'] || '56px';
  
  // Process title - highlight second word (matching UI behavior) OR **keywords** if present
  // For regular content slides, highlight the second word of the title
  // For cover/thank_you slides, don't highlight
  const isCoverOrThankYouSlide = slide.role === 'cover' || slide.role === 'thank_you';
  let processedTitle: string;
  
  if (slide.title.includes('**')) {
    // If title has ** markers, use keyword highlighting
    processedTitle = highlightKeywords(slide.title, accentColor, accentFontWeight, accentFontStyle);
  } else if (!isCoverOrThankYouSlide) {
    // For regular slides, highlight the second word (matching UI) with all accent styles
    processedTitle = highlightSecondWord(slide.title, accentColor, accentFontWeight, accentFontStyle, accentFontSize);
  } else {
    processedTitle = slide.title;
  }
  
  // Process bullets - highlight **keywords** if present
  const processedBullets = (slide.bullets || []).map(b => highlightKeywords(b, accentColor, accentFontWeight, accentFontStyle)).slice(0, 5);
  
  // Get layout variant (default to text_left)
  const layout = slide.layoutVariant || 'text_left';

  // Stat Highlight slide - big numbers grid (with optional image on right)
  if (slide.role === 'stat_highlight') {
    const stats = slide.highlightedStats || [];
    const hasImage = !!slide.imageUrl;
    const statsAreaW = hasImage ? 1080 : (EXPORT_CANVAS_W - 120);
    const cols = stats.length <= 2 ? 2 : 3;
    const colWidth = Math.floor((statsAreaW - (cols - 1) * 30) / cols);
    const statCardsHtml = stats.map(stat => {
      const parts = stat.replace(/\\n/g, '\n').split('\n');
      const bigNum = highlightKeywords(parts[0] || stat, accentColor, 'bold', 'normal');
      const label = parts[1] || '';
      return `
        <div style="width: ${colWidth}px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; padding: 40px 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
          <div style="font-size: ${hasImage ? 60 : 80}px; font-weight: bold; color: ${accentColor}; line-height: 1;">${bigNum}</div>
          ${label ? `<div style="font-size: ${hasImage ? 24 : 32}px; color: #94a3b8; margin-top: 12px;">${label}</div>` : ''}
        </div>`;
    }).join('');
    const bulletOnlyHtml = processedBullets.map((b, index) => `
      <div style="display: flex; align-items: flex-start; gap: 20px; margin-bottom: 24px; ${isRtl ? 'flex-direction: row-reverse; text-align: right;' : ''}">
        ${getBulletShapeHtml(bulletDotShape, index, bulletDotColor, bulletDotSize)}
        <div style="font-size: 36px; line-height: 1.4; color: ${bulletColor}; flex: 1;">${b}</div>
      </div>`).join('');
    const contentHtml = stats.length > 0
      ? `<div style="flex: 1; display: flex; gap: 30px; align-items: center; ${hasImage ? '' : 'justify-content: center;'} flex-wrap: wrap;">${statCardsHtml}</div>`
      : `<div style="flex: 1;">${bulletOnlyHtml}</div>`;
    const imageHtml = hasImage
      ? `<div style="width: 680px; flex-shrink: 0; border-radius: 16px; overflow: hidden; aspect-ratio: 16/9;"><img src="${slide.imageUrl}" style="width: 100%; height: 100%; object-fit: cover;" /></div>`
      : '';
    return `
      <div style="width: 1920px; height: 1080px; background: ${bgColor}; font-family: 'Noto Sans Arabic', 'Segoe UI', sans-serif; direction: ${isRtl ? 'rtl' : 'ltr'}; display: flex; flex-direction: column; padding: 60px; box-sizing: border-box; position: relative;">
        <h1 style="font-size: ${titleFontSize}; font-weight: bold; color: ${titleColor}; margin: 0 0 16px 0; line-height: 1.2;">${processedTitle}</h1>
        <div style="display: flex; gap: 10px; margin-bottom: 40px; ${isRtl ? 'flex-direction: row-reverse;' : ''}">
          <div style="width: 12px; height: 12px; border-radius: 50%; background: ${accentColor};"></div>
          <div style="width: 12px; height: 12px; border-radius: 50%; background: ${accentColor};"></div>
          <div style="width: 12px; height: 12px; border-radius: 50%; background: ${accentColor};"></div>
        </div>
        <div style="flex: 1; display: flex; gap: 40px; align-items: center;">
          ${contentHtml}
          ${imageHtml}
        </div>
        <div style="position: absolute; bottom: 30px; left: 60px; right: 60px; display: flex; justify-content: space-between; color: #64748b; font-size: 16px;">
          <span>${language === 'ar' ? 'Wakti AI وقتي' : 'Wakti AI'}</span>
          <span>${slide.slideNumber}</span>
        </div>
      </div>`;
  }

  // Big Quote slide - centered quote layout
  if (slide.role === 'big_quote') {
    const quoteText = slide.subtitle || slide.title;
    const quoteSource = slide.subtitle ? slide.title : '';
    return `
      <div style="width: 1920px; height: 1080px; background: ${bgColor}; font-family: 'Noto Sans Arabic', 'Segoe UI', sans-serif; direction: ${isRtl ? 'rtl' : 'ltr'}; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 100px; box-sizing: border-box; position: relative;">
        <div style="font-size: 160px; font-weight: bold; color: ${accentColor}; opacity: 0.3; line-height: 0.6; margin-bottom: 40px;">"</div>
        <p style="font-size: 56px; font-weight: 500; color: ${titleColor}; line-height: 1.5; max-width: 1400px; margin: 0 0 48px 0;">${quoteText}</p>
        <div style="width: 80px; height: 6px; border-radius: 3px; background: ${accentColor}; margin-bottom: 32px;"></div>
        ${quoteSource ? `<p style="font-size: 28px; color: #64748b; letter-spacing: 3px; text-transform: uppercase;">${quoteSource}</p>` : ''}
        <div style="position: absolute; bottom: 30px; left: 60px; right: 60px; display: flex; justify-content: space-between; color: #64748b; font-size: 16px;">
          <span>${language === 'ar' ? 'Wakti AI وقتي' : 'Wakti AI'}</span>
          <span>${slide.slideNumber}</span>
        </div>
      </div>`;
  }

  // Cover/Thank You slide - centered layout (no image) or with layout variants if image added
  if (isCoverOrThankYou) {
    const hasSlideImage = slide.imageUrl;
    const paddingPx = 60;
    const gapPx = 60;
    const innerW = EXPORT_CANVAS_W - paddingPx * 2;
    const sidePct = getSideImageWidthPctForCover(slide.imageSize);
    const sideW = Math.round((innerW - gapPx) * sidePct);
    const sideH = get16by9Height(sideW);
    const topPct = getTopBottomWidthPct(slide.imageSize);
    const topW = Math.round(innerW * topPct);
    const topH = get16by9Height(topW);
    
    // No image - centered layout
    if (!hasSlideImage) {
      return `
        <div style="
          width: 1920px; 
          height: 1080px; 
          background: ${bgColor}; 
          font-family: 'Noto Sans Arabic', 'Segoe UI', sans-serif;
          direction: ${isRtl ? 'rtl' : 'ltr'};
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 80px;
          box-sizing: border-box;
          position: relative;
        ">
          <h1 style="font-size: 72px; font-weight: bold; color: ${titleColor}; margin: 0 0 24px 0; max-width: 80%;">${processedTitle}</h1>
          <div style="display: flex; gap: 12px; margin-bottom: 32px;">
            <div style="width: 14px; height: 14px; border-radius: 50%; background: ${accentColor};"></div>
            <div style="width: 14px; height: 14px; border-radius: 50%; background: ${accentColor};"></div>
            <div style="width: 14px; height: 14px; border-radius: 50%; background: ${accentColor};"></div>
          </div>
          ${slide.subtitle ? `<p style="font-size: 32px; color: ${subtitleColor}; margin: 0;">${slide.subtitle}</p>` : ''}
          <div style="position: absolute; bottom: 40px; left: 0; right: 0; display: flex; justify-content: space-between; padding: 0 60px; color: #64748b; font-size: 18px;">
            <span>${language === 'ar' ? 'Wakti AI وقتي' : 'Wakti AI'}</span>
            <span>${slide.slideNumber}</span>
          </div>
        </div>
      `;
    }
    
    // With image - respect layout variant
    const slideLayout = slide.layoutVariant || 'text_left';
    
    // Image Left
    if (slideLayout === 'image_left') {
      return `
        <div style="width: 1920px; height: 1080px; background: ${bgColor}; font-family: 'Noto Sans Arabic', 'Segoe UI', sans-serif; direction: ${isRtl ? 'rtl' : 'ltr'}; display: flex; padding: 60px; gap: 60px; box-sizing: border-box; position: relative;">
          <div style="width: ${sideW}px; display: flex; align-items: center; justify-content: center;">
            <div style="width: 100%; height: ${sideH}px; ${getExportImageStyle(slide).wrapperStyle}">
              <img src="${slide.imageUrl}" style="${getExportImageStyle(slide).imgStyle}" crossorigin="anonymous" />
            </div>
          </div>
          <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
            <h1 style="font-size: 64px; font-weight: bold; color: ${titleColor}; margin: 0 0 24px 0;">${processedTitle}</h1>
            <div style="display: flex; gap: 12px; margin-bottom: 24px;">
              <div style="width: 14px; height: 14px; border-radius: 50%; background: ${accentColor};"></div>
              <div style="width: 14px; height: 14px; border-radius: 50%; background: ${accentColor};"></div>
              <div style="width: 14px; height: 14px; border-radius: 50%; background: ${accentColor};"></div>
            </div>
            ${slide.subtitle ? `<p style="font-size: 28px; color: ${subtitleColor}; margin: 0;">${slide.subtitle}</p>` : ''}
          </div>
          <div style="position: absolute; bottom: 30px; left: 60px; right: 60px; display: flex; justify-content: space-between; color: #64748b; font-size: 16px;">
            <span>${language === 'ar' ? 'Wakti AI وقتي' : 'Wakti AI'}</span>
            <span>${slide.slideNumber}</span>
          </div>
        </div>
      `;
    }
    
    // Image Top
    if (slideLayout === 'image_top') {
      return `
        <div style="width: 1920px; height: 1080px; background: ${bgColor}; font-family: 'Noto Sans Arabic', 'Segoe UI', sans-serif; direction: ${isRtl ? 'rtl' : 'ltr'}; display: flex; flex-direction: column; padding: 60px; gap: 40px; box-sizing: border-box; position: relative;">
          <div style="width: ${topW}px; height: ${topH}px; margin: 0 auto;">
            <div style="width: 100%; height: 100%; ${getExportImageStyle(slide).wrapperStyle}">
              <img src="${slide.imageUrl}" style="${getExportImageStyle(slide).imgStyle}" crossorigin="anonymous" />
            </div>
          </div>
          <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
            <h1 style="font-size: 64px; font-weight: bold; color: ${titleColor}; margin: 0 0 24px 0;">${processedTitle}</h1>
            <div style="display: flex; gap: 12px; margin-bottom: 24px;">
              <div style="width: 14px; height: 14px; border-radius: 50%; background: ${accentColor};"></div>
              <div style="width: 14px; height: 14px; border-radius: 50%; background: ${accentColor};"></div>
              <div style="width: 14px; height: 14px; border-radius: 50%; background: ${accentColor};"></div>
            </div>
            ${slide.subtitle ? `<p style="font-size: 28px; color: ${subtitleColor}; margin: 0;">${slide.subtitle}</p>` : ''}
          </div>
          <div style="position: absolute; bottom: 30px; left: 60px; right: 60px; display: flex; justify-content: space-between; color: #64748b; font-size: 16px;">
            <span>${language === 'ar' ? 'Wakti AI وقتي' : 'Wakti AI'}</span>
            <span>${slide.slideNumber}</span>
          </div>
        </div>
      `;
    }
    
    // Image Bottom
    if (slideLayout === 'image_bottom') {
      return `
        <div style="width: 1920px; height: 1080px; background: ${bgColor}; font-family: 'Noto Sans Arabic', 'Segoe UI', sans-serif; direction: ${isRtl ? 'rtl' : 'ltr'}; display: flex; flex-direction: column; padding: 60px; gap: 40px; box-sizing: border-box; position: relative;">
          <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
            <h1 style="font-size: 64px; font-weight: bold; color: ${titleColor}; margin: 0 0 24px 0;">${processedTitle}</h1>
            <div style="display: flex; gap: 12px; margin-bottom: 24px;">
              <div style="width: 14px; height: 14px; border-radius: 50%; background: ${accentColor};"></div>
              <div style="width: 14px; height: 14px; border-radius: 50%; background: ${accentColor};"></div>
              <div style="width: 14px; height: 14px; border-radius: 50%; background: ${accentColor};"></div>
            </div>
            ${slide.subtitle ? `<p style="font-size: 28px; color: ${subtitleColor}; margin: 0;">${slide.subtitle}</p>` : ''}
          </div>
          <div style="width: ${topW}px; height: ${topH}px; margin: 0 auto;">
            <div style="width: 100%; height: 100%; ${getExportImageStyle(slide).wrapperStyle}">
              <img src="${slide.imageUrl}" style="${getExportImageStyle(slide).imgStyle}" crossorigin="anonymous" />
            </div>
          </div>
          <div style="position: absolute; bottom: 30px; left: 60px; right: 60px; display: flex; justify-content: space-between; color: #64748b; font-size: 16px;">
            <span>${language === 'ar' ? 'Wakti AI وقتي' : 'Wakti AI'}</span>
            <span>${slide.slideNumber}</span>
          </div>
        </div>
      `;
    }
    
    // Default: Image Right (text_left layout)
    return `
      <div style="width: 1920px; height: 1080px; background: ${bgColor}; font-family: 'Noto Sans Arabic', 'Segoe UI', sans-serif; direction: ${isRtl ? 'rtl' : 'ltr'}; display: flex; padding: 60px; gap: 60px; box-sizing: border-box; position: relative;">
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
          <h1 style="font-size: 64px; font-weight: bold; color: ${titleColor}; margin: 0 0 24px 0;">${processedTitle}</h1>
          <div style="display: flex; gap: 12px; margin-bottom: 24px;">
            <div style="width: 14px; height: 14px; border-radius: 50%; background: ${accentColor};"></div>
            <div style="width: 14px; height: 14px; border-radius: 50%; background: ${accentColor};"></div>
            <div style="width: 14px; height: 14px; border-radius: 50%; background: ${accentColor};"></div>
          </div>
          ${slide.subtitle ? `<p style="font-size: 28px; color: ${subtitleColor}; margin: 0;">${slide.subtitle}</p>` : ''}
        </div>
        <div style="width: ${sideW}px; display: flex; align-items: center; justify-content: center;">
          <div style="width: 100%; height: ${sideH}px; ${getExportImageStyle(slide).wrapperStyle}">
            <img src="${slide.imageUrl}" style="${getExportImageStyle(slide).imgStyle}" crossorigin="anonymous" />
          </div>
        </div>
        <div style="position: absolute; bottom: 30px; left: 60px; right: 60px; display: flex; justify-content: space-between; color: #64748b; font-size: 16px;">
          <span>${language === 'ar' ? 'Wakti AI وقتي' : 'Wakti AI'}</span>
          <span>${slide.slideNumber}</span>
        </div>
      </div>
    `;
  }

  // Build bullet HTML with custom shape, color, size, and highlighted keywords
  const bulletHtml = processedBullets.map((b, index) => `
    <div style="display: flex; align-items: flex-start; gap: 20px; margin-bottom: 28px; ${isRtl ? 'flex-direction: row-reverse; text-align: right;' : ''}">
      ${getBulletShapeHtml(bulletDotShape, index, bulletDotColor, bulletDotSize)}
      <div style="font-size: ${bulletFontSize}; line-height: 1.5; color: ${bulletColor}; flex: 1;">${b}</div>
    </div>
  `).join('');

  // Image size mapping
  const getImageSize = () => {
    switch (slide.imageSize) {
      case 'small': return { width: '35%', height: 'auto' };
      case 'large': return { width: '55%', height: 'auto' };
      case 'full': return { width: '60%', height: '100%' };
      default: return { width: '45%', height: 'auto' };
    }
  };

  const imgSize = getImageSize();

  const { wrapperStyle: imgWrapperStyle, imgStyle: imgInnerStyle } = getExportImageStyle(slide);

  const paddingPx = 60;
  const gapPx = 60;
  const innerW = EXPORT_CANVAS_W - paddingPx * 2;
  const sidePct = getSideImageWidthPctForContent(slide.imageSize);
  const sideW = Math.round((innerW - gapPx) * sidePct);
  const sideH = get16by9Height(sideW);
  const topPct = getTopBottomWidthPct(slide.imageSize);
  const topW = Math.round(innerW * topPct);
  const topH = get16by9Height(topW);

  // Layout: Image Left
  if ((hasImage || hasImagePlaceholder) && layout === 'image_left') {
    return `
      <div style="
        width: 1920px; 
        height: 1080px; 
        background: ${bgColor}; 
        font-family: 'Noto Sans Arabic', 'Segoe UI', sans-serif;
        direction: ${isRtl ? 'rtl' : 'ltr'};
        display: flex;
        padding: 60px;
        gap: 60px;
        box-sizing: border-box;
        position: relative;
      ">
        <!-- Image Column (LEFT) -->
        <div style="width: ${sideW}px; display: flex; align-items: center; justify-content: center;">
          <div style="width: 100%; height: ${sideH}px; ${imgWrapperStyle}">
            <img src="${slide.imageUrl}" style="${imgInnerStyle}" crossorigin="anonymous" />
          </div>
        </div>
        
        <!-- Text Column (RIGHT) -->
        <div style="flex: 1; display: flex; flex-direction: column; ${isRtl ? 'text-align: right;' : ''}">
          <h1 style="font-size: ${titleFontSize}; font-weight: bold; color: ${titleColor}; margin: 0 0 20px 0; line-height: 1.2;">${processedTitle}</h1>
          <div style="display: flex; gap: 10px; margin-bottom: 32px; ${isRtl ? 'flex-direction: row-reverse;' : ''}">
            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${accentColor};"></div>
            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${accentColor};"></div>
            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${accentColor};"></div>
          </div>
          <div style="flex: 1;">
            ${bulletHtml}
          </div>
        </div>
        
        <!-- Footer -->
        <div style="position: absolute; bottom: 30px; left: 60px; right: 60px; display: flex; justify-content: space-between; color: #64748b; font-size: 16px;">
          <span>${language === 'ar' ? 'Wakti AI وقتي' : 'Wakti AI'}</span>
          <span>${slide.slideNumber}</span>
        </div>
      </div>
    `;
  }

  // Layout: Image Top - Image takes remaining space, bullets auto-size
  if ((hasImage || hasImagePlaceholder) && layout === 'image_top') {
    return `
      <div style="
        width: 1920px; 
        height: 1080px; 
        background: ${bgColor}; 
        font-family: 'Noto Sans Arabic', 'Segoe UI', sans-serif;
        direction: ${isRtl ? 'rtl' : 'ltr'};
        display: flex;
        flex-direction: column;
        padding: 50px 60px;
        gap: 25px;
        box-sizing: border-box;
        position: relative;
      ">
        <!-- Title -->
        <h1 style="font-size: ${titleFontSize}; font-weight: bold; color: ${titleColor}; margin: 0; line-height: 1.2; ${isRtl ? 'text-align: right;' : ''}">${processedTitle}</h1>
        <div style="display: flex; gap: 10px; ${isRtl ? 'flex-direction: row-reverse;' : ''}">
          <div style="width: 12px; height: 12px; border-radius: 50%; background: ${accentColor};"></div>
          <div style="width: 12px; height: 12px; border-radius: 50%; background: ${accentColor};"></div>
          <div style="width: 12px; height: 12px; border-radius: 50%; background: ${accentColor};"></div>
        </div>
        
        <!-- Image (TOP) - Fixed 16:9 frame to match preview -->
        <div style="width: ${topW}px; height: ${topH}px; margin: 0 auto;">
          <div style="width: 100%; height: 100%; ${imgWrapperStyle}">
            <img src="${slide.imageUrl}" style="${imgInnerStyle}" crossorigin="anonymous" />
          </div>
        </div>
        
        <!-- Bullets (BOTTOM) - Auto-size based on content -->
        <div style="flex: 0 0 auto;">
          ${bulletHtml}
        </div>
        
        <!-- Footer -->
        <div style="position: absolute; bottom: 20px; left: 60px; right: 60px; display: flex; justify-content: space-between; color: #64748b; font-size: 16px;">
          <span>${language === 'ar' ? 'Wakti AI وقتي' : 'Wakti AI'}</span>
          <span>${slide.slideNumber}</span>
        </div>
      </div>
    `;
  }

  // Layout: Image Bottom - Bullets auto-size, image takes remaining space
  if ((hasImage || hasImagePlaceholder) && layout === 'image_bottom') {
    return `
      <div style="
        width: 1920px; 
        height: 1080px; 
        background: ${bgColor}; 
        font-family: 'Noto Sans Arabic', 'Segoe UI', sans-serif;
        direction: ${isRtl ? 'rtl' : 'ltr'};
        display: flex;
        flex-direction: column;
        padding: 50px 60px;
        gap: 25px;
        box-sizing: border-box;
        position: relative;
      ">
        <!-- Title -->
        <h1 style="font-size: ${titleFontSize}; font-weight: bold; color: ${titleColor}; margin: 0; line-height: 1.2; ${isRtl ? 'text-align: right;' : ''}">${processedTitle}</h1>
        <div style="display: flex; gap: 10px; ${isRtl ? 'flex-direction: row-reverse;' : ''}">
          <div style="width: 12px; height: 12px; border-radius: 50%; background: ${accentColor};"></div>
          <div style="width: 12px; height: 12px; border-radius: 50%; background: ${accentColor};"></div>
          <div style="width: 12px; height: 12px; border-radius: 50%; background: ${accentColor};"></div>
        </div>
        
        <!-- Bullets (TOP) - Auto-size based on content -->
        <div style="flex: 0 0 auto;">
          ${bulletHtml}
        </div>
        
        <!-- Image (BOTTOM) - Fixed 16:9 frame to match preview -->
        <div style="width: ${topW}px; height: ${topH}px; margin: 0 auto;">
          <div style="width: 100%; height: 100%; ${imgWrapperStyle}">
            <img src="${slide.imageUrl}" style="${imgInnerStyle}" crossorigin="anonymous" />
          </div>
        </div>
        
        <!-- Footer -->
        <div style="position: absolute; bottom: 20px; left: 60px; right: 60px; display: flex; justify-content: space-between; color: #64748b; font-size: 16px;">
          <span>${language === 'ar' ? 'Wakti AI وقتي' : 'Wakti AI'}</span>
          <span>${slide.slideNumber}</span>
        </div>
      </div>
    `;
  }

  // Layout: Text Left (default) or Text Only with image
  if (hasImage || hasImagePlaceholder) {
    return `
      <div style="
        width: 1920px; 
        height: 1080px; 
        background: ${bgColor}; 
        font-family: 'Noto Sans Arabic', 'Segoe UI', sans-serif;
        direction: ${isRtl ? 'rtl' : 'ltr'};
        display: flex;
        padding: 60px;
        gap: 60px;
        box-sizing: border-box;
        position: relative;
      ">
        <!-- Text Column (LEFT) -->
        <div style="flex: 1; display: flex; flex-direction: column; ${isRtl ? 'text-align: right;' : ''}">
          <h1 style="font-size: ${titleFontSize}; font-weight: bold; color: ${titleColor}; margin: 0 0 20px 0; line-height: 1.2;">${processedTitle}</h1>
          <div style="display: flex; gap: 10px; margin-bottom: 32px; ${isRtl ? 'flex-direction: row-reverse;' : ''}">
            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${accentColor};"></div>
            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${accentColor};"></div>
            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${accentColor};"></div>
          </div>
          <div style="flex: 1;">
            ${bulletHtml}
          </div>
        </div>
        
        <!-- Image Column (RIGHT) -->
        <div style="width: ${sideW}px; display: flex; align-items: center; justify-content: center;">
          <div style="width: 100%; height: ${sideH}px; ${imgWrapperStyle}">
            <img src="${slide.imageUrl}" style="${imgInnerStyle}" crossorigin="anonymous" />
          </div>
        </div>
        
        <!-- Footer -->
        <div style="position: absolute; bottom: 30px; left: 60px; right: 60px; display: flex; justify-content: space-between; color: #64748b; font-size: 16px;">
          <span>${language === 'ar' ? 'Wakti AI وقتي' : 'Wakti AI'}</span>
          <span>${slide.slideNumber}</span>
        </div>
      </div>
    `;
  }

  // Text Only layout (no image) - use custom bullet shapes with highlighted keywords
  // Text-only gets slightly larger bullets since there's more space
  const textOnlyBulletFontSizeMap: Record<string, string> = {
    small: '36px',
    medium: '44px',
    large: '52px',
  };
  const textOnlyBulletFontSize = textOnlyBulletFontSizeMap[slide.bulletStyle?.fontSize || 'medium'] || '44px';
  
  const textOnlyBulletHtml = processedBullets.map((b, index) => `
    <div style="display: flex; align-items: flex-start; gap: 24px; margin-bottom: 32px; ${isRtl ? 'flex-direction: row-reverse; text-align: right;' : ''}">
      ${getBulletShapeHtml(bulletDotShape, index, bulletDotColor, bulletDotSize === 'small' ? 'medium' : bulletDotSize)}
      <div style="font-size: ${textOnlyBulletFontSize}; line-height: 1.5; color: ${bulletColor}; flex: 1;">${b}</div>
    </div>
  `).join('');

  return `
    <div style="
      width: 1920px; 
      height: 1080px; 
      background: ${bgColor}; 
      font-family: 'Noto Sans Arabic', 'Segoe UI', sans-serif;
      direction: ${isRtl ? 'rtl' : 'ltr'};
      display: flex;
      flex-direction: column;
      padding: 60px 100px;
      box-sizing: border-box;
      position: relative;
    ">
      <h1 style="font-size: ${titleFontSize}; font-weight: bold; color: ${titleColor}; margin: 0 0 20px 0; ${isRtl ? 'text-align: right;' : ''}">${processedTitle}</h1>
      <div style="display: flex; gap: 10px; margin-bottom: 40px; ${isRtl ? 'flex-direction: row-reverse;' : ''}">
        <div style="width: 14px; height: 14px; border-radius: 50%; background: ${accentColor};"></div>
        <div style="width: 14px; height: 14px; border-radius: 50%; background: ${accentColor};"></div>
        <div style="width: 14px; height: 14px; border-radius: 50%; background: ${accentColor};"></div>
      </div>
      <div style="flex: 1; max-width: 85%;">
        ${textOnlyBulletHtml}
      </div>
      <div style="display: flex; justify-content: space-between; color: #64748b; font-size: 16px; margin-top: auto;">
        <span>${language === 'ar' ? 'Wakti AI وقتي' : 'Wakti AI'}</span>
        <span>${slide.slideNumber}</span>
      </div>
    </div>
  `;
}

/**
 * Export slides as PPTX (PowerPoint)
 * Renders each slide as an image to preserve gradients, colors, and exact styling
 */
export async function exportSlidesToPPTX(
  slides: ExportSlide[],
  topic: string,
  theme: string,
  language: 'en' | 'ar',
  onProgress?: (current: number, total: number) => void,
  enhancedHtmlMap?: Record<number, string>
): Promise<Blob> {
  // Dynamically import pptxgenjs and html2canvas
  const PptxGenJS = (await import('pptxgenjs')).default;
  const html2canvasModule = await import('html2canvas');
  const html2canvas = html2canvasModule.default;
  
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = topic;
  pptx.author = 'Wakti AI';
  
  const colors = THEME_COLORS[theme] || THEME_COLORS.starter;

  // Create a hidden container for rendering slides
  const container = document.createElement('div');
  container.style.cssText = 'position: fixed; left: -9999px; top: 0; width: 1920px; height: 1080px;';
  document.body.appendChild(container);

  try {
    for (let i = 0; i < slides.length; i++) {
      onProgress?.(i + 1, slides.length);
      const slide = slides[i];
      
      // Use saved enhanced HTML if available, otherwise render normally
      const isRtl = language === 'ar';
      if (enhancedHtmlMap && enhancedHtmlMap[i]) {
        container.innerHTML = enhancedHtmlMap[i];
      } else {
        container.innerHTML = renderSlideToHTML(slide, colors, isRtl, language);
      }

      // Wait for images to load
      const images = container.querySelectorAll('img');
      await Promise.all(
        Array.from(images).map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve();
              } else {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              }
            })
        )
      );

      // Small delay for rendering
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Render to canvas
      const canvas = await html2canvas(container.firstElementChild as HTMLElement, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });

      // Convert canvas to base64 image
      const imgData = canvas.toDataURL('image/png');

      // Add slide with the rendered image as background
      const pptSlide = pptx.addSlide();
      pptSlide.addImage({
        data: imgData,
        x: 0,
        y: 0,
        w: '100%',
        h: '100%',
      });
    }
  } finally {
    // Clean up
    document.body.removeChild(container);
  }

  // Generate blob
  const pptxBlob = await pptx.write({ outputType: 'blob' });
  return pptxBlob as Blob;
}

/**
 * Trigger file download - uses Share API on mobile for proper filename
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  // On mobile, try Share API first (preserves filename)
  if (isMobile && navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Wakti Presentation',
        });
        return;
      }
    } catch (err) {
      console.log('Share API failed, falling back to download:', err);
    }
  }
  
  // Fallback: traditional download (works on desktop, may lose filename on mobile)
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate safe filename from topic
 */
export function generateFilename(topic: string, extension: 'pdf' | 'pptx'): string {
  const safeTopic = topic
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50);
  
  const timestamp = new Date().toISOString().slice(0, 10);
  return `wakti-presentation-${safeTopic}-${timestamp}.${extension}`;
}
