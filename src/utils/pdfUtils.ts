
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { arSA, enUS } from "date-fns/locale";

// Extend the jsPDF type to include autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
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

// Simple Arabic font base64 (Noto Sans Arabic subset)
const ARABIC_FONT_BASE64 = "data:font/truetype;charset=utf-8;base64,AAEAAAAOAIAAAwBwRkZUTWNtYXAAALDAAAABaGdseWYAALDIAAAFSGhlYWQAALwQAAAANmhoZWEAALxIAAAAJGhtdHgAALxsAAAAUGxvY2EAAL28AAAAKm1heHAAAL3oAAAAIARuYW1lAAL+CAAAA2Vwb3N0AAICDAAAAA==";

export const generatePDF = (options: PDFGenerationOptions): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      const { title, content, metadata, language } = options;
      const isRtl = language === 'ar';
      const locale = language === 'ar' ? arSA : enUS;
      
      console.log('Generating PDF for language:', language, 'isRTL:', isRtl);
      
      // Create new PDF document
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // For Arabic, try to add Arabic font support
      if (isRtl) {
        try {
          // Add Arabic font using browser's built-in Arabic support
          doc.addFont('NotoSansArabic', 'NotoSansArabic', 'normal');
          doc.setFont('NotoSansArabic');
          console.log('Arabic font loaded successfully');
        } catch (fontError) {
          console.warn('Arabic font loading failed, using helvetica:', fontError);
          doc.setFont('helvetica');
        }
      } else {
        doc.setFont('helvetica');
      }
      
      console.log('PDF document created, setting up layout...');

      // Add branding
      const primaryColor = '#060541';
      const secondaryColor = '#e9ceb0';
      
      // Header with app name
      doc.setFillColor(primaryColor);
      doc.rect(0, 0, 210, 20, 'F');
      
      // App name
      doc.setTextColor(255, 255, 255);
      doc.setFont(isRtl ? 'NotoSansArabic' : 'helvetica', 'bold');
      doc.setFontSize(16);
      
      if (isRtl) {
        doc.text('WAKTI - وقتي', 190, 13, { align: 'right' });
      } else {
        doc.text('WAKTI', 20, 13);
      }
      
      // Title - use the exact text without processing
      doc.setFont(isRtl ? 'NotoSansArabic' : 'helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      
      // For Arabic titles, preserve the exact Unicode text
      doc.text(title, isRtl ? 190 : 20, 30, { 
        align: isRtl ? 'right' : 'left',
        maxWidth: 170
      });
      
      // Date and info
      doc.setFont(isRtl ? 'NotoSansArabic' : 'helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      
      const createdDate = new Date(metadata.createdAt);
      const expiresDate = new Date(metadata.expiresAt);
      
      const createdFormatted = format(createdDate, 'PPP', { locale });
      const expiresFormatted = format(expiresDate, 'PPP', { locale });
      
      // Metadata table with exact Arabic text
      const metadataArray = [
        [isRtl ? 'النوع:' : 'Type:', metadata.type],
        [isRtl ? 'تاريخ الإنشاء:' : 'Created:', createdFormatted],
        [isRtl ? 'تاريخ الانتهاء:' : 'Expires:', expiresFormatted]
      ];
      
      if (metadata.host) {
        metadataArray.push([isRtl ? 'المضيف:' : 'Host:', metadata.host]);
      }
      
      if (metadata.attendees) {
        metadataArray.push([isRtl ? 'الحضور:' : 'Attendees:', metadata.attendees]);
      }
      
      if (metadata.location) {
        metadataArray.push([isRtl ? 'الموقع:' : 'Location:', metadata.location]);
      }
      
      console.log('Adding metadata table...');
      
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
          font: isRtl ? 'NotoSansArabic' : 'helvetica',
          fontStyle: 'normal'
        },
        columnStyles: {
          0: { 
            fontStyle: 'bold', 
            cellWidth: 35,
            font: isRtl ? 'NotoSansArabic' : 'helvetica'
          },
          1: {
            font: isRtl ? 'NotoSansArabic' : 'helvetica'
          }
        },
        margin: { left: 20, right: 20 },
      });
      
      // Get the final y position after the metadata table
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      
      console.log('Adding content section at Y position:', finalY);
      
      // Main content section
      if (content.text) {
        // Add a header for the content section
        doc.setFillColor(240, 240, 240);
        doc.rect(15, finalY - 6, 180, 8, 'F');
        
        doc.setFont(isRtl ? 'NotoSansArabic' : 'helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        
        const contentLabel = isRtl ? 'المحتوى' : 'Content';
        doc.text(contentLabel, isRtl ? 190 : 20, finalY, { align: isRtl ? 'right' : 'left' });
        
        // Use the exact text without any processing
        const exactText = content.text;
        
        console.log('Using exact text from app:', exactText.length, 'characters');
        
        // Create a content table with the exact text
        doc.autoTable({
          startY: finalY + 5,
          head: [],
          body: [[exactText]],
          theme: 'plain',
          styles: {
            fontSize: 10,
            cellPadding: 3,
            lineWidth: 0,
            overflow: 'linebreak',
            halign: isRtl ? 'right' : 'left',
            textColor: [0, 0, 0],
            font: isRtl ? 'NotoSansArabic' : 'helvetica',
            fontStyle: 'normal',
            lineHeight: 1.4
          },
          columnStyles: {
            0: { 
              cellWidth: 'auto',
              font: isRtl ? 'NotoSansArabic' : 'helvetica'
            }
          },
          margin: { left: 20, right: 20 },
          didParseCell: function(data) {
            // Don't process the text, just set the font
            if (isRtl) {
              data.cell.styles.font = 'NotoSansArabic';
            }
          }
        });
      }
      
      console.log('Adding footer...');
      
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
        doc.setFont(isRtl ? 'NotoSansArabic' : 'helvetica', 'normal');
        
        const pageText = isRtl 
          ? `صفحة ${i} من ${pageCount}`
          : `Page ${i} of ${pageCount}`;
        
        doc.text(
          pageText,
          isRtl ? 20 : 190,
          292,
          { align: isRtl ? 'left' : 'right' }
        );
        
        // App URL/info
        const appText = isRtl ? 'WAKTI © 2025 - وقتي' : 'WAKTI © 2025';
        doc.text(appText, 105, 292, { align: 'center' });
      }
      
      console.log('Generating PDF blob...');
      
      // Generate PDF blob and resolve the promise
      const pdfBlob = doc.output('blob');
      console.log('PDF generated successfully, blob size:', pdfBlob.size);
      resolve(pdfBlob);
    } catch (error) {
      console.error('Error generating PDF:', error);
      reject(new Error(`PDF generation failed: ${error.message}`));
    }
  });
};
