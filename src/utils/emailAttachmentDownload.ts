export interface EmailMessageAttachment {
  id: string;
  name: string;
  contentType?: string | null;
  size?: number | null;
  inline?: boolean;
}

export interface EmailMessageAttachmentContent {
  content: string;
  name: string;
  contentType?: string | null;
  size?: number | null;
}

export function decodeBase64ToBytes(content: string) {
  const normalized = content.replace(/\s+/g, '');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function decodeBase64ToArrayBuffer(content: string) {
  const bytes = decodeBase64ToBytes(content);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export function downloadEmailAttachment(input: {
  content: string;
  name: string;
  contentType?: string | null;
}) {
  const bytes = decodeBase64ToBytes(input.content);
  const blob = new Blob([bytes], {
    type: input.contentType || 'application/octet-stream',
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = input.name || 'attachment';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export function formatAttachmentSize(size?: number | null) {
  if (!size || !Number.isFinite(size) || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
