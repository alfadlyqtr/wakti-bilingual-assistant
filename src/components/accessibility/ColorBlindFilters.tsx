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

/**
 * Invisible SVG element that defines the Daltonization filter matrices.
 * Based on LMS color space transformations from Machado et al. (2009).
 * These are hardware-accelerated by the browser GPU — zero JS per-pixel loops.
 *
 * Applied globally via: filter: url(#daltonize-protanopia) on document.documentElement
 */
export function ColorBlindFilters() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
    >
      <defs>
        {/* ─── PROTANOPIA: Missing L-cone (Red-blind) ─────────────────────────
            Daltonization: lost red data is shifted into green/blue channels.
            Red objects become vivid blue/teal — distinguishable from green.
        */}
        <filter id="daltonize-protanopia" colorInterpolationFilters="linearRGB">
          <feColorMatrix
            type="matrix"
            values="0.152286 1.052583 -0.204868 0 0
                    0.114503 0.786281 0.099216 0 0
                    -0.003882 -0.048116 1.051998 0 0
                    0        0        0        1 0"
          />
        </filter>

        {/* ─── DEUTERANOPIA: Missing M-cone (Green-blind) ─────────────────────
            Daltonization: lost green data is shifted into red/blue channels.
            Green objects shift toward yellow/orange — distinguishable from red.
        */}
        <filter id="daltonize-deuteranopia" colorInterpolationFilters="linearRGB">
          <feColorMatrix
            type="matrix"
            values="0.367322 0.860646 -0.227968 0 0
                    0.280085 0.672501 0.047413 0 0
                    -0.011820 0.042940 0.968881 0 0
                    0        0        0        1 0"
          />
        </filter>

        {/* ─── TRITANOPIA: Missing S-cone (Blue-blind) ────────────────────────
            Daltonization: lost blue data is shifted into red/green channels.
            Blue objects shift toward red/pink — distinguishable from yellow.
        */}
        <filter id="daltonize-tritanopia" colorInterpolationFilters="linearRGB">
          <feColorMatrix
            type="matrix"
            values="1.255528 -0.076749 -0.178779 0 0
                    -0.078411  0.930809  0.147602 0 0
                    0.004733   0.691367  0.303900 0 0
                    0          0         0        1 0"
          />
        </filter>
      </defs>
    </svg>
  );
}

export function applyColorBlindFilter(mode: ColorBlindMode) {
  const root = document.documentElement;
  root.removeAttribute('data-cvd');
  root.style.removeProperty('filter');

  if (mode === 'none') return;

  root.setAttribute('data-cvd', mode);
  root.style.filter = `url(#daltonize-${mode})`;
}
