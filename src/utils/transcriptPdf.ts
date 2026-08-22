import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface TranscriptPdfOptions {
  content: string;
  videoUrl?: string | null;
  language: string;
  // 'transcript' = video transcript sheet · 'answer' = any chat answer shared as PDF
  kind?: 'transcript' | 'answer';
}

// Escape user/model text before placing it into the HTML shell
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Page geometry (CSS px at A4 ratio 210:297)
const PAGE_W = 794;
const PAGE_H = 1122;
const PAGE_PAD_X = 36;
const HEADER_H = 64;
const FOOTER_H = 44;
const CONTENT_H = PAGE_H - HEADER_H - FOOTER_H - 24; // 24 = breathing room

// Turn one content line into styled HTML: ## headers, **bold**, bullets, [MM:SS] sections
function lineToBlockHtml(line: string, isArabic: boolean): string {
  const dir = `direction:${isArabic ? 'rtl' : 'ltr'};text-align:${isArabic ? 'right' : 'left'};`;
  const escaped = escapeHtml(line).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // ## markdown section header
  if (/^#{1,3}\s/.test(line)) {
    const text = escapeHtml(line.replace(/^#{1,3}\s+/, '')).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return `<div style="margin:14px 0 4px;padding:6px 12px;background:linear-gradient(135deg,#060541 0%,#2a2670 100%);color:#f2f2f2;border-radius:8px;font-weight:700;font-size:14px;${dir}">${text}</div>`;
  }
  // [MM:SS - MM:SS] transcript section header
  if (/^\[\d{1,2}:\d{2}(\s*-\s*\d{1,2}:\d{2})?\]/.test(line)) {
    return `<div style="margin-top:14px;padding:6px 12px;background:linear-gradient(135deg,#060541 0%,#2a2670 100%);color:#f2f2f2;border-radius:8px;font-weight:700;font-size:13px;${dir}">${escaped}</div>`;
  }
  // bullet
  if (/^[-*•]\s+/.test(line)) {
    const text = escapeHtml(line.replace(/^[-*•]\s+/, '')).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return `<div style="margin:3px 0;padding-left:16px;font-size:13px;line-height:1.65;color:#1f2430;${dir}"><span style="color:#060541;">•</span>&nbsp;${text}</div>`;
  }
  // plain paragraph
  return `<p style="margin:5px 0;font-size:13px;line-height:1.7;color:#1f2430;${dir}">${escaped}</p>`;
}

// Split content into unbreakable blocks (a block never splits across pages).
// Very long lines are chunked at sentence boundaries so nothing overflows a page.
function contentToBlocks(content: string, isArabic: boolean): string[] {
  const blocks: string[] = [];
  for (const rawLine of (content || '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.length > 900) {
      // chunk long paragraphs at sentence ends
      const sentences = line.match(/[^.!?؟]+[.!?؟]*/g) || [line];
      let buf = '';
      for (const s of sentences) {
        if ((buf + s).length > 800 && buf) { blocks.push(buf.trim()); buf = s; }
        else buf += s;
      }
      if (buf.trim()) blocks.push(buf.trim());
    } else {
      blocks.push(line);
    }
  }
  return blocks;
}

function buildPageShell(opts: {
  subtitle: string;
  today: string;
  videoUrl?: string | null;
  pageNum: number;
  totalPages: number;
  isArabic: boolean;
  isFirst: boolean;
}): { shell: HTMLDivElement; body: HTMLDivElement } {
  const { subtitle, today, videoUrl, pageNum, totalPages, isArabic, isFirst } = opts;
  const shell = document.createElement('div');
  shell.style.cssText = `width:${PAGE_W}px;height:${PAGE_H}px;background:#fcfefd;font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Arabic",Tahoma,sans-serif;display:flex;flex-direction:column;overflow:hidden;`;
  shell.innerHTML = `
    <div style="height:${HEADER_H}px;background:linear-gradient(135deg,#060541 0%,#2a2670 60%,#060541 100%);padding:0 ${PAGE_PAD_X}px;display:flex;align-items:center;justify-content:space-between;direction:ltr;flex-shrink:0;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;color:#f2f2f2;font-weight:800;font-size:14px;">W</div>
        <div>
          <span style="color:#f2f2f2;font-size:15px;font-weight:800;letter-spacing:0.5px;">WAKTI AI</span>
          <span style="color:#e9ceb0;font-size:11px;margin-left:8px;">${subtitle}</span>
        </div>
      </div>
      <div style="color:#858384;font-size:10px;text-align:right;">${today}<br/>wakti.qa</div>
    </div>
    ${isFirst && videoUrl ? `<div style="padding:8px ${PAGE_PAD_X}px;background:#f5f3ec;border-bottom:1px solid #e5e2d8;font-size:10px;color:#606062;direction:ltr;word-break:break-all;flex-shrink:0;">${escapeHtml(videoUrl)}</div>` : ''}
    <div data-body style="flex:1;overflow:hidden;padding:12px ${PAGE_PAD_X}px;"></div>
    <div style="height:${FOOTER_H}px;border-top:1px solid #e5e2d8;display:flex;align-items:center;justify-content:space-between;padding:0 ${PAGE_PAD_X}px;font-size:10px;color:#858384;flex-shrink:0;direction:ltr;">
      <span>WAKTI AI · wakti.qa</span>
      <span>${isArabic ? `صفحة ${pageNum} من ${totalPages}` : `Page ${pageNum} of ${totalPages}`}</span>
    </div>
  `;
  return { shell, body: shell.querySelector('[data-body]') as HTMLDivElement };
}

/**
 * Branded Wakti PDF export (transcripts + any chat answer).
 * Real pagination: content flows in unbreakable blocks — no sliced text, no seams.
 * Every page carries the Wakti header, footer, and page numbers.
 * html2canvas renders each page (Arabic/RTL renders perfectly).
 */
export async function downloadTranscriptPdf({ content, videoUrl, language, kind = 'transcript' }: TranscriptPdfOptions): Promise<void> {
  const isArabic = language === 'ar';
  const isTranscript = kind === 'transcript';
  const subtitle = isTranscript
    ? (isArabic ? 'تفريغ فيديو' : 'Video Transcript')
    : (isArabic ? 'إجابة من وقتي' : 'Wakti Answer');
  const filePrefix = isTranscript ? 'wakti-transcript' : 'wakti-answer';
  const today = new Date().toLocaleDateString(isArabic ? 'ar-QA' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' });

  // 1) Content → unbreakable HTML blocks
  const blocks = contentToBlocks(content, isArabic);

  // 2) Measure each block's real height at final width (offscreen measurer)
  const measurer = document.createElement('div');
  measurer.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_W - PAGE_PAD_X * 2}px;font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Arabic",Tahoma,sans-serif;`;
  document.body.appendChild(measurer);

  const pageBlockSets: string[][] = [];
  let currentSet: string[] = [];
  let usedH = 0;
  try {
    for (const block of blocks) {
      const html = lineToBlockHtml(block, isArabic);
      measurer.innerHTML = html;
      const blockEl = measurer.firstElementChild as HTMLElement | null;
      const h = blockEl ? blockEl.offsetHeight : 24;
      if (usedH + h > CONTENT_H && currentSet.length > 0) {
        pageBlockSets.push(currentSet);
        currentSet = [];
        usedH = 0;
      }
      currentSet.push(html);
      usedH += h;
    }
    if (currentSet.length > 0) pageBlockSets.push(currentSet);
  } finally {
    document.body.removeChild(measurer);
  }
  if (pageBlockSets.length === 0) pageBlockSets.push(['<p style="color:#858384;font-size:13px;">—</p>']);

  // 3) Render each page (its own canvas → its own PDF page — nothing ever slices text)
  const pdf = new jsPDF('p', 'mm', 'a4');
  const totalPages = pageBlockSets.length;

  for (let i = 0; i < totalPages; i++) {
    const { shell, body } = buildPageShell({
      subtitle,
      today,
      videoUrl: i === 0 ? videoUrl : null,
      pageNum: i + 1,
      totalPages,
      isArabic,
      isFirst: i === 0,
    });
    body.innerHTML = pageBlockSets[i].join('');
    shell.style.position = 'fixed';
    shell.style.left = '-10000px';
    shell.style.top = '0';
    document.body.appendChild(shell);
    try {
      const canvas = await html2canvas(shell, { scale: 2, backgroundColor: '#fcfefd', useCORS: true });
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
    } finally {
      document.body.removeChild(shell);
    }
  }

  pdf.save(`${filePrefix}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
