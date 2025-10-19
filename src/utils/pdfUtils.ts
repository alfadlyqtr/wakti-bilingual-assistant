
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
  const now = new Date();
  const reportTime = isRtl 
    ? `${format(now, "yyyy/MM/dd")} الساعة ${format(now, "HH:mm")}`
    : format(now, "MMMM d, yyyy 'at' h:mm a");
  const disclaimer = isRtl 
    ? 'البيانات مصدرها جهاز WHOOP® الخاص بك عبر الواجهة البرمجية الرسمية.'
    : 'Data sourced from your WHOOP® device via the official API.';

  const recoveryColor = today.recoveryPct && today.recoveryPct >= 67 ? '#22c55e' : today.recoveryPct && today.recoveryPct >= 34 ? '#f59e0b' : '#ef4444';
  const strainColor = today.dayStrain && today.dayStrain >= 14 ? '#ef4444' : today.dayStrain && today.dayStrain >= 10 ? '#f59e0b' : '#22c55e';
  const sleepColor = today.sleepPerformancePct && today.sleepPerformancePct >= 85 ? '#4f46e5' : today.sleepPerformancePct && today.sleepPerformancePct >= 70 ? '#7c3aed' : '#a78bfa';

  const getCircleSvg = (percentage: number, color: string, centerText: string) => {
    const r = 44;
    const circ = 2 * Math.PI * r;
    const strokePct = ((100 - percentage) * circ) / 100;
    return `
      <svg width="120" height="120" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="gradient-${color.replace('#','')}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${color};stop-opacity:0.8" />
            <stop offset="100%" style="stop-color:${color};stop-opacity:1" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="12" />
        <circle cx="50" cy="50" r="${r}" fill="none" stroke="url(#gradient-${color.replace('#','')})" stroke-width="12" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${strokePct}" transform="rotate(-90 50 50)"></circle>
        <text x="50" y="50" font-family="sans-serif" font-size="20" font-weight="bold" fill="#1f2937" text-anchor="middle" dy=".3em">${centerText}</text>
      </svg>
    `;
  };

  container.innerHTML = `
  <style>
    * { margin:0; padding:0; box-sizing:border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
    body { background-color: #f8fafc; }
    .page { padding: 16px; }
    .header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-radius:16px; background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); margin-bottom:16px; box-shadow: 0 14px 28px rgba(0,0,0,0.10), 0 10px 10px rgba(0,0,0,0.06); border:1px solid #c7d2fe; }
    .brand { display:flex; align-items:center; gap:14px; }
    .logo { width:48px; height:48px; object-fit:contain; }
    .title { font-size:24px; font-weight:700; color:#1e3a8a; }
    .meta { font-size:14px; color:#475569; }
    .date-meta { font-size:12px; color:#64748b; text-align:${isRtl ? 'left' : 'right'}; }
    .kpis { display:grid; grid-template-columns: repeat(5, 1fr); gap:12px; margin-bottom:16px; }
    .kpi { border:1px solid #e2e8f0; border-radius:14px; padding:12px; text-align:center; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); box-shadow: 0 8px 16px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04); position: relative; }
    .kpi::after { content:""; position:absolute; left:0; right:0; top:0; height:3px; border-top-left-radius:14px; border-top-right-radius:14px; background:#e5e7eb; }
    .kpi:nth-child(1)::after{ background:#10b981; } /* Recovery */
    .kpi:nth-child(2)::after{ background:#7c3aed; } /* Sleep */
    .kpi:nth-child(3)::after{ background:#38bdf8; } /* HRV */
    .kpi:nth-child(4)::after{ background:#f59e0b; } /* Strain */
    .kpi:nth-child(5)::after{ background:#64748b; } /* Resting HR */
    .kpi .label { font-size:11px; color:#64748b; margin-bottom:4px; font-weight:500; }
    .kpi .value { font-size:20px; font-weight:700; color:#1e293b; }
    .grid-2x2 { display:grid; grid-template-columns: 1fr 1fr; grid-auto-rows: min-content; gap:16px; margin-bottom:16px; }
    .card { border-radius:16px; padding:16px; display: flex; flex-direction: column; background:white; box-shadow: 0 16px 30px rgba(0,0,0,0.08), 0 6px 12px rgba(0,0,0,0.06), inset 0 1px 0 #ffffff; border:1px solid #e2e8f0; }
    .card.sleep { background: radial-gradient(120% 120% at 0% 0%, #faf5ff 0%, #eef2ff 60%, #ffffff 100%); border-left:6px solid #7c3aed; }
    .card.recovery { background: radial-gradient(120% 120% at 0% 0%, #ecfdf5 0%, #d1fae5 60%, #ffffff 100%); border-left:6px solid #10b981; }
    .card.strain { background: radial-gradient(120% 120% at 0% 0%, #fff7ed 0%, #ffedd5 60%, #ffffff 100%); border-left:6px solid #f59e0b; }
    .card.workout { background: radial-gradient(120% 120% at 0% 0%, #fdf2f8 0%, #fce7f3 60%, #ffffff 100%); border-left:6px solid #ec4899; }
    .card h3 { margin:0 0 12px 0; font-size:18px; color:#1e293b; font-weight:600; }
    .rows { display:grid; grid-template-columns: auto 1fr; gap:6px 12px; font-size:13px; }
    .rows .k { color:#475569; }
    .rows .v { color:#0f172a; font-weight:700; text-align:${isRtl ? 'left' : 'right'}; }
    .viz-container { flex-grow:1; display:flex; align-items:center; justify-content:center; margin: 12px 0; }
    .ai { background: linear-gradient(180deg, #fffceb 0%, #fef9c3 80%, #ffffff 100%); border:1px solid #fde68a; border-radius:16px; padding:16px; margin-top:0; box-shadow: 0 10px 20px rgba(0,0,0,0.08), 0 6px 10px rgba(0,0,0,0.05); }
    .ai h3 { font-size:18px; margin-bottom:8px; color:#1e3a8a; }
    .ai p { font-size:13px; color:#334155; line-height:1.6; }
    .tips { margin-top:12px; font-size:13px; color:#334155; padding-${isRtl ? 'right' : 'left'}:20px; }
    .tips li { margin:5px 0; }
    .footer-container { margin-top:16px; text-align:center; }
    .disclaimer { font-size:10px; color:#94a3b8; }
    .footer { font-size:11px; color:#94a3b8; margin-top:4px; }
  </style>
  <div class="page">
    <div class="header">
      <div class="brand">
        <img src="https://raw.githubusercontent.com/alfadlyqtr/wakti-bilingual-assistant/main/public/lovable-uploads/4ed7b33a-201e-4f05-94de-bac892155c01.png" class="logo" crossorigin="anonymous" />
        <div>
          <div class="title">${title}</div>
          <div class="meta">${userName || ''} ${data.userEmail ? '· ' + data.userEmail : ''}</div>
        </div>
      </div>
      <div class="date-meta">${reportTime}</div>
    </div>

    <div class="kpis">
      <div class="kpi"><div class="label">${kpiLabel('Recovery','التعافي')}</div><div class="value">${pct(today.recoveryPct)}</div></div>
      <div class="kpi"><div class="label">${kpiLabel('Sleep','النوم')}</div><div class="value">${h(today.sleepHours)}</div></div>
      <div class="kpi"><div class="label">${kpiLabel('HRV','تقلب معدل ضربات القلب')}</div><div class="value">${ms(today.hrvMs)}</div></div>
      <div class="kpi"><div class="label">${kpiLabel('Strain','الإجهاد')}</div><div class="value">${num(today.dayStrain)}</div></div>
      <div class="kpi"><div class="label">${kpiLabel('Resting HR','النبض أثناء الراحة')}</div><div class="value">${bpm(today.rhrBpm)}</div></div>
    </div>

    <div class="grid-2x2">
      <div class="card sleep">
        <h3>${kpiLabel('Sleep Summary','ملخص النوم')}</h3>
        <div class="viz-container">${getCircleSvg(today.sleepPerformancePct ?? 0, sleepColor, pct(today.sleepPerformancePct))}</div>
        <div class="rows" style="margin-top:auto;">
          ${today.sleepDetail?.bedtime ? `<div class="k">${kpiLabel('Bedtime','وقت النوم')}</div><div class="v">${today.sleepDetail.bedtime}</div>` : ''}
          ${today.sleepDetail?.waketime ? `<div class="k">${kpiLabel('Wake Time','الاستيقاظ')}</div><div class="v">${today.sleepDetail.waketime}</div>` : ''}
          <div class="k">${kpiLabel('Duration','المدة')}</div><div class="v">${h(today.sleepHours)}</div>
          <div class="k">${kpiLabel('Performance','الأداء')}</div><div class="v">${pct(today.sleepPerformancePct)}</div>
          <div class="k">${kpiLabel('Efficiency','الكفاءة')}</div><div class="v">${pct(today.efficiencyPct)}</div>
          <div class="k">${kpiLabel('Consistency','الانتظام')}</div><div class="v">${pct(today.consistencyPct)}</div>
          <div class="k">${kpiLabel('Respiratory Rate','معدل التنفس')}</div><div class="v">${today.respiratoryRate ? today.respiratoryRate.toFixed(1) + ' bpm' : '--'}</div>
          <div class="k">${kpiLabel('Sleep Cycles','دورات النوم')}</div><div class="v">${num(today.sleepCycles)}</div>
          <div class="k">${kpiLabel('Disturbances','الاضطرابات')}</div><div class="v">${num(today.disturbances)}</div>
        </div>
      </div>
      <div class="card recovery">
        <h3>${kpiLabel('Recovery','التعافي')}</h3>
        <div class="viz-container">${getCircleSvg(today.recoveryPct ?? 0, recoveryColor, pct(today.recoveryPct))}</div>
        <div class="rows" style="margin-top:auto;">
          <div class="k">${kpiLabel('HRV (RMSSD)','HRV')}</div><div class="v">${ms(today.hrvMs)}</div>
          <div class="k">${kpiLabel('Resting HR','النبض أثناء الراحة')}</div><div class="v">${bpm(today.rhrBpm)}</div>
          <div class="k">${kpiLabel('Blood Oxygen','الأكسجين')}</div><div class="v">${pct(today.spo2Pct)}</div>
          <div class="k">${kpiLabel('Skin Temp','حرارة الجلد')}</div><div class="v">${today.skinTempC ? today.skinTempC.toFixed(1) + '°C' : '--'}</div>
        </div>
      </div>
      <div class="card strain">
        <h3>${kpiLabel('Strain','الإجهاد')}</h3>
        <div class="viz-container">${getCircleSvg((today.dayStrain ?? 0) / 21 * 100, strainColor, num(today.dayStrain))}</div>
        <div class="rows" style="margin-top:auto;">
          <div class="k">${kpiLabel('Avg HR','متوسط النبض')}</div><div class="v">${bpm(today.workout?.avgHr)}</div>
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
        </div>
        ` : `<div class="rows"><div class="k">${kpiLabel('Status','الحالة')}</div><div class="v">${kpiLabel('No workout data available','لا توجد بيانات تمارين متاحة')}</div></div>`}
      </div>
    </div>

    <div class="ai">
      <h3>${kpiLabel('AI Daily Summary','ملخص اليوم (الذكاء الاصطناعي)')}</h3>
      <p>${ai?.daily_summary ?? (isRtl ? '—' : '—')}</p>
      ${ai?.tips && ai.tips.length ? `<ul class="tips">${ai.tips.slice(0,3).map(t=>`<li>${t}</li>`).join('')}</ul>` : ''}
    </div>
    <div class="footer-container">
      <div class="disclaimer">${disclaimer}</div>
      <div class="footer">WAKTI © 2025</div>
    </div>
  </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { backgroundColor: 'white', scale: 2, useCORS: true, allowTaint: true });
    const imgData = canvas.toDataURL('image/png');
    
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;
    
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Ensure the image fits on one page, if not, scale it down
    let finalImgHeight = imgHeight;
    if (imgHeight > (pageHeight - margin * 2)) {
      finalImgHeight = pageHeight - margin * 2;
    }

    doc.addImage(imgData, 'PNG', margin, margin, imgWidth, finalImgHeight);
    
    return doc.output('blob');

  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
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

      // Header with brand bar + logo (compact height)
      doc.setFillColor(6, 5, 65); // #060541
      doc.rect(0, 0, pageWidth, 24, 'F');
      // Try to render WAKTI logo on the left, fallback to text
      try {
        const logoUrl = 'https://raw.githubusercontent.com/alfadlyqtr/wakti-bilingual-assistant/main/public/lovable-uploads/4ed7b33a-201e-4f05-94de-bac892155c01.png';
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const dataUrl: string = await new Promise((res, rej) => {
          img.onload = () => {
            try {
              const c = document.createElement('canvas');
              c.width = img.width;
              c.height = img.height;
              const ctx = c.getContext('2d');
              if (!ctx) return rej(new Error('Canvas ctx null'));
              ctx.drawImage(img, 0, 0);
              res(c.toDataURL('image/png'));
            } catch (e) { rej(e); }
          };
          img.onerror = rej;
          img.src = logoUrl;
        });
        // place logo (smaller and higher)
        doc.addImage(dataUrl, 'PNG', 10, 5, 16, 16);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('WAKTI', 30, 16, { align: 'left' });
      } catch {
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('WAKTI', 14, 16, { align: 'left' });
      }

      yPosition = 34;
      doc.setTextColor(0, 0, 0);
      
      // Title
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(title, isRtl ? pageWidth - margin : margin, yPosition, { align: isRtl ? 'right' : 'left' });
      yPosition += 15;
      
      // Decide if this is a Tasjeel PDF (sidebar layout) to optionally skip the top gray metadata box
      const isTasjeelHeader = (metadata.type || '').toLowerCase().includes('tasjeel');

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
      
      if (!isTasjeelHeader) {
        // Add metadata with background
        doc.setFillColor(248, 249, 250);
        const metadataHeight = metadataItems.length * 7 + 10;
        doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, metadataHeight, 'F');
        metadataItems.forEach(item => {
          doc.text(item, isRtl ? pageWidth - margin - 5 : margin + 5, yPosition, { align: isRtl ? 'right' : 'left' });
          yPosition += 7;
        });
        yPosition += 15;
      } else {
        // Minimal spacing before content for Tasjeel
        yPosition += 6;
      }
      
      // Content section: Branch layouts
      if (content.text && content.text.trim()) {
        // Build a styled HTML from the summary content by detecting sections
        const summary = content.text.trim();
        const colorMap: Record<string, string> = {
          Overview: '#2563EB',
          'Main Points': '#7C3AED',
          Decisions: '#0EA5E9',
          'Action Items': '#F59E0B',
          'People / Organizations': '#475569',
          Locations: '#4F46E5',
          'Dates / Times': '#06B6D4',
          'Open Questions / Parking Lot': '#EC4899',
          // Arabic labels
          'نظرة عامة': '#2563EB',
          'النقاط الرئيسية': '#7C3AED',
          'القرارات': '#0EA5E9',
          'عناصر العمل': '#F59E0B',
          'الأسماء/المنظمات': '#475569',
          'المواقع': '#4F46E5',
          'التواريخ/الأوقات': '#06B6D4',
          'الأسئلة المفتوحة/المواضيع المؤجلة': '#EC4899',
        };

        // Simple parser: split lines, detect heading lines by known labels + colon
        const lines = summary.split(/\r?\n/);
        type SectionBlock = { title: string; items: string[] };
        const blocks: SectionBlock[] = [];
        let current: SectionBlock | null = null;

        const isHeading = (line: string) => {
          const clean = line.trim().replace(/^[-*•\s]+/, '');
          const headLabels = [
            'Overview', 'Main Points', 'Decisions', 'Action Items', 'People / Organizations', 'Locations', 'Dates / Times', 'Open Questions / Parking Lot',
            'نظرة عامة', 'النقاط الرئيسية', 'القرارات', 'عناصر العمل', 'الأسماء/المنظمات', 'المواقع', 'التواريخ/الأوقات', 'الأسئلة المفتوحة/المواضيع المؤجلة'
          ];
          for (const h of headLabels) {
            if (clean.toLowerCase().startsWith(h.toLowerCase())) return h;
          }
          return null;
        };

        for (const raw of lines) {
          const line = raw.trim();
          if (!line) continue;
          const h = isHeading(line);
          if (h) {
            current = { title: h, items: [] };
            blocks.push(current);
          } else {
            if (!current) {
              // Put initial text into Overview if none
              current = { title: isRtl ? 'نظرة عامة' : 'Overview', items: [] };
              blocks.push(current);
            }
            // Sanitize: remove leading list markers and markdown bold markers (**)
            const cleaned = line
              .replace(/^[-*•]\s*/, '')
              .replace(/\*\*(.+?)\*\*/g, '$1')
              .replace(/\*\*/g, '');
            current.items.push(cleaned);
          }
        }
        // Normalize/rename Parking Lot heading to Open Questions
        const normalizeTitle = (t: string) => {
          const tLow = t.toLowerCase();
          if (tLow.includes('parking lot')) return isRtl ? 'الأسئلة المفتوحة' : 'Open Questions';
          if (tLow.includes('open questions')) return isRtl ? 'الأسئلة المفتوحة' : 'Open Questions';
          return t;
        };
        const normalizedBlocks = blocks
          .map(b => ({ title: normalizeTitle(b.title), items: b.items.filter(it => it && it.trim().length > 0) }))
          .filter(b => b.items.length > 0);

        const isTasjeel = (metadata.type || '').toLowerCase().includes('tasjeel');

        // Build container for either default (existing) or Tasjeel Sidebar (Option B)
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '-9999px';
        container.style.width = `${(pageWidth - 2 * margin) * 3.78}px`;
        container.style.padding = '16px';
        container.style.background = 'white';
        container.style.fontFamily = isRtl ? 'Arial, "Segoe UI", Tahoma, sans-serif' : 'Inter, Arial, sans-serif';
        container.style.direction = isRtl ? 'rtl' : 'ltr';
        container.style.textAlign = isRtl ? 'right' : 'left';

        if (isTasjeel) {
          // Sidebar layout (25% meta, 75% content), compact headings
          const metaRows: string[] = [];
          metaRows.push(`<div>${isRtl ? 'النوع' : 'Type'}: ${metadata.type}</div>`);
          if (metadata.host) metaRows.push(`<div>${isRtl ? 'المضيف' : 'Host'}: ${metadata.host}</div>`);
          if (metadata.attendees) metaRows.push(`<div>${isRtl ? 'الحضور' : 'Attendees'}: ${metadata.attendees}</div>`);
          if (metadata.location) metaRows.push(`<div>${isRtl ? 'الموقع' : 'Location'}: ${metadata.location}</div>`);

          const sectionBlockHtml = (b: { title: string; items: string[] }) => `
            <div style="margin:0 0 10px 0">
              <div style="font-size:13px;font-weight:800;color:#111827;margin-bottom:6px;border-bottom:2px solid #CBD5E1;padding-bottom:4px">${b.title}</div>
              <ul style="font-size:12px;line-height:1.45;margin:${isRtl ? '0 16px 0 0' : '0 0 0 16px'}">
                ${b.items.map(it => `<li>${it}</li>`).join('')}
              </ul>
            </div>`;

          const rightHtml = normalizedBlocks.map(sectionBlockHtml).join('');
          const createdChip = format(new Date(metadata.createdAt), 'PPP', { locale });

          const sideBorderStyle = isRtl
            ? 'border-left:1px solid #E5E7EB;padding-left:12px'
            : 'border-right:1px solid #E5E7EB;padding-right:12px';

          container.innerHTML = `
            <div style="position:relative;border:2px solid #CBD5E1;border-radius:10px;padding:12px">
              <div style="display:grid;grid-template-columns:25% 1fr;gap:16px;align-items:start">
                <div style="${sideBorderStyle}">
                  <div style="font-size:12px;color:#6B7280;font-weight:700;margin-bottom:8px">${isRtl ? 'معلومات' : 'Meta'}</div>
                  <div style="display:flex;flex-direction:column;gap:6px;font-size:12px;color:#374151">${metaRows.join('')}</div>
                  <div style="font-size:11px;color:#94A3B8;margin-top:10px">${createdChip}</div>
                </div>
                <div>
                  ${rightHtml}
                </div>
              </div>
              <div style="position:absolute;${isRtl ? 'right' : 'left'}:calc(25% + 12px);top:12px;bottom:12px;${isRtl ? 'border-left' : 'border-right'}:2px solid #CBD5E1"></div>
            </div>`;
        } else {
          // Existing colorful blocks layout (non-Tasjeel)
          const sectionHtml = normalizedBlocks.map(b => {
            const color = colorMap[b.title] || '#1F2937';
            const itemsHtml = b.items.map(it => `<li>${it}</li>`).join('');
            return `
              <div style="margin-bottom:14px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.04)">
                <div style="background:${color};color:white;padding:8px 12px;font-weight:700">${b.title}</div>
                <div style="padding:12px 14px;font-size:14px;line-height:1.6">
                  ${itemsHtml ? `<ul style='margin:${isRtl ? '0 18px 0 0' : '0 0 0 18px'}'>${itemsHtml}</ul>` : ''}
                </div>
              </div>`;
          }).join('');

          const titleRow = `
            <div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
              <div style="font-size:18px;font-weight:800;color:#111827">${title}</div>
              <div style="font-size:12px;color:#6b7280">${format(new Date(metadata.createdAt), 'PPP', { locale })}</div>
            </div>`;

          const metaChips: string[] = [];
          metaChips.push(`${isRtl ? 'النوع' : 'Type'}: ${metadata.type}`);
          if (metadata.host) metaChips.push(`${isRtl ? 'المضيف' : 'Host'}: ${metadata.host}`);
          if (metadata.attendees) metaChips.push(`${isRtl ? 'الحضور' : 'Attendees'}: ${metadata.attendees}`);
          if (metadata.location) metaChips.push(`${isRtl ? 'الموقع' : 'Location'}: ${metadata.location}`);

          const chipsHtml = metaChips.map(c => `<span style="display:inline-block;padding:6px 10px;border-radius:9999px;background:#F3F4F6;color:#374151;font-size:12px;margin:${isRtl ? '0 0 6px 6px' : '0 6px 6px 0'}">${c}</span>`).join('');

          container.innerHTML = `
            <div>
              ${titleRow}
              <div style="margin-bottom:12px">${chipsHtml}</div>
              ${sectionHtml}
            </div>`;
        }

        document.body.appendChild(container);

        try {
          const canvas = await html2canvas(container, { backgroundColor: 'white', scale: 2, useCORS: true, allowTaint: true });
          if (document.body.contains(container)) document.body.removeChild(container);
          const imgData = canvas.toDataURL('image/png');
          // Scale-to-fit one page always (no additional pages)
          const maxW = pageWidth - 2 * margin;
          const maxH = pageHeight - 2 * margin - (yPosition - margin);
          let imgW = maxW;
          let imgH = (canvas.height * imgW) / canvas.width;
          if (imgH > maxH) {
            imgH = maxH;
            imgW = (canvas.width * imgH) / canvas.height;
          }
          doc.addImage(imgData, 'PNG', margin, yPosition, imgW, imgH);
        } catch (e) {
          if (document.body.contains(container)) document.body.removeChild(container);
          // Fallback to simple text
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);
          const linesFallback = summary.split('\n');
          for (const ln of linesFallback) {
            if (yPosition > pageHeight - margin - 10) { doc.addPage(); yPosition = margin; }
            doc.text(ln, isRtl ? pageWidth - margin - 5 : margin + 5, yPosition, { align: isRtl ? 'right' : 'left' });
            yPosition += 7;
          }
        }
      }
      
      // Footer: Powered by + current date
      const footerY = pageHeight - 15;
      doc.setFontSize(9);
      doc.setTextColor(102, 102, 102);
      const dateStr = format(new Date(), 'PPP', { locale });
      const footerText = isRtl ? `مشغّل بواسطة WAKTI AI • ${dateStr}` : `Powered by WAKTI AI • ${dateStr}`;
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
