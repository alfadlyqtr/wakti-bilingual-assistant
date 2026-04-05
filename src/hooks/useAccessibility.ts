import { useState, useEffect, useCallback } from 'react';
import { type ColorBlindMode, STORAGE_KEY, applyColorBlindFilter } from '@/components/accessibility/ColorBlindFilters';

export function useAccessibility() {
  const [colorBlindMode, setColorBlindModeState] = useState<ColorBlindMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'protanopia' || saved === 'deuteranopia' || saved === 'tritanopia') return saved;
    } catch {}
    return 'none';
  });

  useEffect(() => {
    applyColorBlindFilter(colorBlindMode);
  }, [colorBlindMode]);

  const setColorBlindMode = useCallback((mode: ColorBlindMode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {}
    setColorBlindModeState(mode);
    applyColorBlindFilter(mode);
  }, []);

  return { colorBlindMode, setColorBlindMode };
}
