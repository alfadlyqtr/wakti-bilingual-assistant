// Tab 2 — the 2D furniture symbol catalogue.
//
// ⛔ WHY SHAPES ARE DATA AND NOT JSX:
// Every symbol is a list of primitive shapes in a normalised 0..1 box. That lets the SAME
// definition be drawn by the SVG editor on screen and by the offscreen canvas rasterizer that
// feeds the image model. If these were JSX, the rasterizer would need a second hand-written copy
// of all 44 symbols and the two would drift apart within a week.
//
// Orientation: 0,0 is the top-left of the item's own box, and every symbol is drawn facing UP
// (its back against y=0). Rotation is applied by the renderer, never baked into the shapes.

export type PlanShape =
  | { k: 'rect'; x: number; y: number; w: number; h: number; r?: number; fill?: boolean }
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { k: 'circle'; cx: number; cy: number; r: number; fill?: boolean }
  | { k: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill?: boolean }
  /** Angles in degrees, 0 pointing right, sweeping clockwise. */
  | { k: 'arc'; cx: number; cy: number; r: number; from: number; to: number }
  | { k: 'poly'; points: number[]; close?: boolean; fill?: boolean };

export type FurnitureCategory =
  | 'living'
  | 'dining'
  | 'bedroom'
  | 'kitchen'
  | 'bathroom'
  | 'work'
  | 'gym'
  | 'structure'
  | 'decor';

export type FurnitureSymbol = {
  id: string;
  category: FurnitureCategory;
  en: string;
  ar: string;
  /** Real-world default size in metres, so items land at a believable scale. */
  widthM: number;
  depthM: number;
  shapes: PlanShape[];
};

export const FURNITURE_CATEGORIES: Array<{ id: FurnitureCategory; en: string; ar: string }> = [
  { id: 'living', en: 'Living', ar: 'الجلوس' },
  { id: 'dining', en: 'Dining', ar: 'الطعام' },
  { id: 'bedroom', en: 'Bedroom', ar: 'النوم' },
  { id: 'kitchen', en: 'Kitchen', ar: 'المطبخ' },
  { id: 'bathroom', en: 'Bathroom', ar: 'الحمام' },
  { id: 'work', en: 'Work', ar: 'المكتب' },
  { id: 'gym', en: 'Gym', ar: 'الرياضة' },
  { id: 'structure', en: 'Structure', ar: 'إنشائي' },
  { id: 'decor', en: 'Decor', ar: 'ديكور' },
];

/** Seat cushions evenly spread across a sofa's width. */
const cushions = (count: number, top: number, bottom: number): PlanShape[] => (
  Array.from({ length: count }, (_, index) => ({
    k: 'rect' as const,
    x: 0.08 + index * ((0.84) / count),
    y: top,
    w: 0.84 / count - 0.02,
    h: bottom - top,
    r: 0.04,
  }))
);

/** Chairs tucked around a rectangular table. */
const chairsAround = (perSide: number): PlanShape[] => {
  const shapes: PlanShape[] = [];
  for (let index = 0; index < perSide; index += 1) {
    const x = 0.14 + index * (0.72 / Math.max(1, perSide - 1)) - 0.06;
    shapes.push({ k: 'rect', x, y: 0.0, w: 0.12, h: 0.1, r: 0.03 });
    shapes.push({ k: 'rect', x, y: 0.9, w: 0.12, h: 0.1, r: 0.03 });
  }
  return shapes;
};

export const FURNITURE_SYMBOLS: FurnitureSymbol[] = [
  // ---------------------------------------------------------------- living
  {
    id: 'sofa-3',
    category: 'living',
    en: '3-seat sofa',
    ar: 'كنبة ٣ مقاعد',
    widthM: 2.2,
    depthM: 0.9,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.08 },
      { k: 'rect', x: 0.06, y: 0, w: 0.88, h: 0.24, r: 0.06 },
      { k: 'rect', x: 0, y: 0.1, w: 0.08, h: 0.9, r: 0.04 },
      { k: 'rect', x: 0.92, y: 0.1, w: 0.08, h: 0.9, r: 0.04 },
      ...cushions(3, 0.26, 0.94),
    ],
  },
  {
    id: 'sofa-2',
    category: 'living',
    en: '2-seat sofa',
    ar: 'كنبة مقعدين',
    widthM: 1.6,
    depthM: 0.9,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.08 },
      { k: 'rect', x: 0.06, y: 0, w: 0.88, h: 0.26, r: 0.06 },
      { k: 'rect', x: 0, y: 0.1, w: 0.09, h: 0.9, r: 0.04 },
      { k: 'rect', x: 0.91, y: 0.1, w: 0.09, h: 0.9, r: 0.04 },
      ...cushions(2, 0.28, 0.94),
    ],
  },
  {
    id: 'armchair',
    category: 'living',
    en: 'Armchair',
    ar: 'كرسي وثير',
    widthM: 0.85,
    depthM: 0.85,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.12 },
      { k: 'rect', x: 0.08, y: 0, w: 0.84, h: 0.26, r: 0.08 },
      { k: 'rect', x: 0, y: 0.12, w: 0.14, h: 0.88, r: 0.06 },
      { k: 'rect', x: 0.86, y: 0.12, w: 0.14, h: 0.88, r: 0.06 },
      { k: 'rect', x: 0.16, y: 0.3, w: 0.68, h: 0.62, r: 0.08 },
    ],
  },
  {
    id: 'majlis-bench',
    category: 'living',
    en: 'Majlis bench',
    ar: 'مجلس أرضي',
    widthM: 3,
    depthM: 0.75,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.03 },
      { k: 'rect', x: 0, y: 0, w: 1, h: 0.3 },
      ...cushions(5, 0.34, 0.94),
    ],
  },
  {
    id: 'coffee-table',
    category: 'living',
    en: 'Coffee table',
    ar: 'طاولة قهوة',
    widthM: 1.2,
    depthM: 0.6,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.12 },
      { k: 'rect', x: 0.12, y: 0.18, w: 0.76, h: 0.64, r: 0.08 },
    ],
  },
  {
    id: 'side-table',
    category: 'living',
    en: 'Side table',
    ar: 'طاولة جانبية',
    widthM: 0.5,
    depthM: 0.5,
    shapes: [
      { k: 'circle', cx: 0.5, cy: 0.5, r: 0.48 },
      { k: 'circle', cx: 0.5, cy: 0.5, r: 0.16 },
    ],
  },
  {
    id: 'tv-unit',
    category: 'living',
    en: 'TV unit',
    ar: 'وحدة تلفاز',
    widthM: 2,
    depthM: 0.45,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.03 },
      { k: 'line', x1: 0.33, y1: 0, x2: 0.33, y2: 1 },
      { k: 'line', x1: 0.66, y1: 0, x2: 0.66, y2: 1 },
      { k: 'rect', x: 0.2, y: 0.3, w: 0.6, h: 0.14, fill: true },
    ],
  },
  {
    id: 'bookshelf',
    category: 'living',
    en: 'Bookshelf',
    ar: 'مكتبة',
    widthM: 1.6,
    depthM: 0.35,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1 },
      { k: 'line', x1: 0.25, y1: 0, x2: 0.25, y2: 1 },
      { k: 'line', x1: 0.5, y1: 0, x2: 0.5, y2: 1 },
      { k: 'line', x1: 0.75, y1: 0, x2: 0.75, y2: 1 },
    ],
  },
  {
    id: 'console',
    category: 'living',
    en: 'Console table',
    ar: 'كونسول',
    widthM: 1.3,
    depthM: 0.4,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.04 },
      { k: 'line', x1: 0, y1: 0.6, x2: 1, y2: 0.6 },
    ],
  },
  {
    id: 'rug',
    category: 'living',
    en: 'Rug',
    ar: 'سجادة',
    widthM: 3,
    depthM: 2,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.02 },
      { k: 'rect', x: 0.05, y: 0.07, w: 0.9, h: 0.86, r: 0.02 },
      { k: 'rect', x: 0.12, y: 0.17, w: 0.76, h: 0.66, r: 0.02 },
    ],
  },

  // ---------------------------------------------------------------- dining
  {
    id: 'dining-6',
    category: 'dining',
    en: 'Dining table 6',
    ar: 'طاولة طعام ٦',
    widthM: 1.8,
    depthM: 1,
    shapes: [
      { k: 'rect', x: 0.1, y: 0.14, w: 0.8, h: 0.72, r: 0.05 },
      ...chairsAround(3),
    ],
  },
  {
    id: 'dining-8',
    category: 'dining',
    en: 'Dining table 8',
    ar: 'طاولة طعام ٨',
    widthM: 2.4,
    depthM: 1.1,
    shapes: [
      { k: 'rect', x: 0.08, y: 0.14, w: 0.84, h: 0.72, r: 0.04 },
      ...chairsAround(4),
    ],
  },
  {
    id: 'dining-round',
    category: 'dining',
    en: 'Round table 4',
    ar: 'طاولة دائرية ٤',
    widthM: 1.2,
    depthM: 1.2,
    shapes: [
      { k: 'circle', cx: 0.5, cy: 0.5, r: 0.34 },
      { k: 'rect', x: 0.42, y: 0, w: 0.16, h: 0.11, r: 0.04 },
      { k: 'rect', x: 0.42, y: 0.89, w: 0.16, h: 0.11, r: 0.04 },
      { k: 'rect', x: 0, y: 0.42, w: 0.11, h: 0.16, r: 0.04 },
      { k: 'rect', x: 0.89, y: 0.42, w: 0.11, h: 0.16, r: 0.04 },
    ],
  },
  {
    id: 'chair',
    category: 'dining',
    en: 'Chair',
    ar: 'كرسي',
    widthM: 0.45,
    depthM: 0.45,
    shapes: [
      { k: 'rect', x: 0.1, y: 0.18, w: 0.8, h: 0.8, r: 0.06 },
      { k: 'rect', x: 0.06, y: 0, w: 0.88, h: 0.16, r: 0.05 },
    ],
  },
  {
    id: 'sideboard',
    category: 'dining',
    en: 'Sideboard',
    ar: 'بوفيه',
    widthM: 1.8,
    depthM: 0.45,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.03 },
      { k: 'line', x1: 0.5, y1: 0, x2: 0.5, y2: 1 },
      { k: 'circle', cx: 0.42, cy: 0.5, r: 0.04, fill: true },
      { k: 'circle', cx: 0.58, cy: 0.5, r: 0.04, fill: true },
    ],
  },

  // ---------------------------------------------------------------- bedroom
  {
    id: 'bed-king',
    category: 'bedroom',
    en: 'King bed',
    ar: 'سرير كبير',
    widthM: 2,
    depthM: 2.1,
    shapes: [
      { k: 'rect', x: 0, y: 0.06, w: 1, h: 0.94, r: 0.04 },
      { k: 'rect', x: 0, y: 0, w: 1, h: 0.08, r: 0.02 },
      { k: 'rect', x: 0.06, y: 0.1, w: 0.4, h: 0.2, r: 0.06 },
      { k: 'rect', x: 0.54, y: 0.1, w: 0.4, h: 0.2, r: 0.06 },
      { k: 'line', x1: 0, y1: 0.42, x2: 1, y2: 0.42 },
    ],
  },
  {
    id: 'bed-single',
    category: 'bedroom',
    en: 'Single bed',
    ar: 'سرير مفرد',
    widthM: 1,
    depthM: 2,
    shapes: [
      { k: 'rect', x: 0, y: 0.06, w: 1, h: 0.94, r: 0.05 },
      { k: 'rect', x: 0, y: 0, w: 1, h: 0.08, r: 0.02 },
      { k: 'rect', x: 0.14, y: 0.11, w: 0.72, h: 0.2, r: 0.07 },
      { k: 'line', x1: 0, y1: 0.44, x2: 1, y2: 0.44 },
    ],
  },
  {
    id: 'nightstand',
    category: 'bedroom',
    en: 'Nightstand',
    ar: 'كومودينو',
    widthM: 0.45,
    depthM: 0.4,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.08 },
      { k: 'line', x1: 0.2, y1: 0.6, x2: 0.8, y2: 0.6 },
    ],
  },
  {
    id: 'wardrobe',
    category: 'bedroom',
    en: 'Wardrobe',
    ar: 'خزانة',
    widthM: 2,
    depthM: 0.6,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1 },
      { k: 'line', x1: 0.5, y1: 0, x2: 0.5, y2: 1 },
      { k: 'line', x1: 0, y1: 0.75, x2: 1, y2: 0.75 },
    ],
  },
  {
    id: 'dresser',
    category: 'bedroom',
    en: 'Dresser',
    ar: 'تسريحة',
    widthM: 1.2,
    depthM: 0.45,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.03 },
      { k: 'line', x1: 0, y1: 0.33, x2: 1, y2: 0.33 },
      { k: 'line', x1: 0, y1: 0.66, x2: 1, y2: 0.66 },
    ],
  },

  // ---------------------------------------------------------------- kitchen
  {
    id: 'counter',
    category: 'kitchen',
    en: 'Counter run',
    ar: 'كاونتر',
    widthM: 3,
    depthM: 0.6,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1 },
      { k: 'line', x1: 0, y1: 0.16, x2: 1, y2: 0.16 },
      { k: 'line', x1: 0.25, y1: 0.16, x2: 0.25, y2: 1 },
      { k: 'line', x1: 0.5, y1: 0.16, x2: 0.5, y2: 1 },
      { k: 'line', x1: 0.75, y1: 0.16, x2: 0.75, y2: 1 },
    ],
  },
  {
    id: 'island',
    category: 'kitchen',
    en: 'Kitchen island',
    ar: 'جزيرة مطبخ',
    widthM: 2.2,
    depthM: 1,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.04 },
      { k: 'rect', x: 0.06, y: 0.1, w: 0.88, h: 0.8, r: 0.03 },
      { k: 'ellipse', cx: 0.32, cy: 0.5, rx: 0.14, ry: 0.22 },
    ],
  },
  {
    id: 'sink',
    category: 'kitchen',
    en: 'Sink',
    ar: 'حوض مطبخ',
    widthM: 0.9,
    depthM: 0.6,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.04 },
      { k: 'rect', x: 0.08, y: 0.22, w: 0.4, h: 0.62, r: 0.05 },
      { k: 'rect', x: 0.54, y: 0.22, w: 0.38, h: 0.62, r: 0.05 },
      { k: 'circle', cx: 0.5, cy: 0.1, r: 0.05 },
    ],
  },
  {
    id: 'cooker',
    category: 'kitchen',
    en: 'Cooker',
    ar: 'فرن',
    widthM: 0.9,
    depthM: 0.6,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.03 },
      { k: 'circle', cx: 0.28, cy: 0.3, r: 0.13 },
      { k: 'circle', cx: 0.72, cy: 0.3, r: 0.13 },
      { k: 'circle', cx: 0.28, cy: 0.72, r: 0.13 },
      { k: 'circle', cx: 0.72, cy: 0.72, r: 0.13 },
    ],
  },
  {
    id: 'fridge',
    category: 'kitchen',
    en: 'Fridge',
    ar: 'ثلاجة',
    widthM: 0.9,
    depthM: 0.7,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.03 },
      { k: 'line', x1: 0.5, y1: 0, x2: 0.5, y2: 1 },
      { k: 'line', x1: 0.42, y1: 0.35, x2: 0.42, y2: 0.65 },
      { k: 'line', x1: 0.58, y1: 0.35, x2: 0.58, y2: 0.65 },
    ],
  },

  // ---------------------------------------------------------------- bathroom
  {
    id: 'wc',
    category: 'bathroom',
    en: 'WC',
    ar: 'مرحاض',
    widthM: 0.4,
    depthM: 0.7,
    shapes: [
      { k: 'rect', x: 0.1, y: 0, w: 0.8, h: 0.22, r: 0.03 },
      { k: 'ellipse', cx: 0.5, cy: 0.6, rx: 0.36, ry: 0.36 },
      { k: 'ellipse', cx: 0.5, cy: 0.6, rx: 0.22, ry: 0.24 },
    ],
  },
  {
    id: 'basin',
    category: 'bathroom',
    en: 'Basin',
    ar: 'مغسلة',
    widthM: 0.6,
    depthM: 0.5,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.06 },
      { k: 'ellipse', cx: 0.5, cy: 0.56, rx: 0.34, ry: 0.3 },
      { k: 'circle', cx: 0.5, cy: 0.14, r: 0.06 },
    ],
  },
  {
    id: 'vanity',
    category: 'bathroom',
    en: 'Vanity',
    ar: 'خزانة مغسلة',
    widthM: 1.2,
    depthM: 0.55,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.03 },
      { k: 'ellipse', cx: 0.5, cy: 0.55, rx: 0.22, ry: 0.28 },
      { k: 'circle', cx: 0.5, cy: 0.14, r: 0.05 },
      { k: 'line', x1: 0, y1: 0.82, x2: 1, y2: 0.82 },
    ],
  },
  {
    id: 'shower',
    category: 'bathroom',
    en: 'Shower',
    ar: 'دش',
    widthM: 1,
    depthM: 1,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.02 },
      { k: 'line', x1: 0, y1: 0, x2: 1, y2: 1 },
      { k: 'line', x1: 1, y1: 0, x2: 0, y2: 1 },
      { k: 'circle', cx: 0.5, cy: 0.5, r: 0.08 },
    ],
  },
  {
    id: 'bathtub',
    category: 'bathroom',
    en: 'Bathtub',
    ar: 'حوض استحمام',
    widthM: 1.7,
    depthM: 0.8,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.06 },
      { k: 'rect', x: 0.07, y: 0.12, w: 0.8, h: 0.76, r: 0.12 },
      { k: 'circle', cx: 0.93, cy: 0.5, r: 0.05 },
    ],
  },

  // ---------------------------------------------------------------- work
  {
    id: 'desk',
    category: 'work',
    en: 'Desk',
    ar: 'مكتب',
    widthM: 1.6,
    depthM: 0.75,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.03 },
      { k: 'rect', x: 0.62, y: 0.06, w: 0.32, h: 0.88, r: 0.03 },
      { k: 'line', x1: 0.62, y1: 0.5, x2: 0.94, y2: 0.5 },
    ],
  },
  {
    id: 'office-chair',
    category: 'work',
    en: 'Office chair',
    ar: 'كرسي مكتب',
    widthM: 0.6,
    depthM: 0.6,
    shapes: [
      { k: 'rect', x: 0.12, y: 0.22, w: 0.76, h: 0.66, r: 0.12 },
      { k: 'rect', x: 0.08, y: 0, w: 0.84, h: 0.18, r: 0.07 },
      { k: 'circle', cx: 0.5, cy: 0.58, r: 0.1 },
    ],
  },

  // ---------------------------------------------------------------- gym
  {
    id: 'treadmill',
    category: 'gym',
    en: 'Treadmill',
    ar: 'جهاز جري',
    widthM: 0.9,
    depthM: 2,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.04 },
      { k: 'rect', x: 0.05, y: 0, w: 0.9, h: 0.2, r: 0.03 },
      { k: 'rect', x: 0.14, y: 0.24, w: 0.72, h: 0.72, r: 0.03 },
      { k: 'line', x1: 0.14, y1: 0.45, x2: 0.86, y2: 0.45 },
      { k: 'line', x1: 0.14, y1: 0.7, x2: 0.86, y2: 0.7 },
    ],
  },
  {
    id: 'weight-bench',
    category: 'gym',
    en: 'Weight bench',
    ar: 'بنش أثقال',
    widthM: 1.3,
    depthM: 0.6,
    shapes: [
      { k: 'rect', x: 0.15, y: 0.28, w: 0.7, h: 0.44, r: 0.06 },
      { k: 'line', x1: 0, y1: 0.1, x2: 1, y2: 0.1 },
      { k: 'circle', cx: 0.1, cy: 0.1, r: 0.09 },
      { k: 'circle', cx: 0.9, cy: 0.1, r: 0.09 },
    ],
  },
  {
    id: 'dumbbell-rack',
    category: 'gym',
    en: 'Dumbbell rack',
    ar: 'رف دمبل',
    widthM: 1.6,
    depthM: 0.5,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.03 },
      { k: 'line', x1: 0, y1: 0.5, x2: 1, y2: 0.5 },
      ...Array.from({ length: 6 }, (_, index) => ({
        k: 'circle' as const,
        cx: 0.1 + index * 0.16,
        cy: 0.25,
        r: 0.06,
      })),
      ...Array.from({ length: 6 }, (_, index) => ({
        k: 'circle' as const,
        cx: 0.1 + index * 0.16,
        cy: 0.75,
        r: 0.06,
      })),
    ],
  },
  {
    id: 'car',
    category: 'gym',
    en: 'Car',
    ar: 'سيارة',
    widthM: 1.9,
    depthM: 4.6,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.2 },
      { k: 'rect', x: 0.12, y: 0.16, w: 0.76, h: 0.24, r: 0.1 },
      { k: 'rect', x: 0.14, y: 0.46, w: 0.72, h: 0.3, r: 0.08 },
      { k: 'line', x1: 0.5, y1: 0.46, x2: 0.5, y2: 0.76 },
    ],
  },

  // ---------------------------------------------------------------- structure
  {
    id: 'stairs-straight',
    category: 'structure',
    en: 'Stairs',
    ar: 'سلم',
    widthM: 1.2,
    depthM: 3,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1 },
      ...Array.from({ length: 9 }, (_, index) => ({
        k: 'line' as const,
        x1: 0,
        y1: (index + 1) / 10,
        x2: 1,
        y2: (index + 1) / 10,
      })),
      { k: 'line', x1: 0.5, y1: 0.92, x2: 0.5, y2: 0.08 },
      { k: 'poly', points: [0.5, 0.04, 0.42, 0.16, 0.58, 0.16], close: true, fill: true },
    ],
  },
  {
    id: 'stairs-quarter',
    category: 'structure',
    en: 'L stairs',
    ar: 'سلم زاوية',
    widthM: 2.4,
    depthM: 2.4,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1 },
      ...Array.from({ length: 5 }, (_, index) => ({
        k: 'line' as const,
        x1: 0,
        y1: (index + 1) / 6 * 0.5,
        x2: 0.5,
        y2: (index + 1) / 6 * 0.5,
      })),
      { k: 'line', x1: 0.5, y1: 0.5, x2: 1, y2: 0.5 },
      ...Array.from({ length: 5 }, (_, index) => ({
        k: 'line' as const,
        x1: 0.5 + (index + 1) / 6 * 0.5,
        y1: 0.5,
        x2: 0.5 + (index + 1) / 6 * 0.5,
        y2: 1,
      })),
    ],
  },
  {
    id: 'split-unit',
    category: 'structure',
    en: 'Split unit',
    ar: 'مكيف سبليت',
    widthM: 1,
    depthM: 0.25,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.1 },
      { k: 'line', x1: 0.05, y1: 0.65, x2: 0.95, y2: 0.65 },
    ],
  },
  {
    id: 'planter-bed',
    category: 'structure',
    en: 'Planter bed',
    ar: 'حوض نباتات',
    widthM: 2,
    depthM: 0.5,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.04 },
      ...Array.from({ length: 5 }, (_, index) => ({
        k: 'circle' as const,
        cx: 0.1 + index * 0.2,
        cy: 0.5,
        r: 0.14,
      })),
    ],
  },

  // ---------------------------------------------------------------- decor
  {
    id: 'plant',
    category: 'decor',
    en: 'Plant',
    ar: 'نبتة',
    widthM: 0.6,
    depthM: 0.6,
    shapes: [
      { k: 'circle', cx: 0.5, cy: 0.5, r: 0.46 },
      { k: 'circle', cx: 0.5, cy: 0.5, r: 0.3 },
      { k: 'circle', cx: 0.5, cy: 0.5, r: 0.12, fill: true },
    ],
  },
  {
    id: 'prayer-carpet',
    category: 'decor',
    en: 'Prayer carpet',
    ar: 'سجادة صلاة',
    widthM: 1.2,
    depthM: 2,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1, r: 0.03 },
      { k: 'rect', x: 0.08, y: 0.08, w: 0.84, h: 0.84, r: 0.03 },
      { k: 'arc', cx: 0.5, cy: 0.3, r: 0.2, from: 180, to: 360 },
      { k: 'line', x1: 0.3, y1: 0.3, x2: 0.3, y2: 0.86 },
      { k: 'line', x1: 0.7, y1: 0.3, x2: 0.7, y2: 0.86 },
    ],
  },
  {
    id: 'mirror',
    category: 'decor',
    en: 'Mirror',
    ar: 'مرآة',
    widthM: 1.2,
    depthM: 0.1,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1 },
      { k: 'line', x1: 0.05, y1: 0.5, x2: 0.95, y2: 0.5 },
    ],
  },
  {
    id: 'fireplace',
    category: 'decor',
    en: 'Fireplace',
    ar: 'مدفأة',
    widthM: 1.4,
    depthM: 0.4,
    shapes: [
      { k: 'rect', x: 0, y: 0, w: 1, h: 1 },
      { k: 'rect', x: 0.2, y: 0.25, w: 0.6, h: 0.75, r: 0.02 },
      { k: 'arc', cx: 0.5, cy: 0.7, r: 0.16, from: 200, to: 340 },
    ],
  },
];

export const furnitureById = (symbolId: string): FurnitureSymbol | undefined => (
  FURNITURE_SYMBOLS.find((symbol) => symbol.id === symbolId)
);

export const furnitureByCategory = (category: FurnitureCategory): FurnitureSymbol[] => (
  FURNITURE_SYMBOLS.filter((symbol) => symbol.category === category)
);

/** The furniture name the image model is told about, so a symbol never renders as the wrong thing. */
export const furnitureLabel = (symbolId: string): string => furnitureById(symbolId)?.en || symbolId;
