
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

      // Set RTL if Arabic
      if (isRtl) {
        doc.setR2L(true);
      }

      // Add branding
      const primaryColor = '#060541'; // Dark blue from the WAKTI theme colors
      const secondaryColor = '#e9ceb0'; // Light color from the WAKTI theme colors
      
      // Header with app name and logo (simulated as colored rectangles for now)
      doc.setFillColor(primaryColor);
      doc.rect(0, 0, 210, 20, 'F');
      
      // App name
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('WAKTI', isRtl ? 190 : 20, 13);
      
      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(title, isRtl ? 190 : 20, 30, { align: isRtl ? 'right' : 'left' });
      
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
      
      // Add metadata as a clean table
      doc.autoTable({
        startY: 35,
        head: [],
        body: metadataArray,
        theme: 'plain',
        styles: {
          fontSize: 10,
          cellPadding: 1,
          overflow: 'linebreak',
          halign: isRtl ? 'right' : 'left',
          textColor: [80, 80, 80]
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 30 }
        },
        margin: { left: isRtl ? 20 : 20, right: isRtl ? 20 : 20 },
      });
      
      // Get the final y position after the metadata table
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      
      // Main content section - Process and format the text
      if (content.text) {
        // Add a header for the content section
        doc.setFillColor(240, 240, 240);
        doc.rect(15, finalY - 6, 180, 8, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(isRtl ? 'النص' : 'Content', isRtl ? 190 : 20, finalY, { align: isRtl ? 'right' : 'left' });
        
        // Process the text to identify structure
        const processedText = preprocessTextForPDF(content.text);
        
        // Create a content table that will automatically handle pagination
        doc.autoTable({
          startY: finalY + 5,
          head: [],
          body: [[processedText]],
          theme: 'plain',
          styles: {
            fontSize: 10,
            cellPadding: 2,
            lineWidth: 0,
            overflow: 'linebreak',
            halign: isRtl ? 'right' : 'left',
            textColor: [0, 0, 0]
          },
          columnStyles: {
            0: { 
              cellWidth: 'auto'
            }
          },
          margin: { left: 20, right: 20 },
          didParseCell: function(data) {
            const text = data.cell.text;
            
            // Make headings bold
            for (let i = 0; i < text.length; i++) {
              if (text[i].startsWith('##')) {
                data.cell.styles.fontStyle = 'bold';
                text[i] = text[i].substring(2).trim();
              } else if (text[i].startsWith('•')) {
                // Add proper indentation for bullet points
                text[i] = '   ' + text[i];
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
        doc.text(
          `${isRtl ? 'صفحة ' : 'Page '} ${i} ${isRtl ? ' من ' : ' of '} ${pageCount}`,
          isRtl ? 20 : 190,
          292,
          { align: isRtl ? 'left' : 'right' }
        );
        
        // App URL/info
        doc.text('WAKTI © 2025', 105, 292, { align: 'center' });
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

// Helper function to preprocess the text for better formatting in PDF
function preprocessTextForPDF(text: string): string {
  if (!text) return '';
  
  // Add heading markers
  let processedText = text
    // Add markdown-style headings for titles or headers (usually in all caps or ending with a colon)
    .replace(/^([A-Z][A-Z\s]+)(?:\n|:)/gm, '## $1\n')
    .replace(/^(Main Points|Action Items|Summary|Conclusion|Introduction)(?:\n|:)/gm, '## $1\n')
    
    // Convert potential bullet points to actual bullets
    .replace(/^[-*]\s+(.+)$/gm, '• $1')
    .replace(/^\d+\.\s+(.+)$/gm, '• $1')
    
    // Add spacing after paragraphs
    .replace(/\n\n/g, '\n\n')
    
    // Handle any remaining structural elements
    .trim();

  return processedText;
}
