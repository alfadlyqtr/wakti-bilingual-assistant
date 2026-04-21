export interface Brief {
  subject: string;
  objective: string;
  audience: string;
  scenario: string;
  tone: string;
  language: 'en' | 'ar';
  themeHint: string;
}

// Dokie-style rich outline structure
export interface SlideOutline {
  slideNumber: number;
  role: string;
  title: string;
  subtitle?: string;
  bullets: string[];
  highlightedStats?: string[];
  columns?: { title: string; description: string; icon: string }[];
  imageHint?: string;
  layoutHint: string;
  footer?: string;
}

// Column for 3-column layouts
export interface Column {
  title: string;
  description: string;
  icon?: string;
  bullets?: string[];
}

// Text styling options
export interface TextStyle {
  fontSize: 'small' | 'medium' | 'large';
  fontWeight: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  color: string;
}

export type ImageFocusX = 'left' | 'center' | 'right';
export type ImageFocusY = 'top' | 'center' | 'bottom';
export interface ImageTransform {
  scale: number;
  xPct: number;
  yPct: number;
}

export type LayoutVariant = 'text_left' | 'image_left' | 'image_top' | 'image_bottom' | 'text_only';
export type ImageSize = 'small' | 'medium' | 'large' | 'full';
export type ImageFit = 'crop' | 'fit' | 'fill';

// Final rendered slide with all data
export interface Slide {
  id: string;
  slideNumber: number;
  role: string;
  layoutType: string;
  theme: string;
  title: string;
  subtitle?: string;
  bullets: string[];
  highlightedStats?: string[];
  columns?: Column[];
  imageUrl?: string;
  imageMeta?: {
    photographer?: string;
    photographerUrl?: string;
    pexelsUrl?: string;
  };
  footer?: string;
  // Custom styling
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
  bulletStyle?: TextStyle;
  backgroundColor?: string;
  backgroundGradient?: string;
  // Accent styling (keywords, dots)
  accentColor?: string;
  accentFontWeight?: 'normal' | 'bold';
  accentFontStyle?: 'normal' | 'italic';
  accentFontSize?: 'small' | 'medium' | 'large';
  bulletDotColor?: string;
  bulletDotSize?: 'small' | 'medium' | 'large';
  bulletDotShape?: 'dot' | 'diamond' | 'arrow' | 'dash' | 'number' | 'letter';
  // Layout options
  layoutVariant?: LayoutVariant;
  imageSize?: ImageSize;
  imageFit?: ImageFit;
  imageTransform?: ImageTransform;
  imageFocusX?: ImageFocusX;
  imageFocusY?: ImageFocusY;
  slideBg?: string;
  // Narration voice (for MP4 export)
  voiceGender?: 'male' | 'female';
  enhancedHtml?: string | null;
  enhancedTemplate?: number | null;
}

export type Step = 'topic' | 'brief' | 'outline' | 'slides';
export type ThemeKey = 'starter' | 'professional' | 'pitch_deck' | 'creative' | 'academic';
export type InputMode = 'verbatim' | 'polish' | 'topic_only' | 'blank';

export type InputModeFlags = Record<InputMode, boolean>;

export interface ThemeConfig {
  key: ThemeKey;
  label: { en: string; ar: string };
  description: { en: string; ar: string };
  // Visual styling
  bgGradient: string;
  cardBg: string;
  headerBg: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  bulletColor: string;
  // Layout DNA
  imageIntensity: 'none' | 'light' | 'heavy' | 'dominant';
  preferredLayouts: string[];
  // Card styling
  cardShadow: string;
  cardBorder: string;
}
