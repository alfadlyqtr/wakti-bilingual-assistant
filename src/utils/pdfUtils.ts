
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { arSA, enUS } from "date-fns/locale";

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
      
      console.log('Generating PDF for language:', language);
      console.log('Content text:', content.text);
      
      // Create new PDF document
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const lineHeight = 7;
      let yPosition = margin;

      // Set font to support Unicode (includes Arabic)
      doc.setFont('helvetica');
      
      // Header
      doc.setFillColor(6, 5, 65); // #060541
      doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text('WAKTI', pageWidth / 2, 25, { align: 'center' });
      
      yPosition = 50;
      doc.setTextColor(0, 0, 0);
      
      // Title
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      const titleLines = doc.splitTextToSize(title, pageWidth - 2 * margin);
      titleLines.forEach((line: string) => {
        if (yPosition > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }
        doc.text(line, isRtl ? pageWidth - margin : margin, yPosition, { align: isRtl ? 'right' : 'left' });
        yPosition += lineHeight + 2;
      });
      
      yPosition += 10;
      
      // Metadata section
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      
      const createdDate = new Date(metadata.createdAt);
      const expiresDate = new Date(metadata.expiresAt);
      const createdFormatted = format(createdDate, 'PPP', { locale });
      const expiresFormatted = format(expiresDate, 'PPP', { locale });
      
      const metadataItems = [
        `${isRtl ? 'النوع:' : 'Type:'} ${metadata.type}`,
        `${isRtl ? 'تاريخ الإنشاء:' : 'Created:'} ${createdFormatted}`,
        `${isRtl ? 'تاريخ الانتهاء:' : 'Expires:'} ${expiresFormatted}`
      ];
      
      if (metadata.host) {
        metadataItems.push(`${isRtl ? 'المضيف:' : 'Host:'} ${metadata.host}`);
      }
      if (metadata.attendees) {
        metadataItems.push(`${isRtl ? 'الحضور:' : 'Attendees:'} ${metadata.attendees}`);
      }
      if (metadata.location) {
        metadataItems.push(`${isRtl ? 'الموقع:' : 'Location:'} ${metadata.location}`);
      }
      
      // Add background for metadata
      doc.setFillColor(248, 249, 250);
      const metadataHeight = metadataItems.length * lineHeight + 10;
      doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, metadataHeight, 'F');
      
      metadataItems.forEach(item => {
        if (yPosition > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }
        doc.text(item, isRtl ? pageWidth - margin - 5 : margin + 5, yPosition, { align: isRtl ? 'right' : 'left' });
        yPosition += lineHeight;
      });
      
      yPosition += 15;
      
      // Content section
      if (content.text && content.text.trim()) {
        // Content header
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 15, 'F');
        doc.text(isRtl ? 'المحتوى' : 'Content', isRtl ? pageWidth - margin - 5 : margin + 5, yPosition + 5);
        yPosition += 20;
        
        // Content text
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        
        // Split text into lines that fit the page width
        const textWidth = pageWidth - 2 * margin - 10;
        const contentLines = doc.splitTextToSize(content.text, textWidth);
        
        console.log('Content lines to render:', contentLines.length);
        
        contentLines.forEach((line: string, index: number) => {
          if (yPosition > pageHeight - margin - 10) {
            doc.addPage();
            yPosition = margin;
          }
          
          // For Arabic text, align to the right
          const xPosition = isRtl ? pageWidth - margin - 5 : margin + 5;
          doc.text(line, xPosition, yPosition, { align: isRtl ? 'right' : 'left' });
          yPosition += lineHeight;
        });
      }
      
      // Footer
      yPosition = pageHeight - 20;
      doc.setFontSize(9);
      doc.setTextColor(102, 102, 102);
      const footerText = isRtl ? 'WAKTI © 2025 - وقتي' : 'WAKTI © 2025';
      doc.text(footerText, pageWidth / 2, yPosition, { align: 'center' });
      
      console.log('PDF generation completed');
      
      // Generate and resolve the blob
      const pdfBlob = doc.output('blob');
      console.log('PDF generated successfully, blob size:', pdfBlob.size);
      resolve(pdfBlob);

    } catch (error) {
      console.error('Error generating PDF:', error);
      reject(new Error(`PDF generation failed: ${error.message}`));
    }
  });
};
