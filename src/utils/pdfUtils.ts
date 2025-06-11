
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { arSA, enUS } from "date-fns/locale";

// Extend the jsPDF type to include autotable - only add what's missing
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

      // Set font - use helvetica for now to avoid font issues
      // For Arabic, we'll rely on the browser's Unicode support
      doc.setFont('helvetica');
      
      console.log('PDF document created, setting up layout...');

      // Add branding
      const primaryColor = '#060541';
      const secondaryColor = '#e9ceb0';
      
      // Header with app name
      doc.setFillColor(primaryColor);
      doc.rect(0, 0, 210, 20, 'F');
      
      // App name
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      
      if (isRtl) {
        doc.text('WAKTI - وقتي', 190, 13, { align: 'right' });
      } else {
        doc.text('WAKTI', 20, 13);
      }
      
      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      
      // For Arabic titles, use simpler approach
      const processedTitle = isRtl ? title : title;
      doc.text(processedTitle, isRtl ? 190 : 20, 30, { align: isRtl ? 'right' : 'left' });
      
      // Date and info
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      
      const createdDate = new Date(metadata.createdAt);
      const expiresDate = new Date(metadata.expiresAt);
      
      const createdFormatted = format(createdDate, 'PPP', { locale });
      const expiresFormatted = format(expiresDate, 'PPP', { locale });
      
      // Metadata table
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
          font: 'helvetica',
          fontStyle: 'normal'
        },
        columnStyles: {
          0: { 
            fontStyle: 'bold', 
            cellWidth: 35,
            font: 'helvetica'
          },
          1: {
            font: 'helvetica'
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
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        
        const contentLabel = isRtl ? 'المحتوى' : 'Content';
        doc.text(contentLabel, isRtl ? 190 : 20, finalY, { align: isRtl ? 'right' : 'left' });
        
        // Process the text - simpler approach for Arabic
        const processedText = preprocessTextForPDF(content.text, isRtl);
        
        console.log('Processed text length:', processedText.length);
        
        // Create a content table
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
            font: 'helvetica',
            fontStyle: 'normal',
            lineHeight: 1.4
          },
          columnStyles: {
            0: { 
              cellWidth: 'auto',
              font: 'helvetica'
            }
          },
          margin: { left: 20, right: 20 },
          didParseCell: function(data) {
            const text = data.cell.text;
            
            // Make headings bold and handle text
            for (let i = 0; i < text.length; i++) {
              if (text[i].startsWith('##')) {
                data.cell.styles.fontStyle = 'bold';
                const cleanText = text[i].substring(2).trim();
                text[i] = cleanText;
              } else if (text[i].startsWith('•')) {
                // Add proper indentation for bullet points
                const cleanText = text[i].substring(1).trim();
                text[i] = isRtl ? `• ${cleanText}` : `   • ${cleanText}`;
              }
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
        doc.setFont('helvetica', 'normal');
        
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

// Simplified text preprocessing for better PDF compatibility
function preprocessTextForPDF(text: string, isRtl: boolean = false): string {
  if (!text) return '';
  
  let processedText = text;
  
  // Basic preprocessing - avoid complex text manipulation
  processedText = processedText
    // Add markdown-style headings for titles or headers
    .replace(/^([A-Z][A-Z\s]+)(?:\n|:)/gm, '## $1\n')
    .replace(/^(Main Points|Action Items|Summary|Conclusion|Introduction|النقاط الرئيسية|عناصر العمل|الملخص|الخلاصة|المقدمة)(?:\n|:)/gmi, '## $1\n')
    
    // Convert potential bullet points to actual bullets
    .replace(/^[-*]\s+(.+)$/gm, '• $1')
    .replace(/^\d+\.\s+(.+)$/gm, '• $1')
    
    // Clean up extra spaces and line breaks
    .replace(/\n\n+/g, '\n\n')
    .trim();

  return processedText;
}
