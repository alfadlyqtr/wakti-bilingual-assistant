import { useEffect, useRef } from 'react';

export type ColorBlindMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';

export const COLOR_BLIND_MODES: { value: ColorBlindMode; labelEn: string; labelAr: string; description: string; descriptionAr: string }[] = [
  {
    value: 'none',
    labelEn: 'Default Vision',
    labelAr: 'الرؤية الافتراضية',
    description: 'No filter applied',
    descriptionAr: 'بدون فلتر',
  },
  {
    value: 'protanopia',
    labelEn: 'Protanopia (Red-Blind)',
    labelAr: 'عمى اللون الأحمر',
    description: 'Missing L-cones. Reds appear dark; reds and greens are confused.',
    descriptionAr: 'غياب المستقبلات الحمراء. يظهر الأحمر داكناً ويُخلط مع الأخضر.',
  },
  {
    value: 'deuteranopia',
    labelEn: 'Deuteranopia (Green-Blind)',
    labelAr: 'عمى اللون الأخضر',
    description: 'Missing M-cones. Reds, greens, and yellows look similar.',
    descriptionAr: 'غياب المستقبلات الخضراء. يصعب التمييز بين الأحمر والأخضر والأصفر.',
  },
  {
    value: 'tritanopia',
    labelEn: 'Tritanopia (Blue-Blind)',
    labelAr: 'عمى اللون الأزرق',
    description: 'Missing S-cones. Blues appear green; yellows appear pink.',
    descriptionAr: 'غياب المستقبلات الزرقاء. يظهر الأزرق أخضراً والأصفر وردياً.',
  },
];

export const STORAGE_KEY = 'wakti_color_blind_mode';

const SVG_ID = 'wakti-cvd-filters';

const filterSvg = `<svg id="${SVG_ID}" aria-hidden="true" focusable="false"
  xmlns="http://www.w3.org/2000/svg"
  style="position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;">
  <defs>
    <filter id="daltonize-protanopia" color-interpolation-filters="linearRGB" x="0%" y="0%" width="100%" height="100%">
      <feColorMatrix type="matrix"
        values="0.152286 1.052583 -0.204868 0 0
                0.114503 0.786281 0.099216 0 0
               -0.003882 -0.048116 1.051998 0 0
                0 0 0 1 0"/>
    </filter>
    <filter id="daltonize-deuteranopia" color-interpolation-filters="linearRGB" x="0%" y="0%" width="100%" height="100%">
      <feColorMatrix type="matrix"
        values="0.367322 0.860646 -0.227968 0 0
                0.280085 0.672501 0.047413 0 0
               -0.011820 0.042940 0.968881 0 0
                0 0 0 1 0"/>
    </filter>
    <filter id="daltonize-tritanopia" color-interpolation-filters="linearRGB" x="0%" y="0%" width="100%" height="100%">
      <feColorMatrix type="matrix"
        values="1.255528 -0.076749 -0.178779 0 0
               -0.078411  0.930809  0.147602 0 0
                0.004733  0.691367  0.303900 0 0
                0 0 0 1 0"/>
    </filter>
  </defs>
</svg>`;

/**
 * Injects the Daltonization SVG filter defs as the very first child of <body>.
 * Using a raw DOM injection (not React portal) guarantees the SVG exists before
 * any filter: url(#...) reference is resolved by the browser — critical for
 * iOS Safari, Android WebView, and all Chromium-based browsers.
 */
export function ColorBlindFilters() {
  const injectedRef = useRef(false);

  useEffect(() => {
    if (injectedRef.current) return;
    injectedRef.current = true;

    if (document.getElementById(SVG_ID)) return;

    const container = document.createElement('div');
    container.innerHTML = filterSvg;
    const svgEl = container.firstElementChild;
    if (svgEl) {
      document.body.insertBefore(svgEl, document.body.firstChild);
    }

    return () => {
      document.getElementById(SVG_ID)?.remove();
      injectedRef.current = false;
    };
  }, []);

  return null;
}

const FILTER_ATTR = 'data-cvd';

export function applyColorBlindFilter(mode: ColorBlindMode) {
  // Target #root (not body) to avoid iOS Safari stacking context bug.
  // When filter is on <body>, iOS creates a new stacking context which breaks
  // all position:fixed children (mobile nav, chat input, dialogs, modals).
  // #root wraps all visible app content so the filter covers 100% of the UI.
  const root = document.getElementById('root') ?? document.body;

  root.removeAttribute(FILTER_ATTR);
  root.style.removeProperty('filter');
  (root.style as any)['-webkit-filter'] = '';

  if (mode === 'none') return;

  const filterValue = `url(#daltonize-${mode})`;

  root.setAttribute(FILTER_ATTR, mode);
  // Set both standard and -webkit- prefix for Safari 9-14 compatibility
  root.style.setProperty('filter', filterValue);
  (root.style as any)['-webkit-filter'] = filterValue;
}
