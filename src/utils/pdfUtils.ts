
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

// DOM-capture exporter: captures existing on-screen sections by IDs in order
export async function generateInsightsPDFFromDOM(ids: string[], language: 'en'|'ar'): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8;
  let cursorY = margin;

  // Helper to add one element
  const addElement = async (el: HTMLElement) => {
    // Ensure element is visible for html2canvas (it already is on the page)
    const canvas = await html2canvas(el, { backgroundColor: 'white', scale: 2, useCORS: true, allowTaint: true });
    const img = canvas.toDataURL('image/png');
    const maxWidth = pageWidth - margin * 2;
    const imgWidth = maxWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // New page if overflow
    if (cursorY + imgHeight > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
    }
    doc.addImage(img, 'PNG', margin, cursorY, imgWidth, Math.min(imgHeight, pageHeight - margin - cursorY));
    cursorY += Math.min(imgHeight, pageHeight - margin - cursorY) + 6;
  };

  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    await addElement(el as HTMLElement);
  }

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(102, 102, 102);
  doc.text(language === 'ar' ? 'WAKTI © 2025 - وقتي' : 'WAKTI © 2025', pageWidth / 2, pageHeight - 6, { align: 'center' });

  return doc.output('blob');
}

// New: One-page premium AI Insights PDF with visuals and full sections
export interface InsightsPDFData {
  userName?: string | null;
  userEmail?: string | null;
  lastSyncedAt?: string | null;
  language: 'en' | 'ar';
  logoUrl?: string; // optional header logo
  today: {
    recoveryPct?: number | null;
    sleepHours?: number | null;
    sleepPerformancePct?: number | null;
    efficiencyPct?: number | null;
    consistencyPct?: number | null;
    respiratoryRate?: number | null;
    sleepCycles?: number | null;
    disturbances?: number | null;
    hrvMs?: number | null;
    rhrBpm?: number | null;
    dayStrain?: number | null;
    workout?: {
      sport?: string | null;
      start?: string | null;
      end?: string | null;
      durationMin?: number | null;
      strain?: number | null;
      avgHr?: number | null;
      maxHr?: number | null;
      calories?: number | null;
      distanceKm?: number | null;
      elevationM?: number | null;
      dataQualityPct?: number | null;
    } | null;
    sleepDetail?: {
      bedtime?: string | null;
      waketime?: string | null;
      deepMin?: number | null;
      remMin?: number | null;
      lightMin?: number | null;
      awakeMin?: number | null;
    } | null;
    skinTempC?: number | null;
    spo2Pct?: number | null;
    calibrating?: boolean | null;
  };
  yesterday?: Partial<InsightsPDFData['today']> | null;
  ai?: {
    daily_summary?: string;
    tips?: string[];
  } | null;
}

export async function generateInsightsPDF(data: InsightsPDFData): Promise<Blob> {
  const {
    language,
    userName,
    logoUrl = '/logo.png',
    today,
    yesterday,
    ai
  } = data;

  const isRtl = language === 'ar';

  // Build an offscreen container with rich layout and CSS-based visuals
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '794px'; // ~ A4 width at 96dpi
  container.style.padding = '20px';
  container.style.background = 'white';
  container.style.fontFamily = isRtl ? 'Arial, \'Segoe UI\', Tahoma, sans-serif' : 'Inter, Arial, sans-serif';
  container.style.direction = isRtl ? 'rtl' : 'ltr';

  const fmt = (n: number) => {
    const s = Number.isInteger(n) ? `${n}` : `${Math.round(n * 10) / 10}`;
    return s;
  };
  const pct = (v?: number | null) => (v === null || v === undefined ? '--' : `${fmt(v)}%`);
  const ms = (v?: number | null) => (v === null || v === undefined ? '--' : `${fmt(v)} ms`);
  const bpm = (v?: number | null) => (v === null || v === undefined ? '--' : `${fmt(v)} bpm`);
  const h = (v?: number | null) => (v === null || v === undefined ? '--' : `${fmt(v)}h`);
  const km = (v?: number | null) => (v === null || v === undefined ? '--' : `${fmt(v)} km`);
  const cal = (v?: number | null) => (v === null || v === undefined ? '--' : `${fmt(v)} cal`);
  const num = (v?: number | null) => (v === null || v === undefined ? '--' : `${fmt(v)}`);

  const delta = (t?: number | null, y?: number | null) => {
    if (t === null || t === undefined || y === null || y === undefined) return '';
    const d = +(t - y).toFixed(1);
    if (d === 0) return isRtl ? ' (بدون تغيير)' : ' (no change)';
    return d > 0 ? ` (+${d})` : ` (${d})`;
  };

  const title = isRtl ? 'رؤى WAKTI AI' : 'WAKTI AI Insights';
  const kpiLabel = (en: string, ar: string) => (isRtl ? ar : en);

  // CSS with conic-gradient donut and simple gauges that html2canvas can render
  container.innerHTML = `
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    .header { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-radius:10px; background: linear-gradient(90deg, #f1f5ff, #f3e8ff); margin-bottom:10px; }
    .brand { display:flex; align-items:center; gap:10px; }
    .logo { width:32px; height:32px; object-fit:contain; }
    .title { font-size:16px; font-weight:700; color:#111827; }
    .meta { font-size:11px; color:#6b7280; }
    .kpis { display:grid; grid-template-columns: repeat(5, 1fr); gap:6px; margin: 6px 0 8px 0; }
    .kpi { border:1px solid #e5e7eb; border-radius:6px; padding:6px; background:#fafafa; }
    .kpi .label { font-size:9px; color:#6b7280; }
    .kpi .value { font-size:13px; font-weight:700; color:#111827; }
    .grid { display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:8px; }
    .card { border:1px solid #e5e7eb; border-radius:8px; padding:8px; }
    .card.sleep { background: linear-gradient(135deg, #ede9fe, #ddd6fe); }
    .card.recovery { background: linear-gradient(135deg, #d1fae5, #a7f3d0); }
    .card.strain { background: linear-gradient(135deg, #fecaca, #fca5a5); }
    .card.workout { background: linear-gradient(135deg, #fce7f3, #fbcfe8); }
    .card h3 { margin:0 0 6px 0; font-size:11px; color:#111827; font-weight:600; }
    .rows { display:grid; grid-template-columns: auto 1fr; gap:3px 8px; font-size:9px; }
    .rows .k { color:#6b7280; }
    .rows .v { color:#111827; font-weight:600; }
    .donut { width:80px; height:80px; border-radius:50%; margin:auto; position:relative; background:conic-gradient(#10b981 var(--p), #e5e7eb 0); }
    .donut::after { content: attr(data-center); position:absolute; inset:10px; background:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; color:#111827; }
    .ai { background: linear-gradient(135deg, #fef3c7, #fde68a); border:1px solid #fbbf24; border-radius:8px; padding:8px; margin-top:8px; }
    .ai h3 { font-size:11px; margin-bottom:4px; color:#92400e; }
    .ai p { font-size:9px; color:#111827; line-height:1.4; }
    .tips { margin-top:6px; font-size:9px; color:#111827; padding-left:12px; }
    .tips li { margin:2px 0; }
    .footer { margin-top:8px; text-align:center; font-size:9px; color:#6b7280; }
  </style>
  <div class="header">
    <div class="brand">
      <img src="https://raw.githubusercontent.com/alfadlyqtr/wakti-bilingual-assistant/main/public/lovable-uploads/4ed7b33a-201e-4f05-94de-bac892155c01.png" class="logo" crossorigin="anonymous" />
      <div>
        <div class="title">${title}</div>
        <div class="meta">${userName || ''} ${data.userEmail ? '· ' + data.userEmail : ''}</div>
      </div>
    </div>
    <div class="meta">${isRtl ? 'تقرير اليوم' : 'Today Report'}</div>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="label">${kpiLabel('Recovery','التعافي')}</div><div class="value">${pct(today.recoveryPct)}</div><div class="delta">${delta(today.recoveryPct, yesterday?.recoveryPct as any)}</div></div>
    <div class="kpi"><div class="label">${kpiLabel('Sleep','النوم')}</div><div class="value">${h(today.sleepHours)}</div><div class="delta">${delta(today.sleepHours as any, yesterday?.sleepHours as any)}</div></div>
    <div class="kpi"><div class="label">${kpiLabel('HRV','تقلب معدل ضربات القلب')}</div><div class="value">${ms(today.hrvMs)}</div><div class="delta">${delta(today.hrvMs as any, yesterday?.hrvMs as any)}</div></div>
    <div class="kpi"><div class="label">${kpiLabel('Strain','الإجهاد')}</div><div class="value">${num(today.dayStrain)}</div><div class="delta">${delta(today.dayStrain as any, yesterday?.dayStrain as any)}</div></div>
    <div class="kpi"><div class="label">${kpiLabel('Resting HR','النبض أثناء الراحة')}</div><div class="value">${bpm(today.rhrBpm)}</div><div class="delta">${delta(today.rhrBpm as any, yesterday?.rhrBpm as any)}</div></div>
  </div>

  <div class="grid">
    <div class="card sleep">
      <h3>${kpiLabel('Sleep Summary','ملخص النوم')}</h3>
      <div class="rows">
        ${today.sleepDetail?.bedtime ? `<div class="k">${kpiLabel('Bedtime','وقت النوم')}</div><div class="v">${today.sleepDetail.bedtime}</div>` : ''}
        ${today.sleepDetail?.waketime ? `<div class="k">${kpiLabel('Wake Time','الاستيقاظ')}</div><div class="v">${today.sleepDetail.waketime}</div>` : ''}
        <div class="k">${kpiLabel('Duration','المدة')}</div><div class="v">${h(today.sleepHours)}</div>
        <div class="k">${kpiLabel('Performance','الأداء')}</div><div class="v">${pct(today.sleepPerformancePct)}</div>
        <div class="k">${kpiLabel('Efficiency','الكفاءة')}</div><div class="v">${pct(today.efficiencyPct)}</div>
        <div class="k">${kpiLabel('Consistency','الانتظام')}</div><div class="v">${pct(today.consistencyPct)}</div>
        <div class="k">${kpiLabel('Respiratory Rate','معدل التنفس')}</div><div class="v">${today.respiratoryRate ? today.respiratoryRate.toFixed(1) + ' bpm' : '--'}</div>
        <div class="k">${kpiLabel('Sleep Cycles','دورات النوم')}</div><div class="v">${num(today.sleepCycles)}</div>
        <div class="k">${kpiLabel('Disturbances','الاضطرابات')}</div><div class="v">${num(today.disturbances)}</div>
        ${today.sleepDetail?.deepMin ? `<div class="k">${kpiLabel('Deep','عميق')}</div><div class="v">${num(today.sleepDetail.deepMin)} min</div>` : ''}
        ${today.sleepDetail?.remMin ? `<div class="k">${kpiLabel('REM','ريم')}</div><div class="v">${num(today.sleepDetail.remMin)} min</div>` : ''}
        ${today.sleepDetail?.lightMin ? `<div class="k">${kpiLabel('Light','خفيف')}</div><div class="v">${num(today.sleepDetail.lightMin)} min</div>` : ''}
        ${today.sleepDetail?.awakeMin ? `<div class="k">${kpiLabel('Awake','يقظة')}</div><div class="v">${num(today.sleepDetail.awakeMin)} min</div>` : ''}
      </div>
    </div>
    <div class="card recovery">
      <h3>${kpiLabel('Recovery','التعافي')}</h3>
      <div class="donut" style="--p:${Math.max(0, Math.min(100, today.recoveryPct ?? 0))}%;" data-center="${today.recoveryPct ?? '--'}%"></div>
      <div class="rows" style="margin-top:6px;">
        <div class="k">${kpiLabel('HRV (RMSSD)','HRV')}</div><div class="v">${ms(today.hrvMs)}</div>
        <div class="k">${kpiLabel('Resting HR','النبض أثناء الراحة')}</div><div class="v">${bpm(today.rhrBpm)}</div>
        <div class="k">${kpiLabel('Blood Oxygen','الأكسجين')}</div><div class="v">${pct(today.spo2Pct)}</div>
        <div class="k">${kpiLabel('Skin Temp','حرارة الجلد')}</div><div class="v">${today.skinTempC ? today.skinTempC.toFixed(1) + '°C' : '--'}</div>
        <div class="k">${kpiLabel('Calibrating','المعايرة')}</div><div class="v">${today.calibrating ? (isRtl?'نعم':'Yes') : (today.calibrating===false ? (isRtl?'لا':'No') : '--')}</div>
      </div>
    </div>
    <div class="card strain">
      <h3>${kpiLabel('Strain','الإجهاد')}</h3>
      <div class="rows">
        <div class="k">${kpiLabel('Day Strain','إجهاد اليوم')}</div><div class="v">${num(today.dayStrain)}</div>
        <div class="k">${kpiLabel('Avg HR','متوسط النبض')}</div><div class="v">${bpm(today.workout?.avgHr)}</div>
        <div class="k">${kpiLabel('Training Load','حمل التدريب')}</div><div class="v">--</div>
        <div class="k">${kpiLabel('Energy Burned','الطاقة المحروقة')}</div><div class="v">${cal(today.workout?.calories)}</div>
      </div>
    </div>
    <div class="card workout">
      <h3>${kpiLabel('Workout','التمرين')}</h3>
      ${today.workout ? `
      <div class="rows">
        <div class="k">${kpiLabel('Activity Type','نوع النشاط')}</div><div class="v">${today.workout.sport ?? '--'}</div>
        ${today.workout.start ? `<div class="k">${kpiLabel('Start Time','وقت البداية')}</div><div class="v">${today.workout.start}</div>` : ''}
        <div class="k">${kpiLabel('Duration','المدة')}</div><div class="v">${num(today.workout.durationMin)} min</div>
        <div class="k">${kpiLabel('Strain','الإجهاد')}</div><div class="v">${num(today.workout.strain)}</div>
        <div class="k">${kpiLabel('Avg HR','متوسط النبض')}</div><div class="v">${bpm(today.workout.avgHr)}</div>
        <div class="k">${kpiLabel('Max HR','الحد الأقصى')}</div><div class="v">${bpm(today.workout.maxHr)}</div>
        <div class="k">${kpiLabel('Calories','السعرات')}</div><div class="v">${cal(today.workout.calories)}</div>
        <div class="k">${kpiLabel('Distance','المسافة')}</div><div class="v">${km(today.workout.distanceKm)}</div>
        <div class="k">${kpiLabel('Elevation Gain','الارتفاع المكتسب')}</div><div class="v">${num(today.workout.elevationM)} m</div>
        <div class="k">${kpiLabel('Data Quality','جودة البيانات')}</div><div class="v">${pct(today.workout.dataQualityPct)}</div>
      </div>
      ` : `<div class="rows"><div class="k">${kpiLabel('Status','الحالة')}</div><div class="v">${kpiLabel('No workout data available','لا توجد بيانات تمارين متاحة')}</div></div>`}
    </div>
  </div>

  <div class="ai">
    <h3>${kpiLabel('AI Daily Summary','ملخص اليوم (الذكاء الاصطناعي)')}</h3>
    <div style="font-size:12px; color:#111827; white-space:pre-wrap;">${ai?.daily_summary ?? (isRtl ? '—' : '—')}</div>
    ${ai?.tips && ai.tips.length ? `<ul class="tips">${ai.tips.slice(0,3).map(t=>`<li>• ${t}</li>`).join('')}</ul>` : ''}
  </div>
  <div class="footer">WAKTI © 2025</div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { backgroundColor: 'white', scale: 2, useCORS: true, allowTaint: true });
    const img = canvas.toDataURL('image/png');

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 6;

    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const y = (pageHeight - imgHeight) > margin ? margin : 0; // keep within page
    doc.addImage(img, 'PNG', margin, y, imgWidth, Math.min(imgHeight, pageHeight - margin * 2));

    return doc.output('blob');
  } finally {
    if (document.body.contains(container)) document.body.removeChild(container);
  }
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
