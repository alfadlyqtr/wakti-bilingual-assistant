/**
 * Safe clipboard copy utility.
 * - Decodes URL-encoded text before copying (fixes Natively/mobile encoding issues)
 * - Strips AI "Notes on improvements" sections from generated text
 * - Works across web and Natively wrapper
 */

/** Decode URL-encoded plain text (not actual URLs) */
function decodeIfEncoded(text: string): string {
  try {
    const trimmed = text.trim();
    if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) return text;
    if (/%0A|%20|%0D|%09/i.test(text)) {
      return decodeURIComponent(text);
    }
  } catch {
    try {
      return decodeURIComponent(text.replace(/\+/g, ' '));
    } catch {
      // fall through
    }
  }
  return text;
}

/** Copy text to clipboard with URL-decoding safety */
export async function safeCopyToClipboard(text: string): Promise<boolean> {
  const cleaned = decodeIfEncoded(text);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(cleaned);
      return true;
    }
  } catch {
    // fallback below
  }
  // Fallback for environments where clipboard API fails
  try {
    const ta = document.createElement('textarea');
    ta.value = cleaned;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}
