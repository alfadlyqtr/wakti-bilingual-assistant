/**
 * Saves one or more images to the user's device.
 *
 * Order matters here. Inside a native WebView (the Natively shell) a plain `<a download>`
 * link is frequently swallowed and the user sees nothing happen, so the Web Share sheet is
 * tried first — that is what gives a real "Save to Photos" option on iOS and Android.
 * Desktop browsers do not support sharing files, so they fall through to the download link.
 */
export async function saveImagesToDevice(items: { url: string; fileName: string }[]): Promise<void> {
  if (!items.length) return;

  const files: File[] = [];
  for (const item of items) {
    try {
      const response = await fetch(item.url);
      if (!response.ok) continue;
      const blob = await response.blob();
      files.push(new File([blob], item.fileName, { type: blob.type || 'image/jpeg' }));
    } catch {
      // Unreachable image; handled by the last-resort branch below.
    }
  }

  const nav = typeof navigator !== 'undefined'
    ? navigator as Navigator & {
        canShare?: (data: { files?: File[] }) => boolean;
        share?: (data: { files?: File[] }) => Promise<void>;
      }
    : null;

  if (files.length && nav?.share && nav.canShare?.({ files })) {
    try {
      await nav.share({ files });
      return;
    } catch (error) {
      // The user dismissing the share sheet is a deliberate cancel, not a failure to retry.
      if ((error as Error)?.name === 'AbortError') return;
    }
  }

  if (files.length) {
    for (const file of files) {
      const objectUrl = URL.createObjectURL(file);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = file.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    }
    return;
  }

  // Could not read the bytes at all: hand the image to the browser so the user still
  // has a long-press "save image" route.
  window.open(items[0].url, '_blank', 'noopener');
}

/** Builds a tidy, filesystem-safe file name for a render. */
export function renderFileName(label: string, position: number): string {
  const slug = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `wakti-design-${slug || position}.jpg`;
}
