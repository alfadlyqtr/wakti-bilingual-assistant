
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
    transcript?: string | null;
    summary?: string | null;
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

export const generateSummaryPDF = (options: PDFGenerationOptions): Blob => {
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
  
  // Date and recording info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  
  const createdDate = new Date(metadata.createdAt);
  const expiresDate = new Date(metadata.expiresAt);
  
  const createdFormatted = format(createdDate, 'PPP', { locale });
  const expiresFormatted = format(expiresDate, 'PPP', { locale });
  
  // Metadata
  const metadataTexts = [
    `${isRtl ? 'النوع: ' : 'Type: '} ${metadata.type}`,
    `${isRtl ? 'تاريخ الإنشاء: ' : 'Created: '} ${createdFormatted}`,
    `${isRtl ? 'تاريخ الانتهاء: ' : 'Expires: '} ${expiresFormatted}`,
  ];
  
  if (metadata.host) {
    metadataTexts.push(`${isRtl ? 'المضيف: ' : 'Host: '} ${metadata.host}`);
  }
  
  if (metadata.attendees) {
    metadataTexts.push(`${isRtl ? 'الحضور: ' : 'Attendees: '} ${metadata.attendees}`);
  }
  
  if (metadata.location) {
    metadataTexts.push(`${isRtl ? 'الموقع: ' : 'Location: '} ${metadata.location}`);
  }
  
  let startY = 40;
  metadataTexts.forEach(text => {
    doc.text(text, isRtl ? 190 : 20, startY, { align: isRtl ? 'right' : 'left' });
    startY += 6;
  });
  
  startY += 10;
  
  // Transcript section
  if (content.transcript) {
    doc.setFillColor(240, 240, 240);
    doc.rect(15, startY - 6, 180, 8, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(isRtl ? 'النص' : 'Transcript', isRtl ? 190 : 20, startY, { align: isRtl ? 'right' : 'left' });
    
    startY += 10;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    const splitTranscript = doc.splitTextToSize(content.transcript, 170);
    doc.text(splitTranscript, isRtl ? 190 : 20, startY, { align: isRtl ? 'right' : 'left' });
    startY += splitTranscript.length * 5 + 10;
  }
  
  // Check if we need a new page for summary
  if (startY > 250 && content.summary) {
    doc.addPage();
    startY = 20;
  }
  
  // Summary section
  if (content.summary) {
    doc.setFillColor(240, 240, 240);
    doc.rect(15, startY - 6, 180, 8, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(isRtl ? 'الملخص' : 'Summary', isRtl ? 190 : 20, startY, { align: isRtl ? 'right' : 'left' });
    
    startY += 10;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    const splitSummary = doc.splitTextToSize(content.summary, 170);
    doc.text(splitSummary, isRtl ? 190 : 20, startY, { align: isRtl ? 'right' : 'left' });
  }
  
  // Footer
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
  
  return doc.output('blob');
};
