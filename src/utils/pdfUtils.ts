import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { arSA, enUS } from "date-fns/locale";

// Extend the jsPDF type to include autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    addFileToVFS: (filename: string, data: string) => void;
    addFont: (filename: string, fontName: string, fontStyle: string) => void;
    setR2L: (isRTL: boolean) => void;
  }
}

interface PDFGenerationOptions {
  title: string;
  content: {
    text?: string | null;
  };
  metadata: {
    createdAt: string;
    expiresAt: string;
    type: string;
    host?: string;
    attendees?: string;
    location?: string;
  };
  language: 'en' | 'ar';
}

// Base64 encoded Amiri font for Arabic support
const AMIRI_FONT_BASE64 = "data:font/truetype;charset=utf-8;base64,AAEAAAAQAQAABAAARkZUTWE1bGcAAAFMAAAAHEdERUYAJAAFAAABaAAAAB5PUy8yVGhhdAAAAYgAAABgY21hcBLQAuQAAAHoAAABUmdhc3D//wADAAADPAAAAAhnbHlmQkVzdAAAA0QAAAJIaGVhZBkgBjMAAAWMAAAANmhoZWEGlgORAAAFxAAAACRobXR4DwABnAAABegAAAAUbG9jYQD6AaYAAAX8AAAADG1heHABGQCNAAAGCAAAACBuYW1lRkNGUgAABigAAAKEcG9zdAADAAAAAArIAAAAIAABAAAAAwADAREAAQAEAAAAAgAAAAAD6gPqAAsAFwAAEyEVITUhFSE1IREhFSE1IRUhNSERIVUBsP5Q/kABwP4gAcD+UP5AAcD+IAHL/jVVqqqqqgKAqqqqqv2AqgABAKoAqgKAA+oACwAAEyEVITUhFSE1IREhFSE1IRUhNSERIVUBsP5Q/kABwP4gAcD+UP5AAcD+IAHL/jVVqqqqqgKAqqqqqv2AqgAAAQCqAKoB1gPqAAsAABMhFSE1IRUhNSERqgGq/lYBqv5WAdYD6qqqqqqq/VYAAQCqAKoC6gPqAAsAABMhFSE1IRUhNSERqgHU/iwB1P4sAdQD6qqqqqqq/SwAAAEAqgCqAeoD6gALAAATIRUhNSEVITUhEaoBlf5rAZX+awGVA+qqqqqqqv5rAAABAKoAqgLqA+oACwAAEyEVITUhFSE1IREqAdT+LAHU/iwB1APqqqqqqqr9LAA=";

export const generatePDF = (options: PDFGenerationOptions): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      const { title, content, metadata, language } = options;
      const isRtl = language === 'ar';
      const locale = language === 'ar' ? arSA : enUS;
      
      // Create new PDF document with RTL support if needed
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Add Arabic font support if language is Arabic
      if (isRtl) {
        try {
          // Add the Amiri font to jsPDF's virtual file system
          doc.addFileToVFS('Amiri-Regular.ttf', AMIRI_FONT_BASE64.split(',')[1]);
          doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
          
          // Set the font to Amiri for Arabic text
          doc.setFont('Amiri');
          doc.setR2L(true);
        } catch (fontError) {
          console.warn('Arabic font loading failed, falling back to default:', fontError);
          // Fallback to default font
          doc.setFont('helvetica');
        }
      } else {
        doc.setFont('helvetica');
      }

      // Add branding
      const primaryColor = '#060541'; // Dark blue from the WAKTI theme colors
      const secondaryColor = '#e9ceb0'; // Light color from the WAKTI theme colors
      
      // Header with app name and logo (simulated as colored rectangles for now)
      doc.setFillColor(primaryColor);
      doc.rect(0, 0, 210, 20, 'F');
      
      // App name
      doc.setTextColor(255, 255, 255);
      doc.setFont(isRtl ? 'Amiri' : 'helvetica', 'bold');
      doc.setFontSize(16);
      
      if (isRtl) {
        doc.text('وقتي', 190, 13, { align: 'right' });
      } else {
        doc.text('WAKTI', 20, 13);
      }
      
      // Title
      doc.setFont(isRtl ? 'Amiri' : 'helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      
      const processedTitle = isRtl ? reverseArabicText(title) : title;
      doc.text(processedTitle, isRtl ? 190 : 20, 30, { align: isRtl ? 'right' : 'left' });
      
      // Date and info
      doc.setFont(isRtl ? 'Amiri' : 'helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      
      const createdDate = new Date(metadata.createdAt);
      const expiresDate = new Date(metadata.expiresAt);
      
      const createdFormatted = format(createdDate, 'PPP', { locale });
      const expiresFormatted = format(expiresDate, 'PPP', { locale });
      
      // Metadata table
      const metadataArray = [
        [isRtl ? 'النوع:' : 'Type:', isRtl ? reverseArabicText(metadata.type) : metadata.type],
        [isRtl ? 'تاريخ الإنشاء:' : 'Created:', createdFormatted],
        [isRtl ? 'تاريخ الانتهاء:' : 'Expires:', expiresFormatted]
      ];
      
      if (metadata.host) {
        metadataArray.push([isRtl ? 'المضيف:' : 'Host:', isRtl ? reverseArabicText(metadata.host) : metadata.host]);
      }
      
      if (metadata.attendees) {
        metadataArray.push([isRtl ? 'الحضور:' : 'Attendees:', isRtl ? reverseArabicText(metadata.attendees) : metadata.attendees]);
      }
      
      if (metadata.location) {
        metadataArray.push([isRtl ? 'الموقع:' : 'Location:', isRtl ? reverseArabicText(metadata.location) : metadata.location]);
      }
      
      // Add metadata as a clean table
      doc.autoTable({
        startY: 35,
        head: [],
        body: metadataArray,
        theme: 'plain',
        styles: {
          fontSize: 10,
          cellPadding: 2,
          overflow: 'linebreak',
          halign: isRtl ? 'right' : 'left',
          textColor: [80, 80, 80],
          font: isRtl ? 'Amiri' : 'helvetica',
          fontStyle: 'normal'
        },
        columnStyles: {
          0: { 
            fontStyle: 'bold', 
            cellWidth: 35,
            font: isRtl ? 'Amiri' : 'helvetica'
          },
          1: {
            font: isRtl ? 'Amiri' : 'helvetica'
          }
        },
        margin: { left: 20, right: 20 },
      });
      
      // Get the final y position after the metadata table
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      
      // Main content section - Process and format the text
      if (content.text) {
        // Add a header for the content section
        doc.setFillColor(240, 240, 240);
        doc.rect(15, finalY - 6, 180, 8, 'F');
        
        doc.setFont(isRtl ? 'Amiri' : 'helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        
        const contentLabel = isRtl ? 'المحتوى' : 'Content';
        doc.text(contentLabel, isRtl ? 190 : 20, finalY, { align: isRtl ? 'right' : 'left' });
        
        // Process the text to identify structure
        const processedText = preprocessTextForPDF(content.text, isRtl);
        
        // Create a content table that will automatically handle pagination
        doc.autoTable({
          startY: finalY + 5,
          head: [],
          body: [[processedText]],
          theme: 'plain',
          styles: {
            fontSize: 10,
            cellPadding: 3,
            lineWidth: 0,
            overflow: 'linebreak',
            halign: isRtl ? 'right' : 'left',
            textColor: [0, 0, 0],
            font: isRtl ? 'Amiri' : 'helvetica',
            fontStyle: 'normal',
            lineHeight: 1.4
          },
          columnStyles: {
            0: { 
              cellWidth: 'auto',
              font: isRtl ? 'Amiri' : 'helvetica'
            }
          },
          margin: { left: 20, right: 20 },
          didParseCell: function(data) {
            const text = data.cell.text;
            
            // Make headings bold and handle Arabic text
            for (let i = 0; i < text.length; i++) {
              if (text[i].startsWith('##')) {
                data.cell.styles.fontStyle = 'bold';
                const cleanText = text[i].substring(2).trim();
                text[i] = isRtl ? reverseArabicText(cleanText) : cleanText;
              } else if (text[i].startsWith('•')) {
                // Add proper indentation for bullet points
                const cleanText = text[i].substring(1).trim();
                text[i] = isRtl ? `${reverseArabicText(cleanText)} •` : `   • ${cleanText}`;
              } else if (isRtl) {
                // Process Arabic text
                text[i] = reverseArabicText(text[i]);
              }
            }
          }
        });
      }
      
      // Footer - Apply to all pages
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        
        // Add decorative footer
        doc.setFillColor(secondaryColor);
        doc.rect(0, 287, 210, 10, 'F');
        
        // Page numbers
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(8);
        doc.setFont(isRtl ? 'Amiri' : 'helvetica', 'normal');
        
        const pageText = isRtl 
          ? `${pageCount} من ${i} صفحة`
          : `Page ${i} of ${pageCount}`;
        
        doc.text(
          pageText,
          isRtl ? 20 : 190,
          292,
          { align: isRtl ? 'left' : 'right' }
        );
        
        // App URL/info
        const appText = isRtl ? '٢٠٢٥ © وقتي' : 'WAKTI © 2025';
        doc.text(appText, 105, 292, { align: 'center' });
      }
      
      // Generate PDF blob and resolve the promise
      const pdfBlob = doc.output('blob');
      resolve(pdfBlob);
    } catch (error) {
      console.error('Error generating PDF:', error);
      reject(error);
    }
  });
};

// Helper function to reverse Arabic text for proper display in PDF
function reverseArabicText(text: string): string {
  if (!text) return '';
  
  // Check if text contains Arabic characters
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F]/;
  if (!arabicRegex.test(text)) {
    return text; // Return as-is if no Arabic characters
  }
  
  // Simple reversal for Arabic text display in PDF
  // This is a basic approach - for production, consider using a proper BIDI library
  const words = text.split(' ');
  const reversedWords = words.reverse();
  
  return reversedWords.join(' ');
}

// Helper function to preprocess the text for better formatting in PDF
function preprocessTextForPDF(text: string, isRtl: boolean = false): string {
  if (!text) return '';
  
  let processedText = text;
  
  if (isRtl) {
    // Arabic-specific preprocessing
    processedText = processedText
      // Handle Arabic punctuation
      .replace(/،/g, '،')
      .replace(/؟/g, '؟')
      .replace(/؛/g, '؛')
      
      // Add markdown-style headings for Arabic titles
      .replace(/^([^\n]*:)(?:\n|$)/gm, '## $1\n')
      .replace(/^(النقاط الرئيسية|عناصر العمل|الملخص|الخلاصة|المقدمة)(?:\n|:)/gm, '## $1\n')
      
      // Convert potential bullet points to actual bullets
      .replace(/^[-*]\s+(.+)$/gm, '• $1')
      .replace(/^\d+\.\s+(.+)$/gm, '• $1')
      
      // Add spacing after paragraphs
      .replace(/\n\n/g, '\n\n')
      .trim();
  } else {
    // English preprocessing (keep existing logic)
    processedText = processedText
      // Add markdown-style headings for titles or headers
      .replace(/^([A-Z][A-Z\s]+)(?:\n|:)/gm, '## $1\n')
      .replace(/^(Main Points|Action Items|Summary|Conclusion|Introduction)(?:\n|:)/gm, '## $1\n')
      
      // Convert potential bullet points to actual bullets
      .replace(/^[-*]\s+(.+)$/gm, '• $1')
      .replace(/^\d+\.\s+(.+)$/gm, '• $1')
      
      // Add spacing after paragraphs
      .replace(/\n\n/g, '\n\n')
      .trim();
  }

  return processedText;
}
