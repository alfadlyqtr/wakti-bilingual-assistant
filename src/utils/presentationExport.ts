/**
 * Presentation Export Utilities
 * Exports slides as PDF (card-style) or PPTX (PowerPoint)
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

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
}

// Theme colors for PDF/PPTX
const THEME_COLORS: Record<string, { bg: string; accent: string; text: string }> = {
  starter: { bg: '#0f172a', accent: '#3b82f6', text: '#ffffff' },
  professional: { bg: '#1e1b4b', accent: '#6366f1', text: '#ffffff' },
  pitch_deck: { bg: '#064e3b', accent: '#10b981', text: '#ffffff' },
  creative: { bg: '#431407', accent: '#f97316', text: '#ffffff' },
  academic: { bg: '#083344', accent: '#06b6d4', text: '#ffffff' },
};

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
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [297, 167],
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const colors = THEME_COLORS[theme] || THEME_COLORS.starter;
  const isRtl = language === 'ar';

  // Create a hidden container for rendering slides
  const container = document.createElement('div');
  container.style.cssText = 'position: fixed; left: -9999px; top: 0; width: 1920px; height: 1080px;';
  document.body.appendChild(container);

  try {
    for (let i = 0; i < slides.length; i++) {
      if (i > 0) {
        doc.addPage([297, 167], 'landscape');
      }

      onProgress?.(i + 1, slides.length);
      const slide = slides[i];

      // Create slide HTML with proper Arabic support
      container.innerHTML = renderSlideToHTML(slide, colors, isRtl, language);
      
      // Wait for fonts to load
      await document.fonts.ready;
      
      // Capture with html2canvas
      const canvas = await html2canvas(container.firstElementChild as HTMLElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: colors.bg,
      });

      // Add to PDF
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
    }
  } finally {
    // Clean up
    document.body.removeChild(container);
  }

  return doc.output('blob');
}

/**
 * Render a slide to HTML for canvas capture - Professional layout
 */
function renderSlideToHTML(
  slide: ExportSlide, 
  colors: { bg: string; accent: string; text: string },
  isRtl: boolean,
  language: 'en' | 'ar'
): string {
  const cleanBullets = (slide.bullets || []).map(b => b.replace(/\*\*/g, '')).slice(0, 5);
  const hasImage = slide.imageUrl && slide.role !== 'cover' && slide.role !== 'thank_you';
  const isCoverOrThankYou = slide.role === 'cover' || slide.role === 'thank_you';

  // Cover/Thank You slide - centered layout
  if (isCoverOrThankYou) {
    return `
      <div style="
        width: 1920px; 
        height: 1080px; 
        background: ${colors.bg}; 
        font-family: 'Noto Sans Arabic', 'Segoe UI', sans-serif;
        direction: ${isRtl ? 'rtl' : 'ltr'};
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 80px;
        box-sizing: border-box;
      ">
        <h1 style="font-size: 72px; font-weight: bold; color: ${colors.text}; margin: 0 0 24px 0; max-width: 80%;">${slide.title}</h1>
        <div style="display: flex; gap: 12px; margin-bottom: 32px;">
          <div style="width: 14px; height: 14px; border-radius: 50%; background: ${colors.accent};"></div>
          <div style="width: 14px; height: 14px; border-radius: 50%; background: ${colors.accent};"></div>
          <div style="width: 14px; height: 14px; border-radius: 50%; background: ${colors.accent};"></div>
        </div>
        ${slide.subtitle ? `<p style="font-size: 32px; color: #94a3b8; margin: 0;">${slide.subtitle}</p>` : ''}
        <div style="position: absolute; bottom: 40px; left: 0; right: 0; display: flex; justify-content: space-between; padding: 0 60px; color: #64748b; font-size: 18px;">
          <span>${language === 'ar' ? 'Wakti AI وقتي' : 'Wakti AI'}</span>
          <span>${slide.slideNumber}</span>
        </div>
      </div>
    `;
  }

  // Content slide with image - two column layout
  if (hasImage) {
    const bulletHtml = cleanBullets.map(b => `
      <div style="display: flex; align-items: flex-start; gap: 16px; margin-bottom: 20px; ${isRtl ? 'flex-direction: row-reverse; text-align: right;' : ''}">
        <div style="width: 12px; height: 12px; border-radius: 50%; background: ${colors.accent}; flex-shrink: 0; margin-top: 8px;"></div>
        <div style="font-size: 24px; line-height: 1.6; color: #e2e8f0; flex: 1;">${b}</div>
      </div>
    `).join('');

    return `
      <div style="
        width: 1920px; 
        height: 1080px; 
        background: ${colors.bg}; 
        font-family: 'Noto Sans Arabic', 'Segoe UI', sans-serif;
        direction: ${isRtl ? 'rtl' : 'ltr'};
        display: flex;
        padding: 60px;
        gap: 60px;
        box-sizing: border-box;
      ">
        <!-- Text Column -->
        <div style="flex: 1; display: flex; flex-direction: column; ${isRtl ? 'text-align: right;' : ''}">
          <h1 style="font-size: 52px; font-weight: bold; color: ${colors.text}; margin: 0 0 20px 0; line-height: 1.2;">${slide.title}</h1>
          <div style="display: flex; gap: 10px; margin-bottom: 32px; ${isRtl ? 'flex-direction: row-reverse;' : ''}">
            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${colors.accent};"></div>
            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${colors.accent};"></div>
            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${colors.accent};"></div>
          </div>
          <div style="flex: 1; padding-${isRtl ? 'left' : 'right'}: 20px;">
            ${bulletHtml}
          </div>
        </div>
        
        <!-- Image Column -->
        <div style="width: 45%; display: flex; align-items: center; justify-content: center;">
          <img src="${slide.imageUrl}" style="width: 100%; height: auto; max-height: 100%; object-fit: cover; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.3);" crossorigin="anonymous" />
        </div>
        
        <!-- Footer -->
        <div style="position: absolute; bottom: 30px; left: 60px; right: 60px; display: flex; justify-content: space-between; color: #64748b; font-size: 16px;">
          <span>${language === 'ar' ? 'Wakti AI وقتي' : 'Wakti AI'}</span>
          <span>${slide.slideNumber}</span>
        </div>
      </div>
    `;
  }

  // Content slide without image - full width bullets
  const bulletHtml = cleanBullets.map(b => `
    <div style="display: flex; align-items: flex-start; gap: 20px; margin-bottom: 28px; ${isRtl ? 'flex-direction: row-reverse; text-align: right;' : ''}">
      <div style="width: 14px; height: 14px; border-radius: 50%; background: ${colors.accent}; flex-shrink: 0; margin-top: 10px;"></div>
      <div style="font-size: 28px; line-height: 1.6; color: #e2e8f0; flex: 1;">${b}</div>
    </div>
  `).join('');

  return `
    <div style="
      width: 1920px; 
      height: 1080px; 
      background: ${colors.bg}; 
      font-family: 'Noto Sans Arabic', 'Segoe UI', sans-serif;
      direction: ${isRtl ? 'rtl' : 'ltr'};
      display: flex;
      flex-direction: column;
      padding: 60px 100px;
      box-sizing: border-box;
    ">
      <h1 style="font-size: 56px; font-weight: bold; color: ${colors.text}; margin: 0 0 20px 0; ${isRtl ? 'text-align: right;' : ''}">${slide.title}</h1>
      <div style="display: flex; gap: 10px; margin-bottom: 40px; ${isRtl ? 'flex-direction: row-reverse;' : ''}">
        <div style="width: 14px; height: 14px; border-radius: 50%; background: ${colors.accent};"></div>
        <div style="width: 14px; height: 14px; border-radius: 50%; background: ${colors.accent};"></div>
        <div style="width: 14px; height: 14px; border-radius: 50%; background: ${colors.accent};"></div>
      </div>
      <div style="flex: 1; max-width: 85%;">
        ${bulletHtml}
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
 * Uses pptxgenjs library
 */
export async function exportSlidesToPPTX(
  slides: ExportSlide[],
  topic: string,
  theme: string,
  language: 'en' | 'ar',
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  // Dynamically import pptxgenjs
  const PptxGenJS = (await import('pptxgenjs')).default;
  
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = topic;
  pptx.author = 'Wakti AI';
  
  const colors = THEME_COLORS[theme] || THEME_COLORS.starter;
  const isRtl = language === 'ar';

  for (let i = 0; i < slides.length; i++) {
    onProgress?.(i + 1, slides.length);
    const slide = slides[i];
    const pptSlide = pptx.addSlide();

    // Background
    pptSlide.background = { color: colors.bg.replace('#', '') };

    // Title
    pptSlide.addText(slide.title, {
      x: isRtl ? 0.5 : 0.5,
      y: 0.5,
      w: slide.imageUrl ? '45%' : '90%',
      h: 0.8,
      fontSize: 28,
      bold: true,
      color: colors.text.replace('#', ''),
      align: isRtl ? 'right' : 'left',
      rtlMode: isRtl,
    });

    // Accent dots
    const dotY = 1.3;
    for (let d = 0; d < 3; d++) {
      pptSlide.addShape('ellipse', {
        x: isRtl ? 4.5 - d * 0.2 : 0.5 + d * 0.2,
        y: dotY,
        w: 0.12,
        h: 0.12,
        fill: { color: colors.accent.replace('#', '') },
      });
    }

    // Subtitle
    if (slide.subtitle) {
      pptSlide.addText(slide.subtitle, {
        x: 0.5,
        y: 1.5,
        w: slide.imageUrl ? '45%' : '90%',
        h: 0.5,
        fontSize: 14,
        color: 'C8C8C8',
        align: isRtl ? 'right' : 'left',
        rtlMode: isRtl,
      });
    }

    // Bullets
    if (slide.bullets && slide.bullets.length > 0) {
      const bulletText = slide.bullets.slice(0, 6).map(b => ({
        text: b.replace(/\*\*/g, ''),
        options: { bullet: { type: 'bullet' as const, color: colors.accent.replace('#', '') } },
      }));

      pptSlide.addText(bulletText, {
        x: 0.5,
        y: 2.0,
        w: slide.imageUrl ? '45%' : '90%',
        h: 3.0,
        fontSize: 12,
        color: 'DCDCDC',
        align: isRtl ? 'right' : 'left',
        rtlMode: isRtl,
        valign: 'top',
      });
    }

    // Image
    if (slide.imageUrl && slide.role !== 'cover' && slide.role !== 'thank_you') {
      try {
        pptSlide.addImage({
          path: slide.imageUrl,
          x: isRtl ? 0.5 : 5.2,
          y: 1.5,
          w: 4.3,
          h: 3.2,
          rounding: true,
        });
      } catch (err) {
        console.error('Failed to add image to PPTX:', err);
      }
    }

    // Slide number
    pptSlide.addText(`${slide.slideNumber}`, {
      x: 9.2,
      y: 5.1,
      w: 0.5,
      h: 0.3,
      fontSize: 10,
      color: '666666',
      align: 'right',
    });

    // Footer branding
    pptSlide.addText(language === 'ar' ? 'Wakti AI وقتي' : 'Wakti AI', {
      x: 0.5,
      y: 5.1,
      w: 2,
      h: 0.3,
      fontSize: 8,
      color: '505050',
    });
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
