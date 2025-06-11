
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { arSA, enUS } from "date-fns/locale";
import html2canvas from 'html2canvas';

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
  return new Promise(async (resolve, reject) => {
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
      let yPosition = margin;

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
      doc.text(title, isRtl ? pageWidth - margin : margin, yPosition, { align: isRtl ? 'right' : 'left' });
      yPosition += 15;
      
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
      
      // Add metadata with background
      doc.setFillColor(248, 249, 250);
      const metadataHeight = metadataItems.length * 7 + 10;
      doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, metadataHeight, 'F');
      
      metadataItems.forEach(item => {
        doc.text(item, isRtl ? pageWidth - margin - 5 : margin + 5, yPosition, { align: isRtl ? 'right' : 'left' });
        yPosition += 7;
      });
      
      yPosition += 15;
      
      // Content section using html2canvas for Arabic text
      if (content.text && content.text.trim()) {
        // Content header
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 15, 'F');
        doc.text(isRtl ? 'المحتوى' : 'Content', isRtl ? pageWidth - margin - 5 : margin + 5, yPosition + 5);
        yPosition += 20;
        
        // Create hidden element with Arabic content
        const hiddenDiv = document.createElement('div');
        hiddenDiv.style.position = 'absolute';
        hiddenDiv.style.left = '-9999px';
        hiddenDiv.style.top = '-9999px';
        hiddenDiv.style.width = `${(pageWidth - 2 * margin) * 3.78}px`; // Convert mm to px (approximate)
        hiddenDiv.style.padding = '20px';
        hiddenDiv.style.backgroundColor = 'white';
        hiddenDiv.style.color = 'black';
        hiddenDiv.style.fontSize = '16px';
        hiddenDiv.style.lineHeight = '1.5';
        hiddenDiv.style.fontFamily = isRtl ? 'Arial, "Segoe UI", Tahoma, sans-serif' : 'Arial, sans-serif';
        hiddenDiv.style.direction = isRtl ? 'rtl' : 'ltr';
        hiddenDiv.style.textAlign = isRtl ? 'right' : 'left';
        hiddenDiv.style.whiteSpace = 'pre-wrap';
        hiddenDiv.style.wordWrap = 'break-word';
        hiddenDiv.textContent = content.text;
        
        document.body.appendChild(hiddenDiv);
        
        try {
          // Convert to canvas
          const canvas = await html2canvas(hiddenDiv, {
            backgroundColor: 'white',
            scale: 2, // Higher quality
            useCORS: true,
            allowTaint: true
          });
          
          // Remove hidden element
          document.body.removeChild(hiddenDiv);
          
          // Convert canvas to image data
          const imgData = canvas.toDataURL('image/png');
          
          // Calculate dimensions for PDF
          const imgWidth = pageWidth - 2 * margin;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          
          // Check if image fits on current page
          if (yPosition + imgHeight > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
          }
          
          // Add image to PDF
          doc.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
          
        } catch (canvasError) {
          console.error('Canvas rendering failed, using fallback:', canvasError);
          
          // Remove hidden element if still exists
          if (document.body.contains(hiddenDiv)) {
            document.body.removeChild(hiddenDiv);
          }
          
          // Fallback to simple text
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);
          
          const lines = content.text.split('\n');
          lines.forEach(line => {
            if (yPosition > pageHeight - margin - 10) {
              doc.addPage();
              yPosition = margin;
            }
            doc.text(line, isRtl ? pageWidth - margin - 5 : margin + 5, yPosition, { align: isRtl ? 'right' : 'left' });
            yPosition += 7;
          });
        }
      }
      
      // Footer
      const footerY = pageHeight - 20;
      doc.setFontSize(9);
      doc.setTextColor(102, 102, 102);
      const footerText = isRtl ? 'WAKTI © 2025 - وقتي' : 'WAKTI © 2025';
      doc.text(footerText, pageWidth / 2, footerY, { align: 'center' });
      
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
