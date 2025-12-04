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
 * Export slides as PDF by rendering each slide programmatically (no DOM capture)
 * This creates clean, consistent PDF output
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
  const margin = 15;
  const isRtl = language === 'ar';

  for (let i = 0; i < slides.length; i++) {
    if (i > 0) {
      doc.addPage([297, 167], 'landscape');
    }

    onProgress?.(i + 1, slides.length);
    const slide = slides[i];

    // Background
    doc.setFillColor(colors.bg);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Title
    doc.setTextColor(colors.text);
    doc.setFontSize(24);
    const titleX = isRtl ? pageWidth - margin : margin;
    doc.text(slide.title, titleX, margin + 15, { align: isRtl ? 'right' : 'left' });

    // Accent dots under title
    const accentColor = colors.accent;
    const r = parseInt(accentColor.slice(1, 3), 16);
    const g = parseInt(accentColor.slice(3, 5), 16);
    const b = parseInt(accentColor.slice(5, 7), 16);
    doc.setFillColor(r, g, b);
    for (let d = 0; d < 3; d++) {
      const dotX = isRtl ? pageWidth - margin - d * 6 : margin + d * 6;
      doc.circle(dotX, margin + 22, 1.5, 'F');
    }

    // Subtitle
    if (slide.subtitle) {
      doc.setFontSize(14);
      doc.setTextColor(200, 200, 200);
      doc.text(slide.subtitle, titleX, margin + 32, { align: isRtl ? 'right' : 'left' });
    }

    // Bullets
    if (slide.bullets && slide.bullets.length > 0) {
      doc.setFontSize(11);
      doc.setTextColor(220, 220, 220);
      let bulletY = margin + 45;
      
      for (const bullet of slide.bullets.slice(0, 6)) {
        // Clean markdown bold markers
        const cleanBullet = bullet.replace(/\*\*/g, '');
        
        // Bullet point
        doc.setFillColor(r, g, b);
        const bulletX = isRtl ? pageWidth - margin - 2 : margin + 2;
        doc.circle(bulletX, bulletY - 1, 1, 'F');
        
        // Text
        const textX = isRtl ? pageWidth - margin - 8 : margin + 8;
        const maxWidth = pageWidth / 2 - margin - 10;
        const lines = doc.splitTextToSize(cleanBullet, maxWidth);
        doc.text(lines, textX, bulletY, { align: isRtl ? 'right' : 'left' });
        bulletY += lines.length * 6 + 4;
      }
    }

    // Image placeholder (right side for content slides)
    if (slide.imageUrl && slide.role !== 'cover' && slide.role !== 'thank_you') {
      try {
        // Try to load and add the image
        const imgWidth = pageWidth / 2 - margin * 2;
        const imgHeight = pageHeight - margin * 2 - 30;
        const imgX = isRtl ? margin : pageWidth / 2 + margin / 2;
        const imgY = margin + 30;
        
        // Add image with rounded corners effect (just add the image)
        doc.addImage(slide.imageUrl, 'JPEG', imgX, imgY, imgWidth, imgHeight);
      } catch (err) {
        // If image fails, draw a placeholder
        doc.setFillColor(50, 50, 60);
        doc.roundedRect(
          isRtl ? margin : pageWidth / 2 + margin / 2,
          margin + 30,
          pageWidth / 2 - margin * 2,
          pageHeight - margin * 2 - 30,
          3, 3, 'F'
        );
      }
    }

    // Slide number
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`${slide.slideNumber}`, pageWidth - 10, pageHeight - 5, { align: 'right' });

    // Footer branding
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    const brandText = language === 'ar' ? 'Wakti AI وقتي' : 'Wakti AI';
    doc.text(brandText, margin, pageHeight - 5);
  }

  return doc.output('blob');
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
 * Trigger file download
 */
export function downloadBlob(blob: Blob, filename: string): void {
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
