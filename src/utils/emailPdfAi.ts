import { decodeBase64ToArrayBuffer } from '@/utils/emailAttachmentDownload';

let pdfjsLibPromise: Promise<any> | null = null;

async function loadPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([lib, workerUrl]) => {
      lib.GlobalWorkerOptions.workerSrc = workerUrl.default;
      return lib;
    });
  }
  return pdfjsLibPromise;
}

export function isPdfAttachment(input: { name?: string | null; contentType?: string | null }) {
  const name = String(input.name || '').toLowerCase();
  const contentType = String(input.contentType || '').toLowerCase();
  return contentType.includes('application/pdf') || name.endsWith('.pdf');
}

export async function extractPdfTextFromBase64(content: string, options?: { maxPages?: number; maxCharacters?: number }) {
  const maxPages = Math.max(1, options?.maxPages || 10);
  const maxCharacters = Math.max(500, options?.maxCharacters || 16000);
  const pdfjsLib = await loadPdfjs();
  const arrayBuffer = decodeBase64ToArrayBuffer(content);
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const pagesToRead = Math.min(pdf.numPages, maxPages);
  const parts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = Array.isArray(textContent.items)
      ? textContent.items
          .map((item: any) => (typeof item?.str === 'string' ? item.str : ''))
          .filter(Boolean)
          .join(' ')
      : '';

    const trimmedPageText = pageText.replace(/\s+/g, ' ').trim();
    if (trimmedPageText) {
      parts.push(trimmedPageText);
    }

    if (parts.join('\n\n').length >= maxCharacters) {
      break;
    }
  }

  const text = parts.join('\n\n').slice(0, maxCharacters).trim();
  return {
    text,
    pagesRead: pagesToRead,
    totalPages: pdf.numPages,
    truncated: parts.join('\n\n').length > maxCharacters || pdf.numPages > pagesToRead,
  };
}
