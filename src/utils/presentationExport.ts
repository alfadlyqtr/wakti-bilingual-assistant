/**
 * Presentation Export Utilities
 * Exports slides as PDF (card-style) or PPTX (PowerPoint)
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

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
      
      // Create slide HTML - render with actual images
      container.innerHTML = renderSlideToHTML(slide, colors, isRtl, language, false);
      
      // Wait for fonts to load
      await document.fonts.ready;
      
      // Preload all images before capture
      const images = Array.from(container.querySelectorAll('img'));
      if (images.length > 0) {
        await Promise.all(images.map(img => {
          return new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) {
              resolve();
            } else {
              img.onload = () => resolve();
              img.onerror = () => resolve(); // Continue even if image fails
            }
          });
        }));
        // Extra wait for images to render
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Capture with html2canvas - backgroundColor null to let CSS gradient show
      const canvas = await html2canvas(container.firstElementChild as HTMLElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
        removeContainer: false,
      });

      // Add slide to PDF
      const slideImgData = canvas.toDataURL('image/jpeg', 0.95);
      doc.addImage(slideImgData, 'JPEG', 0, 0, pageWidth, pageHeight);
    }
  } finally {
    // Clean up
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

  // Cover/Thank You slide - centered layout (no image) or with layout variants if image added
  if (isCoverOrThankYou) {
    const hasSlideImage = slide.imageUrl;
    const imgSize = slide.imageSize === 'small' ? '30%' : slide.imageSize === 'large' ? '50%' : '40%';
    const imgHeight = slide.imageSize === 'small' ? '250px' : slide.imageSize === 'large' ? '450px' : '350px';
    
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
          <div style="width: ${imgSize}; display: flex; align-items: center; justify-content: center;">
            <img src="${slide.imageUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 20px;" crossorigin="anonymous" />
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
          <div style="width: 100%; height: ${imgHeight}; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 20px;">
            <img src="${slide.imageUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 20px;" crossorigin="anonymous" />
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
          <div style="width: 100%; height: ${imgHeight}; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 20px;">
            <img src="${slide.imageUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 20px;" crossorigin="anonymous" />
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
        <div style="width: ${imgSize}; display: flex; align-items: center; justify-content: center;">
          <img src="${slide.imageUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 20px;" crossorigin="anonymous" />
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
    <div style="display: flex; align-items: flex-start; gap: 16px; margin-bottom: 20px; ${isRtl ? 'flex-direction: row-reverse; text-align: right;' : ''}">
      ${getBulletShapeHtml(bulletDotShape, index, bulletDotColor, bulletDotSize)}
      <div style="font-size: 24px; line-height: 1.6; color: ${bulletColor}; flex: 1;">${b}</div>
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
  
  // Image fit mapping - respect the UI's imageFit setting
  const getImageFit = () => {
    switch (slide.imageFit) {
      case 'crop': return 'cover';
      case 'fit': return 'contain';
      case 'fill': return 'fill';
      default: return 'cover';
    }
  };
  
  const imgSize = getImageSize();
  const imgFit = getImageFit();

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
        <div style="width: ${imgSize.width}; display: flex; align-items: center; justify-content: center;">
          <img src="${slide.imageUrl}" style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.3);" crossorigin="anonymous" />
        </div>
        
        <!-- Text Column (RIGHT) -->
        <div style="flex: 1; display: flex; flex-direction: column; ${isRtl ? 'text-align: right;' : ''}">
          <h1 style="font-size: 52px; font-weight: bold; color: ${titleColor}; margin: 0 0 20px 0; line-height: 1.2;">${processedTitle}</h1>
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
        <h1 style="font-size: 44px; font-weight: bold; color: ${titleColor}; margin: 0; line-height: 1.2; ${isRtl ? 'text-align: right;' : ''}">${processedTitle}</h1>
        <div style="display: flex; gap: 10px; ${isRtl ? 'flex-direction: row-reverse;' : ''}">
          <div style="width: 12px; height: 12px; border-radius: 50%; background: ${accentColor};"></div>
          <div style="width: 12px; height: 12px; border-radius: 50%; background: ${accentColor};"></div>
          <div style="width: 12px; height: 12px; border-radius: 50%; background: ${accentColor};"></div>
        </div>
        
        <!-- Image (TOP) - Takes all remaining space -->
        <div style="width: 100%; flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 20px; min-height: 200px;">
          <img src="${slide.imageUrl}" style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.3);" crossorigin="anonymous" />
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
        <h1 style="font-size: 44px; font-weight: bold; color: ${titleColor}; margin: 0; line-height: 1.2; ${isRtl ? 'text-align: right;' : ''}">${processedTitle}</h1>
        <div style="display: flex; gap: 10px; ${isRtl ? 'flex-direction: row-reverse;' : ''}">
          <div style="width: 12px; height: 12px; border-radius: 50%; background: ${accentColor};"></div>
          <div style="width: 12px; height: 12px; border-radius: 50%; background: ${accentColor};"></div>
          <div style="width: 12px; height: 12px; border-radius: 50%; background: ${accentColor};"></div>
        </div>
        
        <!-- Bullets (TOP) - Auto-size based on content -->
        <div style="flex: 0 0 auto;">
          ${bulletHtml}
        </div>
        
        <!-- Image (BOTTOM) - Takes all remaining space -->
        <div style="width: 100%; flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 20px; min-height: 200px;">
          <img src="${slide.imageUrl}" style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.3);" crossorigin="anonymous" />
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
          <h1 style="font-size: 52px; font-weight: bold; color: ${titleColor}; margin: 0 0 20px 0; line-height: 1.2;">${processedTitle}</h1>
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
        <div style="width: ${imgSize.width}; display: flex; align-items: center; justify-content: center;">
          <img src="${slide.imageUrl}" style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.3);" crossorigin="anonymous" />
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
  const textOnlyBulletHtml = processedBullets.map((b, index) => `
    <div style="display: flex; align-items: flex-start; gap: 20px; margin-bottom: 28px; ${isRtl ? 'flex-direction: row-reverse; text-align: right;' : ''}">
      ${getBulletShapeHtml(bulletDotShape, index, bulletDotColor, bulletDotSize === 'small' ? 'medium' : bulletDotSize)}
      <div style="font-size: 28px; line-height: 1.6; color: ${bulletColor}; flex: 1;">${b}</div>
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
      <h1 style="font-size: 56px; font-weight: bold; color: ${titleColor}; margin: 0 0 20px 0; ${isRtl ? 'text-align: right;' : ''}">${processedTitle}</h1>
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

    // Background - use custom slide background if set
    const bgColor = getSlideBackground(slide, colors);
    pptSlide.background = { color: bgColor.replace('#', '') };

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
