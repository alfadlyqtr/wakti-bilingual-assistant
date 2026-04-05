import { useState, useEffect, useCallback } from 'react';

export type TextSize = 'normal' | 'large' | 'xlarge';

export const TEXT_SIZE_STORAGE_KEY = 'wakti_text_size';

const TEXT_SIZE_MAP: Record<TextSize, string> = {
  normal: '100%',
  large:  '115%',
  xlarge: '130%',
};

/**
 * Applies a font-size percentage to <html> root.
 * All rem-based text in the app (Tailwind text-* classes) scales automatically.
 * Called synchronously at boot to prevent flicker, and on every change.
 */
export function applyTextSize(size: TextSize) {
  document.documentElement.style.fontSize = TEXT_SIZE_MAP[size];
}

export function useTextSize() {
  const [textSize, setTextSizeState] = useState<TextSize>(() => {
    try {
      const saved = localStorage.getItem(TEXT_SIZE_STORAGE_KEY);
      if (saved === 'normal' || saved === 'large' || saved === 'xlarge') return saved;
    } catch {}
    return 'normal';
  });

  useEffect(() => {
    applyTextSize(textSize);
  }, [textSize]);

  const setTextSize = useCallback((size: TextSize) => {
    try { localStorage.setItem(TEXT_SIZE_STORAGE_KEY, size); } catch {}
    setTextSizeState(size);
    applyTextSize(size);
  }, []);

  return { textSize, setTextSize };
}
