
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
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
      
      // Create new PDF document
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Create HTML content that will be converted to PDF
      const createHtmlContent = () => {
        const createdDate = new Date(metadata.createdAt);
        const expiresDate = new Date(metadata.expiresAt);
        const createdFormatted = format(createdDate, 'PPP', { locale });
        const expiresFormatted = format(expiresDate, 'PPP', { locale });

        return `
          <div style="font-family: 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif; direction: ${isRtl ? 'rtl' : 'ltr'}; text-align: ${isRtl ? 'right' : 'left'}; padding: 20px; line-height: 1.6;">
            
            <!-- Header -->
            <div style="background: #060541; color: white; padding: 15px; margin: -20px -20px 20px -20px; text-align: center;">
              <h1 style="margin: 0; font-size: 18px; font-weight: bold;">WAKTI - ${isRtl ? 'وقتي' : ''}</h1>
            </div>
            
            <!-- Title -->
            <h2 style="color: #060541; font-size: 16px; font-weight: bold; margin-bottom: 20px;">
              ${title}
            </h2>
            
            <!-- Metadata -->
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 12px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 5px 0; font-weight: bold; width: 25%;">${isRtl ? 'النوع:' : 'Type:'}</td>
                  <td style="padding: 5px 0;">${metadata.type}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; font-weight: bold;">${isRtl ? 'تاريخ الإنشاء:' : 'Created:'}</td>
                  <td style="padding: 5px 0;">${createdFormatted}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; font-weight: bold;">${isRtl ? 'تاريخ الانتهاء:' : 'Expires:'}</td>
                  <td style="padding: 5px 0;">${expiresFormatted}</td>
                </tr>
                ${metadata.host ? `
                <tr>
                  <td style="padding: 5px 0; font-weight: bold;">${isRtl ? 'المضيف:' : 'Host:'}</td>
                  <td style="padding: 5px 0;">${metadata.host}</td>
                </tr>` : ''}
                ${metadata.attendees ? `
                <tr>
                  <td style="padding: 5px 0; font-weight: bold;">${isRtl ? 'الحضور:' : 'Attendees:'}</td>
                  <td style="padding: 5px 0;">${metadata.attendees}</td>
                </tr>` : ''}
                ${metadata.location ? `
                <tr>
                  <td style="padding: 5px 0; font-weight: bold;">${isRtl ? 'الموقع:' : 'Location:'}</td>
                  <td style="padding: 5px 0;">${metadata.location}</td>
                </tr>` : ''}
              </table>
            </div>
            
            <!-- Content -->
            ${content.text ? `
            <div style="margin-bottom: 20px;">
              <h3 style="background: #f0f0f0; padding: 10px; margin: 0 0 15px 0; font-size: 14px; font-weight: bold;">
                ${isRtl ? 'المحتوى' : 'Content'}
              </h3>
              <div style="padding: 15px; border: 1px solid #ddd; border-radius: 5px; white-space: pre-wrap; font-size: 12px;">
                ${content.text}
              </div>
            </div>` : ''}
            
            <!-- Footer -->
            <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #ddd; padding-top: 10px;">
              ${isRtl ? 'WAKTI © 2025 - وقتي' : 'WAKTI © 2025'}
            </div>
          </div>
        `;
      };

      // Create a temporary element to hold the HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = createHtmlContent();
      tempDiv.style.position = 'fixed';
      tempDiv.style.top = '-9999px';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '210mm';
      document.body.appendChild(tempDiv);

      console.log('Converting HTML to PDF...');

      // Use jsPDF html method to convert HTML to PDF
      doc.html(tempDiv, {
        callback: function (pdf) {
          console.log('PDF conversion completed');
          
          // Clean up the temporary element
          document.body.removeChild(tempDiv);
          
          // Generate and resolve the blob
          const pdfBlob = pdf.output('blob');
          console.log('PDF generated successfully, blob size:', pdfBlob.size);
          resolve(pdfBlob);
        },
        x: 0,
        y: 0,
        width: 210,
        windowWidth: 794, // A4 width in pixels at 96 DPI
        html2canvas: {
          scale: 0.8,
          useCORS: true,
          letterRendering: true
        }
      });

    } catch (error) {
      console.error('Error generating PDF:', error);
      reject(new Error(`PDF generation failed: ${error.message}`));
    }
  });
};
