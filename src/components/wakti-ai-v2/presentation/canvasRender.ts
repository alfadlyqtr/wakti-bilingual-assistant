import { getThemeAccentHex, getThemeBackgroundColors } from './themeHelpers';
import type { Slide } from './types';

/**
 * Parse gradient string for canvas rendering
 */
export function parseGradientForCanvas(value: string): { color1: string; color2: string; angle: number } | null {
  if (!value.startsWith('gradient:')) return null;
  const parts = value.replace('gradient:', '').split(',');
  if (parts.length < 2) return null;
  const color1 = parts[0] || '#000000';
  const color2 = parts[1] || '#ffffff';
  // Parse angle from x,y or direct angle
  let angle = 135;
  if (parts.length >= 4) {
    const x = parseInt(parts[2] || '0', 10);
    const y = parseInt(parts[3] || '0', 10);
    angle = (Math.round(Math.atan2(-y, x) * 180 / Math.PI) + 360) % 360;
  } else if (parts.length >= 3) {
    angle = parseInt(parts[2] || '135', 10);
  }
  return { color1, color2, angle };
}

/**
 * Render a slide to canvas for video export - matches actual UI appearance
 */
export async function renderSlideToCanvasAsync(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  width: number,
  height: number,
  theme: string,
  loadedImages: Map<string, HTMLImageElement>
): Promise<void> {
  // Step 1: Draw background
  if (slide.slideBg) {
    // Custom slide background
    const gradient = parseGradientForCanvas(slide.slideBg);
    if (gradient) {
      // Calculate gradient endpoints based on angle
      const angleRad = (gradient.angle * Math.PI) / 180;
      const x1 = width / 2 - Math.cos(angleRad) * width;
      const y1 = height / 2 + Math.sin(angleRad) * height;
      const x2 = width / 2 + Math.cos(angleRad) * width;
      const y2 = height / 2 - Math.sin(angleRad) * height;
      const canvasGradient = ctx.createLinearGradient(x1, y1, x2, y2);
      canvasGradient.addColorStop(0, gradient.color1);
      canvasGradient.addColorStop(1, gradient.color2);
      ctx.fillStyle = canvasGradient;
      ctx.fillRect(0, 0, width, height);
    } else {
      // Solid color
      ctx.fillStyle = slide.slideBg;
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    // Theme-based gradient background
    const colors = getThemeBackgroundColors(theme);
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, colors.from);
    bgGradient.addColorStop(1, colors.to);
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);
    
    // Add subtle overlay
    if (colors.overlay) {
      ctx.fillStyle = colors.overlay;
      ctx.fillRect(0, 0, width, height);
    }
  }

  // Step 2: Determine layout and draw content
  const padding = 80;
  const hasImage = slide.imageUrl && loadedImages.has(slide.imageUrl);
  const image = hasImage ? loadedImages.get(slide.imageUrl!) : null;
  const isCoverOrThankYou = slide.role === 'cover' || slide.role === 'thank_you';
  const accentColor = getThemeAccentHex(theme);
  
  // Title styling
  const titleColor = slide.titleStyle?.color || '#ffffff';
  const titleSize = slide.titleStyle?.fontSize === 'small' ? 56 : slide.titleStyle?.fontSize === 'large' ? 96 : 72;
  const titleWeight = slide.titleStyle?.fontWeight === 'normal' ? 'normal' : 'bold';
  
  // Subtitle styling
  const subtitleColor = slide.subtitleStyle?.color || '#94a3b8';
  const subtitleSize = slide.subtitleStyle?.fontSize === 'small' ? 32 : slide.subtitleStyle?.fontSize === 'large' ? 56 : 44;
  
  // Bullet styling
  const bulletColor = slide.bulletStyle?.color || '#e2e8f0';
  const bulletSize = slide.bulletStyle?.fontSize === 'small' ? 28 : slide.bulletStyle?.fontSize === 'large' ? 44 : 36;
  const bulletDotColor = slide.bulletDotColor || accentColor;

  if (isCoverOrThankYou && !hasImage) {
    // Centered layout for cover/thank you without image
    ctx.textAlign = 'center';
    
    // Title
    ctx.fillStyle = titleColor;
    ctx.font = `${titleWeight} ${titleSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(slide.title || '', width / 2, height / 2 - 40, width - padding * 2);
    
    // Subtitle
    if (slide.subtitle) {
      ctx.fillStyle = subtitleColor;
      ctx.font = `${subtitleSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(slide.subtitle, width / 2, height / 2 + 40, width - padding * 2);
    }
    
    // Accent line
    ctx.fillStyle = accentColor;
    ctx.fillRect(width / 2 - 60, height / 2 + 80, 120, 4);
    
  } else if (hasImage && image) {
    // Layout with image
    const layout = slide.layoutVariant || 'text_left';
    const imgSizeRatio = slide.imageSize === 'small' ? 0.33 : slide.imageSize === 'large' ? 0.6 : 0.45;
    
    if (layout === 'image_left') {
      // Image on left, text on right
      const imgWidth = (width - padding * 3) * imgSizeRatio;
      const imgHeight = height - padding * 2;
      const imgX = padding;
      const imgY = padding;
      
      // Draw image with rounded corners simulation
      ctx.save();
      ctx.fillStyle = 'rgba(51, 65, 85, 0.5)';
      ctx.fillRect(imgX, imgY, imgWidth, imgHeight);
      ctx.drawImage(image, imgX, imgY, imgWidth, imgHeight);
      ctx.restore();
      
      // Text on right
      const textX = imgX + imgWidth + padding;
      const textWidth = width - textX - padding;
      ctx.textAlign = 'left';
      
      ctx.fillStyle = titleColor;
      ctx.font = `${titleWeight} ${titleSize * 0.9}px system-ui, -apple-system, sans-serif`;
      wrapText(ctx, slide.title || '', textX, height / 2 - 60, textWidth, titleSize);
      
      if (slide.subtitle) {
        ctx.fillStyle = subtitleColor;
        ctx.font = `${subtitleSize * 0.9}px system-ui, -apple-system, sans-serif`;
        ctx.fillText(slide.subtitle, textX, height / 2 + 20, textWidth);
      }
      
      // Accent line
      ctx.fillStyle = accentColor;
      ctx.fillRect(textX, height / 2 + 60, 80, 4);
      
    } else if (layout === 'image_top') {
      // Image on top, text below
      const imgHeight = (height - padding * 3) * imgSizeRatio;
      const imgWidth = width - padding * 2;
      
      ctx.drawImage(image, padding, padding, imgWidth, imgHeight);
      
      const textY = padding + imgHeight + padding;
      ctx.textAlign = 'center';
      
      ctx.fillStyle = titleColor;
      ctx.font = `${titleWeight} ${titleSize * 0.85}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(slide.title || '', width / 2, textY + 60, width - padding * 2);
      
      if (slide.subtitle) {
        ctx.fillStyle = subtitleColor;
        ctx.font = `${subtitleSize * 0.85}px system-ui, -apple-system, sans-serif`;
        ctx.fillText(slide.subtitle, width / 2, textY + 120, width - padding * 2);
      }
      
    } else if (layout === 'image_bottom') {
      // Text on top, image below
      ctx.textAlign = 'center';
      
      ctx.fillStyle = titleColor;
      ctx.font = `${titleWeight} ${titleSize * 0.85}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(slide.title || '', width / 2, padding + 80, width - padding * 2);
      
      if (slide.subtitle) {
        ctx.fillStyle = subtitleColor;
        ctx.font = `${subtitleSize * 0.85}px system-ui, -apple-system, sans-serif`;
        ctx.fillText(slide.subtitle, width / 2, padding + 140, width - padding * 2);
      }
      
      const imgHeight = (height - padding * 3) * imgSizeRatio;
      const imgY = height - padding - imgHeight;
      ctx.drawImage(image, padding, imgY, width - padding * 2, imgHeight);
      
    } else {
      // Default: text_left (image on right)
      const imgWidth = (width - padding * 3) * imgSizeRatio;
      const imgHeight = height - padding * 2;
      const imgX = width - padding - imgWidth;
      
      ctx.drawImage(image, imgX, padding, imgWidth, imgHeight);
      
      // Text on left
      const textWidth = imgX - padding * 2;
      ctx.textAlign = 'left';
      
      ctx.fillStyle = titleColor;
      ctx.font = `${titleWeight} ${titleSize * 0.9}px system-ui, -apple-system, sans-serif`;
      wrapText(ctx, slide.title || '', padding, height / 2 - 60, textWidth, titleSize);
      
      if (slide.subtitle) {
        ctx.fillStyle = subtitleColor;
        ctx.font = `${subtitleSize * 0.9}px system-ui, -apple-system, sans-serif`;
        ctx.fillText(slide.subtitle, padding, height / 2 + 20, textWidth);
      }
      
      // Accent line
      ctx.fillStyle = accentColor;
      ctx.fillRect(padding, height / 2 + 60, 80, 4);
    }
    
  } else {
    // Content slide without image (title + bullets)
    ctx.textAlign = 'left';
    
    // Title at top
    ctx.fillStyle = titleColor;
    ctx.font = `${titleWeight} ${titleSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(slide.title || '', padding, padding + titleSize, width - padding * 2);
    
    // Subtitle
    let contentY = padding + titleSize + 40;
    if (slide.subtitle) {
      ctx.fillStyle = subtitleColor;
      ctx.font = `${subtitleSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(slide.subtitle, padding, contentY + subtitleSize, width - padding * 2);
      contentY += subtitleSize + 40;
    }
    
    // Bullets
    if (slide.bullets && slide.bullets.length > 0) {
      ctx.font = `${bulletSize}px system-ui, -apple-system, sans-serif`;
      const lineHeight = bulletSize + 24;
      
      slide.bullets.forEach((bullet, i) => {
        if (bullet.trim()) {
          const y = contentY + 60 + i * lineHeight;
          
          // Draw bullet dot
          ctx.fillStyle = bulletDotColor;
          ctx.beginPath();
          ctx.arc(padding + 12, y - bulletSize / 3, 6, 0, Math.PI * 2);
          ctx.fill();
          
          // Draw bullet text
          ctx.fillStyle = bulletColor;
          ctx.fillText(bullet, padding + 40, y, width - padding * 2 - 40);
        }
      });
    }
  }
}

/**
 * Helper to wrap text on canvas
 */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  
  for (const word of words) {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line !== '') {
      ctx.fillText(line.trim(), x, currentY);
      line = word + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
}

/**
 * Synchronous wrapper for backward compatibility
 */
export function renderSlideToCanvas(
  ctx: CanvasRenderingContext2D,
  slide: { title: string; subtitle?: string; bullets: string[]; slideBg?: string; imageUrl?: string; role?: string; layoutVariant?: string; imageSize?: string; titleStyle?: { color?: string; fontSize?: string; fontWeight?: string }; subtitleStyle?: { color?: string; fontSize?: string }; bulletStyle?: { color?: string; fontSize?: string }; bulletDotColor?: string },
  width: number,
  height: number,
  theme: string
): void {
  // Simplified sync version - just renders without images
  // For full rendering with images, use renderSlideToCanvasAsync
  
  // Draw background
  if (slide.slideBg) {
    const gradient = parseGradientForCanvas(slide.slideBg);
    if (gradient) {
      const angleRad = (gradient.angle * Math.PI) / 180;
      const x1 = width / 2 - Math.cos(angleRad) * width;
      const y1 = height / 2 + Math.sin(angleRad) * height;
      const x2 = width / 2 + Math.cos(angleRad) * width;
      const y2 = height / 2 - Math.sin(angleRad) * height;
      const canvasGradient = ctx.createLinearGradient(x1, y1, x2, y2);
      canvasGradient.addColorStop(0, gradient.color1);
      canvasGradient.addColorStop(1, gradient.color2);
      ctx.fillStyle = canvasGradient;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = slide.slideBg;
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    const colors = getThemeBackgroundColors(theme);
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, colors.from);
    bgGradient.addColorStop(1, colors.to);
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);
    if (colors.overlay) {
      ctx.fillStyle = colors.overlay;
      ctx.fillRect(0, 0, width, height);
    }
  }

  const padding = 80;
  const accentColor = getThemeAccentHex(theme);
  const titleColor = slide.titleStyle?.color || '#ffffff';
  const titleSize = slide.titleStyle?.fontSize === 'small' ? 56 : slide.titleStyle?.fontSize === 'large' ? 96 : 72;
  const titleWeight = slide.titleStyle?.fontWeight === 'normal' ? 'normal' : 'bold';
  const subtitleColor = slide.subtitleStyle?.color || '#94a3b8';
  const subtitleSize = slide.subtitleStyle?.fontSize === 'small' ? 32 : slide.subtitleStyle?.fontSize === 'large' ? 56 : 44;
  const bulletColor = slide.bulletStyle?.color || '#e2e8f0';
  const bulletSize = slide.bulletStyle?.fontSize === 'small' ? 28 : slide.bulletStyle?.fontSize === 'large' ? 44 : 36;
  const bulletDotColor = slide.bulletDotColor || accentColor;

  const isCoverOrThankYou = slide.role === 'cover' || slide.role === 'thank_you';

  if (isCoverOrThankYou) {
    // Centered layout
    ctx.textAlign = 'center';
    ctx.fillStyle = titleColor;
    ctx.font = `${titleWeight} ${titleSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(slide.title || '', width / 2, height / 2 - 40, width - padding * 2);
    
    if (slide.subtitle) {
      ctx.fillStyle = subtitleColor;
      ctx.font = `${subtitleSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(slide.subtitle, width / 2, height / 2 + 40, width - padding * 2);
    }
    
    ctx.fillStyle = accentColor;
    ctx.fillRect(width / 2 - 60, height / 2 + 80, 120, 4);
  } else {
    // Content slide
    ctx.textAlign = 'left';
    ctx.fillStyle = titleColor;
    ctx.font = `${titleWeight} ${titleSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(slide.title || '', padding, padding + titleSize, width - padding * 2);
    
    let contentY = padding + titleSize + 40;
    if (slide.subtitle) {
      ctx.fillStyle = subtitleColor;
      ctx.font = `${subtitleSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(slide.subtitle, padding, contentY + subtitleSize, width - padding * 2);
      contentY += subtitleSize + 40;
    }
    
    if (slide.bullets && slide.bullets.length > 0) {
      ctx.font = `${bulletSize}px system-ui, -apple-system, sans-serif`;
      const lineHeight = bulletSize + 24;
      
      slide.bullets.forEach((bullet, i) => {
        if (bullet.trim()) {
          const y = contentY + 60 + i * lineHeight;
          ctx.fillStyle = bulletDotColor;
          ctx.beginPath();
          ctx.arc(padding + 12, y - bulletSize / 3, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = bulletColor;
          ctx.fillText(bullet, padding + 40, y, width - padding * 2 - 40);
        }
      });
    }
  }
}
