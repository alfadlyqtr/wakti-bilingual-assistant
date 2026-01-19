import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PDFRequest {
  translatedText: string;
  title: string;
  subtitle: string;
  targetLanguage: string;
  sourceFilename?: string;
}

// Arabic letter forms for text shaping
// Each Arabic letter has 4 forms: isolated, initial, medial, final
const ARABIC_LETTERS: Record<string, { isolated: string; initial: string; medial: string; final: string }> = {
  'ا': { isolated: 'ا', initial: 'ا', medial: 'ـا', final: 'ـا' },
  'أ': { isolated: 'أ', initial: 'أ', medial: 'ـأ', final: 'ـأ' },
  'إ': { isolated: 'إ', initial: 'إ', medial: 'ـإ', final: 'ـإ' },
  'آ': { isolated: 'آ', initial: 'آ', medial: 'ـآ', final: 'ـآ' },
  'ب': { isolated: 'ب', initial: 'بـ', medial: 'ـبـ', final: 'ـب' },
  'ت': { isolated: 'ت', initial: 'تـ', medial: 'ـتـ', final: 'ـت' },
  'ث': { isolated: 'ث', initial: 'ثـ', medial: 'ـثـ', final: 'ـث' },
  'ج': { isolated: 'ج', initial: 'جـ', medial: 'ـجـ', final: 'ـج' },
  'ح': { isolated: 'ح', initial: 'حـ', medial: 'ـحـ', final: 'ـح' },
  'خ': { isolated: 'خ', initial: 'خـ', medial: 'ـخـ', final: 'ـخ' },
  'د': { isolated: 'د', initial: 'د', medial: 'ـد', final: 'ـد' },
  'ذ': { isolated: 'ذ', initial: 'ذ', medial: 'ـذ', final: 'ـذ' },
  'ر': { isolated: 'ر', initial: 'ر', medial: 'ـر', final: 'ـر' },
  'ز': { isolated: 'ز', initial: 'ز', medial: 'ـز', final: 'ـز' },
  'س': { isolated: 'س', initial: 'سـ', medial: 'ـسـ', final: 'ـس' },
  'ش': { isolated: 'ش', initial: 'شـ', medial: 'ـشـ', final: 'ـش' },
  'ص': { isolated: 'ص', initial: 'صـ', medial: 'ـصـ', final: 'ـص' },
  'ض': { isolated: 'ض', initial: 'ضـ', medial: 'ـضـ', final: 'ـض' },
  'ط': { isolated: 'ط', initial: 'طـ', medial: 'ـطـ', final: 'ـط' },
  'ظ': { isolated: 'ظ', initial: 'ظـ', medial: 'ـظـ', final: 'ـظ' },
  'ع': { isolated: 'ع', initial: 'عـ', medial: 'ـعـ', final: 'ـع' },
  'غ': { isolated: 'غ', initial: 'غـ', medial: 'ـغـ', final: 'ـغ' },
  'ف': { isolated: 'ف', initial: 'فـ', medial: 'ـفـ', final: 'ـف' },
  'ق': { isolated: 'ق', initial: 'قـ', medial: 'ـقـ', final: 'ـق' },
  'ك': { isolated: 'ك', initial: 'كـ', medial: 'ـكـ', final: 'ـك' },
  'ل': { isolated: 'ل', initial: 'لـ', medial: 'ـلـ', final: 'ـل' },
  'م': { isolated: 'م', initial: 'مـ', medial: 'ـمـ', final: 'ـم' },
  'ن': { isolated: 'ن', initial: 'نـ', medial: 'ـنـ', final: 'ـن' },
  'ه': { isolated: 'ه', initial: 'هـ', medial: 'ـهـ', final: 'ـه' },
  'و': { isolated: 'و', initial: 'و', medial: 'ـو', final: 'ـو' },
  'ي': { isolated: 'ي', initial: 'يـ', medial: 'ـيـ', final: 'ـي' },
  'ى': { isolated: 'ى', initial: 'ى', medial: 'ـى', final: 'ـى' },
  'ة': { isolated: 'ة', initial: 'ة', medial: 'ـة', final: 'ـة' },
  'ء': { isolated: 'ء', initial: 'ء', medial: 'ء', final: 'ء' },
  'ئ': { isolated: 'ئ', initial: 'ئـ', medial: 'ـئـ', final: 'ـئ' },
  'ؤ': { isolated: 'ؤ', initial: 'ؤ', medial: 'ـؤ', final: 'ـؤ' },
};

// Letters that don't connect to the next letter
const NON_CONNECTING = new Set(['ا', 'أ', 'إ', 'آ', 'د', 'ذ', 'ر', 'ز', 'و', 'ؤ', 'ة', 'ى']);

// Amiri font for Arabic - loaded from CDN
const AMIRI_FONT_URL = "https://cdn.jsdelivr.net/npm/@fontsource/amiri@5.0.8/files/amiri-arabic-400-normal.woff";

// Reshape Arabic text for proper display
function reshapeArabic(text: string): string {
  const result: string[] = [];
  const chars = [...text];
  
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const letterForms = ARABIC_LETTERS[char];
    
    if (!letterForms) {
      // Not an Arabic letter, keep as-is
      result.push(char);
      continue;
    }
    
    const prevChar = i > 0 ? chars[i - 1] : null;
    const nextChar = i < chars.length - 1 ? chars[i + 1] : null;
    
    const prevIsArabic = prevChar && ARABIC_LETTERS[prevChar];
    const nextIsArabic = nextChar && ARABIC_LETTERS[nextChar];
    const prevConnects = prevIsArabic && !NON_CONNECTING.has(prevChar!);
    
    let form: string;
    
    if (!prevConnects && !nextIsArabic) {
      // Isolated
      form = letterForms.isolated;
    } else if (!prevConnects && nextIsArabic) {
      // Initial
      form = letterForms.initial;
    } else if (prevConnects && nextIsArabic) {
      // Medial
      form = letterForms.medial;
    } else {
      // Final
      form = letterForms.final;
    }
    
    result.push(form);
  }
  
  // Reverse for RTL display in PDF (since PDF renders LTR)
  return result.reverse().join('');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("📄 Generate Translation PDF: Request received");

    const body: PDFRequest = await req.json();
    const { translatedText, title, subtitle, targetLanguage } = body;

    if (!translatedText) {
      throw new Error("No translated text provided");
    }

    const isRtl = ['ar', 'he', 'fa', 'ur'].includes(targetLanguage);
    
    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    
    // For Arabic text, we need to use a font that supports Arabic glyphs
    // Since pdf-lib doesn't support complex text shaping natively,
    // we'll embed the text as Unicode and hope the PDF viewer handles it
    let font;
    
    if (isRtl) {
      // Try to load Arabic font
      try {
        const fontResponse = await fetch(AMIRI_FONT_URL);
        if (fontResponse.ok) {
          const fontBytes = await fontResponse.arrayBuffer();
          font = await pdfDoc.embedFont(fontBytes);
          console.log("✅ Arabic font loaded successfully");
        } else {
          throw new Error("Font fetch failed");
        }
      } catch (fontError) {
        console.warn("⚠️ Could not load Arabic font, using fallback:", fontError);
        font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      }
    } else {
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }
    
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Page dimensions (A4)
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 50;
    const lineHeight = 18;
    const fontSize = 12;
    const titleFontSize = 18;
    
    // Create first page
    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPos = pageHeight - margin;
    
    // Header bar
    page.drawRectangle({
      x: 0,
      y: pageHeight - 40,
      width: pageWidth,
      height: 40,
      color: rgb(6/255, 5/255, 65/255), // #060541
    });
    
    // WAKTI text in header
    page.drawText('WAKTI', {
      x: 20,
      y: pageHeight - 28,
      size: 16,
      font: boldFont,
      color: rgb(1, 1, 1),
    });
    
    yPos = pageHeight - 70;
    
    // Title
    page.drawText(isRtl ? reshapeArabic(title) : title, {
      x: isRtl ? pageWidth - margin - boldFont.widthOfTextAtSize(title, titleFontSize) : margin,
      y: yPos,
      size: titleFontSize,
      font: boldFont,
      color: rgb(6/255, 5/255, 65/255),
    });
    
    yPos -= 25;
    
    // Subtitle
    page.drawText(isRtl ? reshapeArabic(subtitle) : subtitle, {
      x: isRtl ? pageWidth - margin - font.widthOfTextAtSize(subtitle, 11) : margin,
      y: yPos,
      size: 11,
      font: font,
      color: rgb(100/255, 116/255, 139/255),
    });
    
    yPos -= 20;
    
    // Divider line
    page.drawLine({
      start: { x: margin, y: yPos },
      end: { x: pageWidth - margin, y: yPos },
      thickness: 1,
      color: rgb(226/255, 232/255, 240/255),
    });
    
    yPos -= 25;
    
    // Body text
    const lines = translatedText.split('\n');
    const contentWidth = pageWidth - margin * 2;
    const maxCharsPerLine = Math.floor(contentWidth / (fontSize * 0.5));
    
    for (const line of lines) {
      if (!line.trim()) {
        yPos -= lineHeight / 2;
        continue;
      }
      
      // Word wrap
      const words = line.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        
        if (testLine.length > maxCharsPerLine && currentLine) {
          // Check if we need a new page
          if (yPos < margin + 30) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            yPos = pageHeight - margin;
          }
          
          const textToDraw = isRtl ? reshapeArabic(currentLine) : currentLine;
          const textWidth = font.widthOfTextAtSize(textToDraw, fontSize);
          
          page.drawText(textToDraw, {
            x: isRtl ? pageWidth - margin - textWidth : margin,
            y: yPos,
            size: fontSize,
            font: font,
            color: rgb(15/255, 23/255, 42/255),
          });
          
          yPos -= lineHeight;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      
      // Draw remaining text
      if (currentLine) {
        if (yPos < margin + 30) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          yPos = pageHeight - margin;
        }
        
        const textToDraw = isRtl ? reshapeArabic(currentLine) : currentLine;
        const textWidth = font.widthOfTextAtSize(textToDraw, fontSize);
        
        page.drawText(textToDraw, {
          x: isRtl ? pageWidth - margin - textWidth : margin,
          y: yPos,
          size: fontSize,
          font: font,
          color: rgb(15/255, 23/255, 42/255),
        });
        
        yPos -= lineHeight;
      }
    }
    
    // Footer on all pages
    const pages = pdfDoc.getPages();
    for (const p of pages) {
      p.drawText('WAKTI © 2025', {
        x: pageWidth / 2 - 30,
        y: 20,
        size: 9,
        font: font,
        color: rgb(148/255, 163/255, 184/255),
      });
    }
    
    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

    console.log("✅ PDF generated successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        pdfBase64,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const err = error as Error;
    console.error("❌ Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
