import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { callEdgeFunctionWithRetry, supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import { 
  exportSlidesToPDFClean, 
  exportSlidesToPPTX, 
  downloadBlob, 
  generateFilename 
} from '@/utils/presentationExport';
import { 
  Presentation, 
  Sparkles, 
  Loader2, 
  ChevronRight, 
  ChevronLeft,
  FileDown,
  RefreshCw,
  Check,
  ImageIcon,
  Layout,
  Palette,
  Edit2,
  Plus,
  Trash2,
  FileText,
  FileSpreadsheet,
  FilePlus2,
  Share2,
  Type,
  Wand2,
  Lightbulb,
  FileQuestion,
  Globe,
  Image as ImageLucide
} from 'lucide-react';
import { ColorPickerWithGradient, getColorStyle, isGradientValue } from '@/components/ui/ColorPickerWithGradient';
import { Switch } from '@/components/ui/switch';
import { generateShareToken, type ShareManifestV2 } from '@/utils/presentationShare';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Brief {
  subject: string;
  objective: string;
  audience: string;
  scenario: string;
  tone: string;
  language: 'en' | 'ar';
  themeHint: string;
}

// Dokie-style rich outline structure
interface SlideOutline {
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
interface Column {
  title: string;
  description: string;
  icon?: string;
  bullets?: string[];
}

// Text styling options
interface TextStyle {
  fontSize: 'small' | 'medium' | 'large';
  fontWeight: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  color: string;
}

type ImageFocusX = 'left' | 'center' | 'right';
type ImageFocusY = 'top' | 'center' | 'bottom';
interface ImageTransform {
  scale: number;
  xPct: number;
  yPct: number;
}

type LayoutVariant = 'text_left' | 'image_left' | 'image_top' | 'image_bottom' | 'text_only';
type ImageSize = 'small' | 'medium' | 'large' | 'full';
type ImageFit = 'crop' | 'fit' | 'fill';

// Final rendered slide with all data
interface Slide {
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
  // Accent styling (keywords, dots)
  accentColor?: string;  // For keyword highlights and accent dots
  accentFontWeight?: 'normal' | 'bold';
  accentFontStyle?: 'normal' | 'italic';
  accentFontSize?: 'small' | 'medium' | 'large';
  bulletDotColor?: string;  // For bullet point dots
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
}

type Step = 'topic' | 'brief' | 'outline' | 'slides';
type ThemeKey = 'starter' | 'professional' | 'pitch_deck' | 'creative' | 'academic';
type InputMode = 'verbatim' | 'polish' | 'topic_only' | 'blank';

type InputModeFlags = Record<InputMode, boolean>;

interface ThemeConfig {
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

const THEMES: ThemeConfig[] = [
  {
    key: 'starter',
    label: { en: 'Starter', ar: 'البداية' },
    description: { en: 'Simple & Clean – Perfect for school projects', ar: 'بسيط ونظيف – مثالي للمشاريع المدرسية' },
    bgGradient: 'from-slate-100 to-slate-200',
    cardBg: 'bg-white',
    headerBg: 'bg-slate-700',
    textPrimary: 'text-slate-900',
    textSecondary: 'text-slate-600',
    accent: 'bg-slate-700',
    bulletColor: 'bg-slate-500',
    imageIntensity: 'none',
    preferredLayouts: ['cover', 'title_and_bullets'],
    cardShadow: 'shadow-lg',
    cardBorder: 'border border-slate-200',
  },
  {
    key: 'professional',
    label: { en: 'Professional', ar: 'احترافي' },
    description: { en: 'Corporate Ready – For business & reports', ar: 'جاهز للأعمال – للتقارير والاجتماعات' },
    bgGradient: 'from-blue-50 to-indigo-100',
    cardBg: 'bg-white',
    headerBg: 'bg-indigo-600',
    textPrimary: 'text-slate-900',
    textSecondary: 'text-slate-600',
    accent: 'bg-indigo-600',
    bulletColor: 'bg-indigo-500',
    imageIntensity: 'light',
    preferredLayouts: ['cover', 'title_and_bullets', 'two_column'],
    cardShadow: 'shadow-xl',
    cardBorder: 'border border-indigo-100',
  },
  {
    key: 'pitch_deck',
    label: { en: 'Pitch Deck', ar: 'عرض استثماري' },
    description: { en: 'Bold & Visual – For investors & sales', ar: 'جريء ومرئي – للمستثمرين والمبيعات' },
    bgGradient: 'from-emerald-50 to-teal-100',
    cardBg: 'bg-white',
    headerBg: 'bg-emerald-600',
    textPrimary: 'text-slate-900',
    textSecondary: 'text-slate-600',
    accent: 'bg-emerald-500',
    bulletColor: 'bg-emerald-500',
    imageIntensity: 'heavy',
    preferredLayouts: ['cover', 'image_left_bullets_right', 'three_column_cards', 'title_and_bullets', 'big_stat'],
    cardShadow: 'shadow-2xl',
    cardBorder: 'border-0',
  },
  {
    key: 'creative',
    label: { en: 'Creative', ar: 'إبداعي' },
    description: { en: 'Visual-First – For marketing & events', ar: 'المرئيات أولاً – للتسويق والفعاليات' },
    bgGradient: 'from-orange-400 to-pink-500',
    cardBg: 'bg-white/95',
    headerBg: 'bg-gradient-to-r from-orange-500 to-pink-500',
    textPrimary: 'text-slate-900',
    textSecondary: 'text-slate-600',
    accent: 'bg-orange-500',
    bulletColor: 'bg-pink-500',
    imageIntensity: 'dominant',
    preferredLayouts: ['cover', 'image_left_bullets_right', 'full_image', 'title_and_bullets'],
    cardShadow: 'shadow-2xl',
    cardBorder: 'border-0',
  },
  {
    key: 'academic',
    label: { en: 'Academic', ar: 'أكاديمي' },
    description: { en: 'Formal & Clear – For lectures & research', ar: 'رسمي وواضح – للمحاضرات والبحث' },
    bgGradient: 'from-slate-800 to-slate-900',
    cardBg: 'bg-slate-800',
    headerBg: 'bg-cyan-500',
    textPrimary: 'text-white',
    textSecondary: 'text-slate-300',
    accent: 'bg-cyan-500',
    bulletColor: 'bg-cyan-400',
    imageIntensity: 'light',
    preferredLayouts: ['cover', 'title_and_bullets', 'two_column'],
    cardShadow: 'shadow-2xl',
    cardBorder: 'border border-slate-700',
  },
];

// Input mode options for how Wakti should handle the user's text
const INPUT_MODES: { key: InputMode; label: { en: string; ar: string }; description: { en: string; ar: string } }[] = [
  {
    key: 'verbatim',
    label: { en: 'Use my text exactly', ar: 'استخدم نصي كما هو' },
    description: { en: 'Turn my words into slides without changing them', ar: 'حوّل كلماتي إلى شرائح دون تغييرها' },
  },
  {
    key: 'polish',
    label: { en: 'Polish & adapt my text', ar: 'حسّن نصي وطوّره' },
    description: { en: 'Improve flow & structure but keep my voice', ar: 'حسّن التدفق والبنية مع الحفاظ على أسلوبي' },
  },
  {
    key: 'topic_only',
    label: { en: 'Treat as topic only', ar: 'استخدمه كموضوع فقط' },
    description: { en: 'Use as inspiration, create fresh content', ar: 'استخدمه كإلهام وأنشئ محتوى جديد' },
  },
  {
    key: 'blank',
    label: { en: 'Blank (start without typing anything)', ar: 'فارغ (ابدأ بدون كتابة شيء)' },
    description: { en: 'Start with empty slides and fill everything in Edit', ar: 'ابدأ بشرائح فارغة واملأ كل شيء في وضع التعديل' },
  },
];

// Dropdown options - expanded with more use cases including personal tributes
const OBJECTIVES = [
  { key: 'express_love', label: { en: '💕 Express Love / Appreciation', ar: '💕 التعبير عن الحب / التقدير' } },
  { key: 'celebrate_someone', label: { en: '🎉 Celebrate Someone Special', ar: '🎉 الاحتفاء بشخص مميز' } },
  { key: 'school_project', label: { en: '📚 School Project', ar: '📚 مشروع مدرسي' } },
  { key: 'university_thesis', label: { en: '🎓 University Thesis/Research', ar: '🎓 أطروحة جامعية/بحث' } },
  { key: 'pitch_investors', label: { en: '💰 Pitch to Investors', ar: '💰 عرض للمستثمرين' } },
  { key: 'educate_audience', label: { en: '📖 Educate & Inform', ar: '📖 تثقيف وإعلام' } },
  { key: 'sell_product', label: { en: '🛒 Sell Product/Service', ar: '🛒 بيع منتج/خدمة' } },
  { key: 'internal_report', label: { en: '📊 Internal Report', ar: '📊 تقرير داخلي' } },
  { key: 'project_proposal', label: { en: '📝 Project Proposal', ar: '📝 اقتراح مشروع' } },
  { key: 'training', label: { en: '🎯 Training/Workshop', ar: '🎯 تدريب/ورشة عمل' } },
  { key: 'case_study', label: { en: '🔍 Case Study', ar: '🔍 دراسة حالة' } },
  { key: 'company_intro', label: { en: '🏢 Company Introduction', ar: '🏢 تقديم الشركة' } },
];

const AUDIENCES = [
  { key: 'partner_spouse', label: { en: '💑 My Partner / Spouse', ar: '💑 شريك حياتي / زوجي' } },
  { key: 'family', label: { en: '👨‍👩‍👧‍👦 My Family', ar: '👨‍👩‍👧‍👦 عائلتي' } },
  { key: 'loved_one', label: { en: '❤️ A Loved One', ar: '❤️ شخص عزيز' } },
  { key: 'teachers', label: { en: '👨‍🏫 Teachers/Professors', ar: '👨‍🏫 المعلمون/الأساتذة' } },
  { key: 'classmates', label: { en: '👥 Classmates/Peers', ar: '👥 زملاء الدراسة' } },
  { key: 'students', label: { en: '🎒 Students', ar: '🎒 الطلاب' } },
  { key: 'investors', label: { en: '💼 Investors & VCs', ar: '💼 المستثمرون' } },
  { key: 'executives', label: { en: '👔 Executives & Leadership', ar: '👔 المدراء التنفيذيون' } },
  { key: 'general_public', label: { en: '🌍 General Public', ar: '🌍 الجمهور العام' } },
  { key: 'team_members', label: { en: '🤝 Team Members', ar: '🤝 أعضاء الفريق' } },
  { key: 'clients', label: { en: '🤵 Clients & Customers', ar: '🤵 العملاء' } },
  { key: 'conference', label: { en: '🎤 Conference Attendees', ar: '🎤 حضور المؤتمر' } },
];

const SCENARIOS = [
  { key: 'anniversary', label: { en: '💍 Anniversary / Special Night', ar: '💍 ذكرى سنوية / ليلة مميزة' } },
  { key: 'private_celebration', label: { en: '🎊 Private Celebration', ar: '🎊 احتفال خاص' } },
  { key: 'wedding_speech', label: { en: '💒 Wedding / Engagement', ar: '💒 زفاف / خطوبة' } },
  { key: 'classroom', label: { en: '🏫 Classroom Presentation', ar: '🏫 عرض في الفصل' } },
  { key: 'school_project', label: { en: '📚 School Project Defense', ar: '📚 دفاع عن مشروع مدرسي' } },
  { key: 'thesis_defense', label: { en: '🎓 Thesis Defense', ar: '🎓 مناقشة الأطروحة' } },
  { key: 'pitch_meeting', label: { en: '💼 Pitch Meeting', ar: '💼 اجتماع عرض' } },
  { key: 'conference', label: { en: '🎤 Conference Talk', ar: '🎤 محاضرة مؤتمر' } },
  { key: 'webinar', label: { en: '💻 Webinar/Online', ar: '💻 ندوة عبر الإنترنت' } },
  { key: 'board_meeting', label: { en: '📋 Board Meeting', ar: '📋 اجتماع مجلس الإدارة' } },
  { key: 'sales_call', label: { en: '📞 Sales Presentation', ar: '📞 عرض مبيعات' } },
  { key: 'workshop', label: { en: '🛠️ Workshop/Training', ar: '🛠️ ورشة عمل/تدريب' } },
];

const TONES = [
  { key: 'romantic', label: { en: '💕 Romantic', ar: '💕 رومانسي' } },
  { key: 'heartfelt', label: { en: '❤️ Heartfelt & Warm', ar: '❤️ صادق ودافئ' } },
  { key: 'gentle', label: { en: '🌸 Soft & Gentle', ar: '🌸 ناعم ولطيف' } },
  { key: 'playful', label: { en: '😄 Playful & Fun', ar: '😄 مرح وممتع' } },
  { key: 'educational', label: { en: '📖 Educational & Clear', ar: '📖 تعليمي وواضح' } },
  { key: 'professional', label: { en: '💼 Professional', ar: '💼 مهني' } },
  { key: 'casual', label: { en: '😊 Casual & Friendly', ar: '😊 ودي وغير رسمي' } },
  { key: 'inspirational', label: { en: '✨ Inspirational', ar: '✨ ملهم' } },
  { key: 'data_driven', label: { en: '📊 Data-driven', ar: '📊 قائم على البيانات' } },
  { key: 'storytelling', label: { en: '📚 Storytelling', ar: '📚 سرد قصصي' } },
  { key: 'formal', label: { en: '🎩 Formal & Academic', ar: '🎩 رسمي وأكاديمي' } },
  { key: 'persuasive', label: { en: '🎯 Persuasive', ar: '🎯 مقنع' } },
];

// Theme accent color helper - includes hex for inline styles
const getThemeAccent = (themeKey: string) => {
  switch (themeKey) {
    case 'pitch_deck': return { bg: 'bg-emerald-500', text: 'text-emerald-400', light: 'text-emerald-300', hex: '#10b981' };
    case 'creative': return { bg: 'bg-orange-500', text: 'text-orange-400', light: 'text-orange-200', hex: '#f97316' };
    case 'professional': return { bg: 'bg-indigo-500', text: 'text-indigo-400', light: 'text-indigo-300', hex: '#6366f1' };
    case 'academic': return { bg: 'bg-cyan-500', text: 'text-cyan-400', light: 'text-cyan-300', hex: '#06b6d4' };
    default: return { bg: 'bg-blue-500', text: 'text-blue-400', light: 'text-blue-300', hex: '#3b82f6' };
  }
};

// Helper to render text with **bold** markdown - Theme-aware badges for stats
const renderBoldText = (text: string, themeKey: string = 'starter'): React.ReactNode => {
  if (!text) return null;
  const accent = getThemeAccent(themeKey);
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const content = part.slice(2, -2);
      // Check if it's a stat (number, percentage, currency)
      const isStat = /^[\d$€£¥%.,]+[%KMB]?$/.test(content.trim()) || /^\$?\d/.test(content.trim());
      if (isStat) {
        return <span key={i} className={`inline-block px-2 py-0.5 ${accent.bg} text-white text-sm font-bold rounded`}>{content}</span>;
      }
      return <strong key={i} className={`font-bold ${accent.text}`}>{content}</strong>;
    }
    return part;
  });
};

// Helper to get font size class from style - LARGER sizes for better readability
const getFontSizeClass = (size?: 'small' | 'medium' | 'large', type: 'title' | 'bullet' = 'bullet') => {
  if (type === 'title') {
    switch (size) {
      case 'small': return 'text-lg sm:text-xl md:text-2xl lg:text-3xl';
      case 'large': return 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl';
      default: return 'text-xl sm:text-2xl md:text-3xl lg:text-4xl'; // medium
    }
  }
  // Bullets - larger for readability
  switch (size) {
    case 'small': return 'text-xs sm:text-sm md:text-base';
    case 'large': return 'text-base sm:text-lg md:text-xl';
    default: return 'text-sm sm:text-base md:text-lg'; // medium
  }
};

// Helper to get image fit class
const getImageFitClass = (fit?: ImageFit) => {
  switch (fit) {
    case 'fit': return 'object-contain';
    case 'fill': return 'object-fill';
    default: return 'object-cover'; // crop is default
  }
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const CROP_OVERSCAN_SCALE = 1.15;

const clampTransformForCrop = (t: ImageTransform): ImageTransform => {
  // In crop mode we pan using object-position (not translating the image element).
  // That means we can safely clamp the offsets to [-50, 50] (maps to object-position 0..100).
  const scale = clamp(t.scale ?? 1, 1, 3);
  return {
    scale,
    xPct: clamp(t.xPct ?? 0, -50, 50),
    yPct: clamp(t.yPct ?? 0, -50, 50),
  };
};

const getDefaultImageTransform = (): ImageTransform => ({ scale: 1, xPct: 0, yPct: 0 });

const focusToXY = (fx?: ImageFocusX, fy?: ImageFocusY): { xPct: number; yPct: number } => {
  const xPct = fx === 'left' ? -25 : fx === 'right' ? 25 : 0;
  const yPct = fy === 'top' ? -25 : fy === 'bottom' ? 25 : 0;
  return { xPct, yPct };
};

const focusToXYForCrop = (fx?: ImageFocusX, fy?: ImageFocusY): { xPct: number; yPct: number } => {
  // Crop panning uses object-position.
  // We store xPct/yPct as offsets from center in percentage points.
  // object-position uses 0%..100% where 50% is centered.
  // So left/top are -50, right/bottom are +50.
  // We define xPct/yPct in "move the image" space (positive = image moves right/down).
  // That means the object-position is inverted when applied.
  const xPct = fx === 'left' ? 50 : fx === 'right' ? -50 : 0;
  const yPct = fy === 'top' ? 50 : fy === 'bottom' ? -50 : 0;
  return { xPct, yPct };
};

const getEffectiveTransform = (slide: Slide): ImageTransform => {
  return slide.imageTransform || getDefaultImageTransform();
};

const buildCropImageStyle = (slide: Slide): React.CSSProperties => {
  const t = clampTransformForCrop(getEffectiveTransform(slide));
  // Invert mapping so +xPct moves the image right (object-position shifts left).
  const objX = clamp(50 - (t.xPct ?? 0), 0, 100);
  const objY = clamp(50 - (t.yPct ?? 0), 0, 100);
  const effectiveScale = (t.scale ?? 1) * CROP_OVERSCAN_SCALE;
  return {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: `${objX}% ${objY}%`,
    transform: `scale(${effectiveScale})`,
    transformOrigin: 'center center',
  };
};

const renderSlideImage = (
  slide: Slide,
  args?: {
    className?: string;
    enableDrag?: boolean;
    onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
    onPointerMove?: React.PointerEventHandler<HTMLDivElement>;
    onPointerUp?: React.PointerEventHandler<HTMLDivElement>;
    onPointerCancel?: React.PointerEventHandler<HTMLDivElement>;
  }
): React.ReactNode => {
  if (!slide.imageUrl) return null;

  const fit = slide.imageFit || 'crop';
  const className = args?.className || 'w-full h-full';

  const frameClassName = `${className} relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-background to-muted/20 shadow-soft`;
  const fitFrameClassName = `${className} relative overflow-hidden rounded-2xl border border-border/60 bg-transparent shadow-soft`;

  // For crop mode, we render as a transformable layer inside an overflow-hidden frame.
  if (fit === 'crop') {
    return (
      <div
        className={`${frameClassName} ${args?.enableDrag ? 'touch-none select-none' : ''}`}
        onPointerDown={args?.onPointerDown}
        onPointerMove={args?.onPointerMove}
        onPointerUp={args?.onPointerUp}
        onPointerCancel={args?.onPointerCancel || args?.onPointerUp}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/25" />
        <div className="pointer-events-none absolute inset-0 ring-1 ring-white/10" />
        <img
          src={slide.imageUrl}
          alt={slide.title}
          draggable={false}
          className="w-full h-full"
          style={buildCropImageStyle(slide)}
        />
      </div>
    );
  }

  // Fit / Fill fallback (no transform)
  return (
    <div className={fit === 'fit' ? fitFrameClassName : frameClassName}>
      {fit !== 'fit' && (
        <>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/25" />
          <div className="pointer-events-none absolute inset-0 ring-1 ring-white/10" />
        </>
      )}
      <img src={slide.imageUrl} alt={slide.title} className={`w-full h-full ${getImageFitClass(slide.imageFit)}`} />
    </div>
  );
};

// Helper to render bullet shape
const renderBulletShape = (
  shape: 'dot' | 'diamond' | 'arrow' | 'dash' | 'number' | 'letter' | undefined,
  index: number,
  size: 'small' | 'medium' | 'large' | undefined,
  color: string
): React.ReactNode => {
  const sizeClass = size === 'medium' ? 'text-sm' : size === 'large' ? 'text-base' : 'text-xs';
  const dotSizeClass = size === 'medium' ? 'w-1.5 h-1.5' : size === 'large' ? 'w-2 h-2' : 'w-1 h-1';
  
  switch (shape) {
    case 'diamond':
      return <span className={`${sizeClass} flex-shrink-0 mt-0.5`} style={{ color }}>◆</span>;
    case 'arrow':
      return <span className={`${sizeClass} flex-shrink-0 mt-0.5`} style={{ color }}>➤</span>;
    case 'dash':
      return <span className={`${sizeClass} flex-shrink-0 mt-0.5`} style={{ color }}>—</span>;
    case 'number':
      return <span className={`${sizeClass} flex-shrink-0 mt-0.5 font-medium`} style={{ color }}>{index + 1}.</span>;
    case 'letter':
      return <span className={`${sizeClass} flex-shrink-0 mt-0.5 font-medium`} style={{ color }}>{String.fromCharCode(97 + index)}.</span>;
    default: // dot
      return <span className={`${dotSizeClass} rounded-full mt-1.5 flex-shrink-0`} style={{ backgroundColor: color }} />;
  }
};

// Helper to get slide background class from slideBg key
const getSlideBgClass = (bgKey?: string) => {
  const bgMap: Record<string, string> = {
    // Solid colors
    'black': 'from-black to-gray-900',
    'dark': 'from-slate-900 to-slate-800',
    'slate': 'from-slate-800 to-slate-700',
    'gray': 'from-gray-700 to-gray-600',
    'navy': 'from-[#060541] to-[#0a0a6b]',
    'blue-dark': 'from-blue-900 to-blue-800',
    'blue': 'from-blue-700 to-blue-600',
    'blue-light': 'from-blue-500 to-blue-400',
    'indigo': 'from-indigo-900 to-indigo-800',
    'purple-dark': 'from-purple-900 to-purple-800',
    'purple': 'from-purple-700 to-purple-600',
    'violet': 'from-violet-600 to-violet-500',
    'pink-dark': 'from-pink-900 to-pink-800',
    'pink': 'from-pink-600 to-pink-500',
    'rose': 'from-rose-600 to-rose-500',
    'red': 'from-red-700 to-red-600',
    'orange': 'from-orange-700 to-orange-600',
    'amber': 'from-amber-600 to-amber-500',
    'yellow': 'from-yellow-600 to-yellow-500',
    'green-dark': 'from-emerald-900 to-emerald-800',
    'green': 'from-emerald-700 to-emerald-600',
    'green-light': 'from-emerald-500 to-emerald-400',
    'teal': 'from-teal-700 to-teal-600',
    'cyan': 'from-cyan-700 to-cyan-600',
    // Gradients - Dark/Cool
    'grad-navy': 'from-[#060541] to-blue-900',
    'grad-purple': 'from-purple-900 to-pink-900',
    'grad-night': 'from-slate-900 to-purple-900',
    'grad-ocean': 'from-blue-700 to-cyan-600',
    // Gradients - Warm/Vibrant
    'grad-sunset': 'from-orange-600 to-rose-600',
    'grad-fire': 'from-red-600 to-orange-500',
    'grad-pink': 'from-pink-500 via-rose-500 to-orange-400',
    'grad-candy': 'from-pink-500 to-purple-600',
    // Gradients - Nature
    'grad-green': 'from-emerald-900 to-teal-700',
    'grad-mint': 'from-teal-500 to-emerald-500',
    'grad-aurora': 'from-green-400 via-cyan-500 to-blue-500',
    'grad-royal': 'from-indigo-600 to-purple-700',
  };
  return bgMap[bgKey || 'dark'] || 'from-slate-900 to-slate-800';
};

/**
 * Build narration text from slide content (Title + Subtitle + Bullets)
 * Used for MP4 video export with per-slide audio narration
 */
const buildNarrationText = (slide: { title: string; subtitle?: string; bullets: string[] }): string => {
  const parts: string[] = [];
  
  if (slide.title) {
    parts.push(slide.title);
  }
  
  if (slide.subtitle) {
    parts.push(slide.subtitle);
  }
  
  if (slide.bullets && slide.bullets.length > 0) {
    parts.push(...slide.bullets.filter(b => b.trim()));
  }
  
  return parts.join('. ').replace(/\.\./g, '.').trim();
};

/**
 * Convert AudioBuffer to WAV Blob for video export
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, bufferLength - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);
  
  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) channels.push(buffer.getChannelData(i));
  
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const header = parts[0] || '';
  const base64 = parts[1] || '';
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mime = mimeMatch?.[1] || 'application/octet-stream';
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Parse gradient string for canvas rendering
 */
function parseGradientForCanvas(value: string): { color1: string; color2: string; angle: number } | null {
  if (!value.startsWith('gradient:')) return null;
  const parts = value.replace('gradient:', '').split(',');
  if (parts.length < 2) return null;
  const color1 = parts[0] || '#000000';
  const color2 = parts[1] || '#ffffff';
  // Parse angle from x,y or direct angle
  let angle = 135;
  if (parts.length >= 4) {
    const x = parseInt(parts[2] || '0', 10);
    const y = parseInt(parts[3] || '0', 10);
    angle = (Math.round(Math.atan2(-y, x) * 180 / Math.PI) + 360) % 360;
  } else if (parts.length >= 3) {
    angle = parseInt(parts[2] || '135', 10);
  }
  return { color1, color2, angle };
}

/**
 * Get theme accent color hex
 */
function getThemeAccentHex(theme: string): string {
  switch (theme) {
    case 'pitch_deck': return '#10b981';
    case 'creative': return '#f97316';
    case 'professional': return '#6366f1';
    case 'academic': return '#06b6d4';
    default: return '#64748b';
  }
}

/**
 * Get theme background colors for canvas
 */
function getThemeBackgroundColors(theme: string): { from: string; to: string; overlay?: string } {
  switch (theme) {
    case 'academic':
      return { from: '#0f172a', to: '#1e293b', overlay: 'rgba(30, 58, 138, 0.1)' };
    case 'pitch_deck':
      return { from: '#0f172a', to: '#1e293b', overlay: 'rgba(16, 185, 129, 0.1)' };
    case 'creative':
      return { from: '#ea580c', to: '#db2777', overlay: 'rgba(249, 115, 22, 0.1)' };
    case 'professional':
      return { from: '#1e293b', to: '#312e81', overlay: 'rgba(99, 102, 241, 0.1)' };
    default:
      return { from: '#1e293b', to: '#0f172a' };
  }
}

/**
 * Render a slide to canvas for video export - matches actual UI appearance
 */
async function renderSlideToCanvasAsync(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  width: number,
  height: number,
  theme: string,
  loadedImages: Map<string, HTMLImageElement>
): Promise<void> {
  // Step 1: Draw background
  if (slide.slideBg) {
    // Custom slide background
    const gradient = parseGradientForCanvas(slide.slideBg);
    if (gradient) {
      // Calculate gradient endpoints based on angle
      const angleRad = (gradient.angle * Math.PI) / 180;
      const x1 = width / 2 - Math.cos(angleRad) * width;
      const y1 = height / 2 + Math.sin(angleRad) * height;
      const x2 = width / 2 + Math.cos(angleRad) * width;
      const y2 = height / 2 - Math.sin(angleRad) * height;
      const canvasGradient = ctx.createLinearGradient(x1, y1, x2, y2);
      canvasGradient.addColorStop(0, gradient.color1);
      canvasGradient.addColorStop(1, gradient.color2);
      ctx.fillStyle = canvasGradient;
      ctx.fillRect(0, 0, width, height);
    } else {
      // Solid color
      ctx.fillStyle = slide.slideBg;
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    // Theme-based gradient background
    const colors = getThemeBackgroundColors(theme);
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, colors.from);
    bgGradient.addColorStop(1, colors.to);
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);
    
    // Add subtle overlay
    if (colors.overlay) {
      ctx.fillStyle = colors.overlay;
      ctx.fillRect(0, 0, width, height);
    }
  }

  // Step 2: Determine layout and draw content
  const padding = 80;
  const hasImage = slide.imageUrl && loadedImages.has(slide.imageUrl);
  const image = hasImage ? loadedImages.get(slide.imageUrl!) : null;
  const isCoverOrThankYou = slide.role === 'cover' || slide.role === 'thank_you';
  const accentColor = getThemeAccentHex(theme);
  
  // Title styling
  const titleColor = slide.titleStyle?.color || '#ffffff';
  const titleSize = slide.titleStyle?.fontSize === 'small' ? 56 : slide.titleStyle?.fontSize === 'large' ? 96 : 72;
  const titleWeight = slide.titleStyle?.fontWeight === 'normal' ? 'normal' : 'bold';
  
  // Subtitle styling
  const subtitleColor = slide.subtitleStyle?.color || '#94a3b8';
  const subtitleSize = slide.subtitleStyle?.fontSize === 'small' ? 32 : slide.subtitleStyle?.fontSize === 'large' ? 56 : 44;
  
  // Bullet styling
  const bulletColor = slide.bulletStyle?.color || '#e2e8f0';
  const bulletSize = slide.bulletStyle?.fontSize === 'small' ? 28 : slide.bulletStyle?.fontSize === 'large' ? 44 : 36;
  const bulletDotColor = slide.bulletDotColor || accentColor;

  if (isCoverOrThankYou && !hasImage) {
    // Centered layout for cover/thank you without image
    ctx.textAlign = 'center';
    
    // Title
    ctx.fillStyle = titleColor;
    ctx.font = `${titleWeight} ${titleSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(slide.title || '', width / 2, height / 2 - 40, width - padding * 2);
    
    // Subtitle
    if (slide.subtitle) {
      ctx.fillStyle = subtitleColor;
      ctx.font = `${subtitleSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(slide.subtitle, width / 2, height / 2 + 40, width - padding * 2);
    }
    
    // Accent line
    ctx.fillStyle = accentColor;
    ctx.fillRect(width / 2 - 60, height / 2 + 80, 120, 4);
    
  } else if (hasImage && image) {
    // Layout with image
    const layout = slide.layoutVariant || 'text_left';
    const imgSizeRatio = slide.imageSize === 'small' ? 0.33 : slide.imageSize === 'large' ? 0.6 : 0.45;
    
    if (layout === 'image_left') {
      // Image on left, text on right
      const imgWidth = (width - padding * 3) * imgSizeRatio;
      const imgHeight = height - padding * 2;
      const imgX = padding;
      const imgY = padding;
      
      // Draw image with rounded corners simulation
      ctx.save();
      ctx.fillStyle = 'rgba(51, 65, 85, 0.5)';
      ctx.fillRect(imgX, imgY, imgWidth, imgHeight);
      ctx.drawImage(image, imgX, imgY, imgWidth, imgHeight);
      ctx.restore();
      
      // Text on right
      const textX = imgX + imgWidth + padding;
      const textWidth = width - textX - padding;
      ctx.textAlign = 'left';
      
      ctx.fillStyle = titleColor;
      ctx.font = `${titleWeight} ${titleSize * 0.9}px system-ui, -apple-system, sans-serif`;
      wrapText(ctx, slide.title || '', textX, height / 2 - 60, textWidth, titleSize);
      
      if (slide.subtitle) {
        ctx.fillStyle = subtitleColor;
        ctx.font = `${subtitleSize * 0.9}px system-ui, -apple-system, sans-serif`;
        ctx.fillText(slide.subtitle, textX, height / 2 + 20, textWidth);
      }
      
      // Accent line
      ctx.fillStyle = accentColor;
      ctx.fillRect(textX, height / 2 + 60, 80, 4);
      
    } else if (layout === 'image_top') {
      // Image on top, text below
      const imgHeight = (height - padding * 3) * imgSizeRatio;
      const imgWidth = width - padding * 2;
      
      ctx.drawImage(image, padding, padding, imgWidth, imgHeight);
      
      const textY = padding + imgHeight + padding;
      ctx.textAlign = 'center';
      
      ctx.fillStyle = titleColor;
      ctx.font = `${titleWeight} ${titleSize * 0.85}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(slide.title || '', width / 2, textY + 60, width - padding * 2);
      
      if (slide.subtitle) {
        ctx.fillStyle = subtitleColor;
        ctx.font = `${subtitleSize * 0.85}px system-ui, -apple-system, sans-serif`;
        ctx.fillText(slide.subtitle, width / 2, textY + 120, width - padding * 2);
      }
      
    } else if (layout === 'image_bottom') {
      // Text on top, image below
      ctx.textAlign = 'center';
      
      ctx.fillStyle = titleColor;
      ctx.font = `${titleWeight} ${titleSize * 0.85}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(slide.title || '', width / 2, padding + 80, width - padding * 2);
      
      if (slide.subtitle) {
        ctx.fillStyle = subtitleColor;
        ctx.font = `${subtitleSize * 0.85}px system-ui, -apple-system, sans-serif`;
        ctx.fillText(slide.subtitle, width / 2, padding + 140, width - padding * 2);
      }
      
      const imgHeight = (height - padding * 3) * imgSizeRatio;
      const imgY = height - padding - imgHeight;
      ctx.drawImage(image, padding, imgY, width - padding * 2, imgHeight);
      
    } else {
      // Default: text_left (image on right)
      const imgWidth = (width - padding * 3) * imgSizeRatio;
      const imgHeight = height - padding * 2;
      const imgX = width - padding - imgWidth;
      
      ctx.drawImage(image, imgX, padding, imgWidth, imgHeight);
      
      // Text on left
      const textWidth = imgX - padding * 2;
      ctx.textAlign = 'left';
      
      ctx.fillStyle = titleColor;
      ctx.font = `${titleWeight} ${titleSize * 0.9}px system-ui, -apple-system, sans-serif`;
      wrapText(ctx, slide.title || '', padding, height / 2 - 60, textWidth, titleSize);
      
      if (slide.subtitle) {
        ctx.fillStyle = subtitleColor;
        ctx.font = `${subtitleSize * 0.9}px system-ui, -apple-system, sans-serif`;
        ctx.fillText(slide.subtitle, padding, height / 2 + 20, textWidth);
      }
      
      // Accent line
      ctx.fillStyle = accentColor;
      ctx.fillRect(padding, height / 2 + 60, 80, 4);
    }
    
  } else {
    // Content slide without image (title + bullets)
    ctx.textAlign = 'left';
    
    // Title at top
    ctx.fillStyle = titleColor;
    ctx.font = `${titleWeight} ${titleSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(slide.title || '', padding, padding + titleSize, width - padding * 2);
    
    // Subtitle
    let contentY = padding + titleSize + 40;
    if (slide.subtitle) {
      ctx.fillStyle = subtitleColor;
      ctx.font = `${subtitleSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(slide.subtitle, padding, contentY + subtitleSize, width - padding * 2);
      contentY += subtitleSize + 40;
    }
    
    // Bullets
    if (slide.bullets && slide.bullets.length > 0) {
      ctx.font = `${bulletSize}px system-ui, -apple-system, sans-serif`;
      const lineHeight = bulletSize + 24;
      
      slide.bullets.forEach((bullet, i) => {
        if (bullet.trim()) {
          const y = contentY + 60 + i * lineHeight;
          
          // Draw bullet dot
          ctx.fillStyle = bulletDotColor;
          ctx.beginPath();
          ctx.arc(padding + 12, y - bulletSize / 3, 6, 0, Math.PI * 2);
          ctx.fill();
          
          // Draw bullet text
          ctx.fillStyle = bulletColor;
          ctx.fillText(bullet, padding + 40, y, width - padding * 2 - 40);
        }
      });
    }
  }
}

/**
 * Helper to wrap text on canvas
 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  
  for (const word of words) {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line !== '') {
      ctx.fillText(line.trim(), x, currentY);
      line = word + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
}

/**
 * Synchronous wrapper for backward compatibility
 */
function renderSlideToCanvas(
  ctx: CanvasRenderingContext2D,
  slide: { title: string; subtitle?: string; bullets: string[]; slideBg?: string; imageUrl?: string; role?: string; layoutVariant?: string; imageSize?: string; titleStyle?: { color?: string; fontSize?: string; fontWeight?: string }; subtitleStyle?: { color?: string; fontSize?: string }; bulletStyle?: { color?: string; fontSize?: string }; bulletDotColor?: string },
  width: number,
  height: number,
  theme: string
): void {
  // Simplified sync version - just renders without images
  // For full rendering with images, use renderSlideToCanvasAsync
  
  // Draw background
  if (slide.slideBg) {
    const gradient = parseGradientForCanvas(slide.slideBg);
    if (gradient) {
      const angleRad = (gradient.angle * Math.PI) / 180;
      const x1 = width / 2 - Math.cos(angleRad) * width;
      const y1 = height / 2 + Math.sin(angleRad) * height;
      const x2 = width / 2 + Math.cos(angleRad) * width;
      const y2 = height / 2 - Math.sin(angleRad) * height;
      const canvasGradient = ctx.createLinearGradient(x1, y1, x2, y2);
      canvasGradient.addColorStop(0, gradient.color1);
      canvasGradient.addColorStop(1, gradient.color2);
      ctx.fillStyle = canvasGradient;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = slide.slideBg;
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    const colors = getThemeBackgroundColors(theme);
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, colors.from);
    bgGradient.addColorStop(1, colors.to);
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);
    if (colors.overlay) {
      ctx.fillStyle = colors.overlay;
      ctx.fillRect(0, 0, width, height);
    }
  }

  const padding = 80;
  const accentColor = getThemeAccentHex(theme);
  const titleColor = slide.titleStyle?.color || '#ffffff';
  const titleSize = slide.titleStyle?.fontSize === 'small' ? 56 : slide.titleStyle?.fontSize === 'large' ? 96 : 72;
  const titleWeight = slide.titleStyle?.fontWeight === 'normal' ? 'normal' : 'bold';
  const subtitleColor = slide.subtitleStyle?.color || '#94a3b8';
  const subtitleSize = slide.subtitleStyle?.fontSize === 'small' ? 32 : slide.subtitleStyle?.fontSize === 'large' ? 56 : 44;
  const bulletColor = slide.bulletStyle?.color || '#e2e8f0';
  const bulletSize = slide.bulletStyle?.fontSize === 'small' ? 28 : slide.bulletStyle?.fontSize === 'large' ? 44 : 36;
  const bulletDotColor = slide.bulletDotColor || accentColor;

  const isCoverOrThankYou = slide.role === 'cover' || slide.role === 'thank_you';

  if (isCoverOrThankYou) {
    // Centered layout
    ctx.textAlign = 'center';
    ctx.fillStyle = titleColor;
    ctx.font = `${titleWeight} ${titleSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(slide.title || '', width / 2, height / 2 - 40, width - padding * 2);
    
    if (slide.subtitle) {
      ctx.fillStyle = subtitleColor;
      ctx.font = `${subtitleSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(slide.subtitle, width / 2, height / 2 + 40, width - padding * 2);
    }
    
    ctx.fillStyle = accentColor;
    ctx.fillRect(width / 2 - 60, height / 2 + 80, 120, 4);
  } else {
    // Content slide
    ctx.textAlign = 'left';
    ctx.fillStyle = titleColor;
    ctx.font = `${titleWeight} ${titleSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(slide.title || '', padding, padding + titleSize, width - padding * 2);
    
    let contentY = padding + titleSize + 40;
    if (slide.subtitle) {
      ctx.fillStyle = subtitleColor;
      ctx.font = `${subtitleSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(slide.subtitle, padding, contentY + subtitleSize, width - padding * 2);
      contentY += subtitleSize + 40;
    }
    
    if (slide.bullets && slide.bullets.length > 0) {
      ctx.font = `${bulletSize}px system-ui, -apple-system, sans-serif`;
      const lineHeight = bulletSize + 24;
      
      slide.bullets.forEach((bullet, i) => {
        if (bullet.trim()) {
          const y = contentY + 60 + i * lineHeight;
          ctx.fillStyle = bulletDotColor;
          ctx.beginPath();
          ctx.arc(padding + 12, y - bulletSize / 3, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = bulletColor;
          ctx.fillText(bullet, padding + 40, y, width - padding * 2 - 40);
        }
      });
    }
  }
}
// Component
// ─────────────────────────────────────────────────────────────────────────────

const PresentationTab: React.FC = () => {
  const { language } = useTheme();
  const { user } = useAuth();

  const dragRef = useRef<{
    active: boolean;
    startClientX: number;
    startClientY: number;
    startXPct: number;
    startYPct: number;
    boxWidth: number;
    boxHeight: number;
  } | null>(null);

  const pinchRef = useRef<{
    active: boolean;
    startScale: number;
    startDistance: number;
    pointers: Record<number, { x: number; y: number }>;
  }>({
    active: false,
    startScale: 1,
    startDistance: 0,
    pointers: {},
  });

  // Tab state: 'create' for new presentation, 'my_presentations' for saved list
  const [activeTab, setActiveTab] = useState<'create' | 'my_presentations'>('create');
  
  // Saved presentations
  const [savedPresentations, setSavedPresentations] = useState<Array<{
    id: string;
    title: string;
    share_url: string | null;
    theme: string;
    language: string;
    thumbnail_url: string | null;
    created_at: string;
    updated_at: string;
  }>>([]);
  const [isLoadingPresentations, setIsLoadingPresentations] = useState(false);
  const [currentPresentationId, setCurrentPresentationId] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);
  const hasAttemptedLegacyMigrationRef = useRef(false);

  // Step state
  const [currentStep, setCurrentStep] = useState<Step>('topic');

  // Topic input
  const [topic, setTopic] = useState('');
  const [slideCount, setSlideCount] = useState(4);
  const [researchMode, setResearchMode] = useState(false);
  const [researchModeType, setResearchModeType] = useState<'global' | 'per_slide'>('global');
  const [inputMode, setInputMode] = useState<InputMode>('verbatim');

  const [aiGenerateImagesByMode, setAiGenerateImagesByMode] = useState<InputModeFlags>({
    verbatim: false,
    polish: false,
    topic_only: false,
    blank: false,
  });

  const effectiveResearchMode = inputMode === 'topic_only' && researchMode;

  // Brief
  const [brief, setBrief] = useState<Brief | null>(null);

  // Outline
  const [outline, setOutline] = useState<SlideOutline[]>([]);

  // Slides
  const [slides, setSlides] = useState<Slide[]>([]);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [selectedTheme, setSelectedTheme] = useState<ThemeKey>('pitch_deck');

  // Edit mode
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingField, setEditingField] = useState<'title' | 'subtitle' | 'bullet' | null>(null);
  const [editingBulletIndex, setEditingBulletIndex] = useState<number | null>(null);
  const [applyBackgroundToAllSlides, setApplyBackgroundToAllSlides] = useState(false);
  const [applyVoiceToAllSlides, setApplyVoiceToAllSlides] = useState(true);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [generatedShareUrl, setGeneratedShareUrl] = useState<string | null>(null);
  const [generatedThumbnailUrl, setGeneratedThumbnailUrl] = useState<string | null>(null);
  const [isSavingPresentation, setIsSavingPresentation] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [isSlideResearching, setIsSlideResearching] = useState(false);
  const [isRegeneratingField, setIsRegeneratingField] = useState<{ title: boolean; subtitle: boolean; bullets: Record<number, boolean> }>({
    title: false,
    subtitle: false,
    bullets: {},
  });
  const [slideResearchQuery, setSlideResearchQuery] = useState('');
  const [imagePromptText, setImagePromptText] = useState('');

  const updateCurrentSlideImageTransform = useCallback((updates: Partial<ImageTransform>) => {
    setSlides(prev => prev.map((s, i) => {
      if (i !== selectedSlideIndex) return s;
      const current = s.imageTransform || getDefaultImageTransform();
      return { ...s, imageTransform: { ...current, ...updates } };
    }));
  }, [selectedSlideIndex]);

  const setCurrentSlideFocus = useCallback((fx?: ImageFocusX, fy?: ImageFocusY) => {
    setSlides(prev => prev.map((s, i) => {
      if (i !== selectedSlideIndex) return s;
      const current = s.imageTransform || getDefaultImageTransform();
      const isCrop = (s.imageFit || 'crop') === 'crop';
      const snap = isCrop ? focusToXYForCrop(fx, fy) : focusToXY(fx, fy);

      const nextScale = current.scale ?? 1;
      const next = isCrop
        ? clampTransformForCrop({
            scale: nextScale,
            xPct: snap.xPct,
            yPct: snap.yPct,
          })
        : {
            scale: nextScale,
            xPct: snap.xPct,
            yPct: snap.yPct,
          };

      return {
        ...s,
        imageFocusX: fx,
        imageFocusY: fy,
        imageTransform: {
          ...current,
          scale: next.scale,
          xPct: next.xPct,
          yPct: next.yPct,
        }
      };
    }));
  }, [selectedSlideIndex]);

  const resetCurrentSlideImageTransform = useCallback(() => {
    setSlides(prev => prev.map((s, i) => {
      if (i !== selectedSlideIndex) return s;
      return { ...s, imageTransform: getDefaultImageTransform(), imageFocusX: 'center', imageFocusY: 'center' };
    }));
  }, [selectedSlideIndex]);

  const onImagePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const slide = slides[selectedSlideIndex];
    if (!slide?.imageUrl) return;
    if ((slide.imageFit || 'crop') !== 'crop') return;

    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const t = slide.imageTransform || getDefaultImageTransform();

    // Track touch pointers for pinch-to-zoom
    if (e.pointerType === 'touch') {
      pinchRef.current.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      const pointerIds = Object.keys(pinchRef.current.pointers);
      if (pointerIds.length === 2) {
        const [a, b] = pointerIds.map((id) => pinchRef.current.pointers[Number(id)]);
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        pinchRef.current.active = true;
        pinchRef.current.startScale = t.scale ?? 1;
        pinchRef.current.startDistance = Math.max(1, Math.hypot(dx, dy));
        // Stop drag when pinch starts
        if (dragRef.current) dragRef.current.active = false;
      }
    }

    // Only start dragging if we are NOT pinching.
    if (!pinchRef.current.active) {
      dragRef.current = {
        active: true,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startXPct: t.xPct,
        startYPct: t.yPct,
        boxWidth: rect.width,
        boxHeight: rect.height,
      };
    }

    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }, [slides, selectedSlideIndex]);

  const onImagePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const slide = slides[selectedSlideIndex];
    if (!slide?.imageUrl) return;
    if ((slide.imageFit || 'crop') !== 'crop') return;

    // Pinch-to-zoom (touch)
    if (e.pointerType === 'touch') {
      if (pinchRef.current.pointers[e.pointerId]) {
        pinchRef.current.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      }

      if (pinchRef.current.active) {
        const pointerIds = Object.keys(pinchRef.current.pointers);
        if (pointerIds.length >= 2) {
          const [a, b] = pointerIds.slice(0, 2).map((id) => pinchRef.current.pointers[Number(id)]);
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.max(1, Math.hypot(dx, dy));
          const factor = dist / Math.max(1, pinchRef.current.startDistance);
          const nextScale = clamp((pinchRef.current.startScale ?? 1) * factor, 1, 3);
          updateCurrentSlideImageTransform({ scale: nextScale });
          return;
        }
      }
    }

    if (pinchRef.current.active) return;

    const drag = dragRef.current;
    if (!drag?.active) return;
    if (drag.boxWidth <= 0 || drag.boxHeight <= 0) return;

    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;

    // Convert px drag into object-position offset (percentage points from center).
    // With our xPct/yPct semantics (+ means image moves right/down), dragging should add.
    const nextXPct = drag.startXPct + (dx / drag.boxWidth) * 100;
    const nextYPct = drag.startYPct + (dy / drag.boxHeight) * 100;

    const current = slide.imageTransform || getDefaultImageTransform();
    const next = clampTransformForCrop({
      scale: current.scale ?? 1,
      xPct: nextXPct,
      yPct: nextYPct,
    });

    updateCurrentSlideImageTransform({ xPct: next.xPct, yPct: next.yPct });
  }, [slides, selectedSlideIndex, updateCurrentSlideImageTransform]);

  const onImagePointerUp = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current.active = false;
  }, []);

  const onImagePointerCancelOrUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Clear pointer from pinch tracking
    if (pinchRef.current.pointers[e.pointerId]) {
      delete pinchRef.current.pointers[e.pointerId];
    }
    if (Object.keys(pinchRef.current.pointers).length < 2) {
      pinchRef.current.active = false;
      pinchRef.current.startDistance = 0;
    }

    if (dragRef.current) {
      dragRef.current.active = false;
    }
  }, []);

  const getCurrentSlideTransform = useCallback((): ImageTransform => {
    const slide = slides[selectedSlideIndex];
    return slide?.imageTransform || getDefaultImageTransform();
  }, [slides, selectedSlideIndex]);

  const applyPerSlideResearchBlanks = useCallback((nextSlides: Slide[]) => {
    if (!effectiveResearchMode || researchModeType !== 'per_slide') return nextSlides;

    const coverIndex = 0;
    const firstContentIndex = Math.min(1, nextSlides.length - 1);
    const thankYouIndex = nextSlides.length - 1;

    return nextSlides.map((s, idx) => {
      if (idx === coverIndex || idx === firstContentIndex || idx === thankYouIndex) return s;
      if (s.role === 'cover' || s.role === 'thank_you') return s;
      return {
        ...s,
        role: 'content',
        title: '',
        subtitle: '',
        bullets: [],
        highlightedStats: undefined,
        columns: undefined,
        imageUrl: undefined,
        imageMeta: undefined,
      };
    });
  }, [effectiveResearchMode, researchModeType]);

  const handleGenerateBrief = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      if (inputMode === 'blank') {
        setResearchMode(false);
        setResearchModeType('global');

        const now = Date.now();
        const blankSlides: Slide[] = Array.from({ length: slideCount }).map((_, idx) => {
          const role: Slide['role'] = idx === 0 ? 'cover' : idx === slideCount - 1 ? 'thank_you' : 'content';
          return {
            id: `slide-blank-${now}-${idx}`,
            slideNumber: idx + 1,
            role,
            layoutType: role === 'thank_you' ? 'thank_you' : role === 'cover' ? 'cover' : 'title_and_bullets',
            theme: selectedTheme,
            title: '',
            subtitle: '',
            bullets: [],
          };
        });

        setBrief(null);
        setOutline([]);
        setSlides(blankSlides);
        setSelectedSlideIndex(0);
        setCurrentStep('slides');
        setIsEditMode(true);
        return;
      }

      const response = await callEdgeFunctionWithRetry<{ success: boolean; brief?: Brief; error?: string }>('wakti-pitch-brief', {
        body: {
          topic: topic.trim(),
          slideCount,
          researchMode: effectiveResearchMode,
          inputMode,
          language,
        },
        maxRetries: 2,
        retryDelay: 1000,
      });

      if (!response?.success || !response?.brief) {
        throw new Error(response?.error || 'Failed to generate brief');
      }

      setBrief(response.brief);
      setCurrentStep('brief');
    } catch (e: any) {
      console.error('Brief generation error:', e);
      setError(e?.message || 'Failed to generate brief');
    } finally {
      setIsLoading(false);
    }
  }, [effectiveResearchMode, inputMode, language, selectedTheme, slideCount, topic]);

  const handleGenerateOutline = useCallback(async () => {
    if (!brief) return;

    setIsLoading(true);
    setError('');

    try {
      const effectiveSlideCount = effectiveResearchMode && researchModeType === 'per_slide' ? 3 : slideCount;

      const response = await callEdgeFunctionWithRetry<{
        success: boolean;
        outline?: SlideOutline[];
        error?: string;
      }>('wakti-pitch-outline', {
        body: {
          brief,
          slideCount: effectiveSlideCount,
          theme: selectedTheme,
          language,
          inputMode,
          originalText: topic,
          researchMode: effectiveResearchMode,
        },
        maxRetries: 2,
        retryDelay: 1000,
      });

      if (!response?.success || !response?.outline) {
        throw new Error(response?.error || 'Failed to generate outline');
      }

      setOutline(response.outline);
      setCurrentStep('outline');
    } catch (e: any) {
      console.error('Outline generation error:', e);
      setError(e?.message || 'Failed to generate outline');
    } finally {
      setIsLoading(false);
    }
  }, [brief, effectiveResearchMode, inputMode, language, researchModeType, selectedTheme, slideCount, topic]);

  const handleGenerateSlides = useCallback(async () => {
    if (outline.length === 0) return;
    setIsLoading(true);
    setError('');

    try {
      const isPerSlideResearch = effectiveResearchMode && researchModeType === 'per_slide';

      const shouldGenerateImages = !!aiGenerateImagesByMode[inputMode];

      // Call the edge function to generate slides (images are optional)
      const response = await callEdgeFunctionWithRetry<{
        success: boolean;
        slides?: Slide[];
        error?: string;
      }>('wakti-pitch-slides', {
        body: {
          outline,
          brief: brief ? {
            subject: brief.subject,
            objective: brief.objective,
            audience: brief.audience,
            scenario: brief.scenario,
            tone: brief.tone,
          } : null,
          theme: selectedTheme,
          language,
          generateImages: shouldGenerateImages,
        },
        maxRetries: 2,
        retryDelay: 1000,
      });

      if (!response?.success || !response?.slides) {
        throw new Error(response?.error || 'Failed to generate slides');
      }

      // Ensure there's always a "Thank You" slide at the end
      let finalSlides = response.slides;

      // If AI Images is disabled for this mode, ensure we don't auto-attach any images
      if (!shouldGenerateImages) {
        finalSlides = finalSlides.map((s) => ({
          ...s,
          imageUrl: undefined,
          imageMeta: undefined,
        }));
      }
      const hasThankYou = finalSlides.some(s => s.role === 'thank_you');
      if (!hasThankYou) {
        const thankYouSlide: Slide = {
          id: `slide-thankyou-${Date.now()}`,
          slideNumber: finalSlides.length + 1,
          role: 'thank_you',
          layoutType: 'thank_you',
          theme: selectedTheme,
          title: language === 'ar' ? 'شكراً لكم' : 'Thank You',
          subtitle: language === 'ar' ? 'هل لديكم أي أسئلة؟' : 'Any Questions?',
          bullets: [],
        };
        finalSlides = [...finalSlides, thankYouSlide];
      }

      let slidesForDisplay = finalSlides;

      if (isPerSlideResearch) {
        const cover = slidesForDisplay[0];
        const firstContent = slidesForDisplay[1] || slidesForDisplay[0];
        const thankYou = slidesForDisplay[slidesForDisplay.length - 1];

        const blanksNeeded = Math.max(0, slideCount - 3);
        const blankSlides: Slide[] = Array.from({ length: blanksNeeded }).map((_, idx) => ({
          id: `slide-blank-${Date.now()}-${idx}`,
          slideNumber: 3 + idx,
          role: 'content',
          layoutType: 'title_and_bullets',
          theme: selectedTheme,
          title: '',
          subtitle: '',
          bullets: [],
        }));

        slidesForDisplay = [
          { ...cover, slideNumber: 1, role: 'cover' },
          { ...firstContent, slideNumber: 2, role: firstContent.role === 'thank_you' ? 'content' : firstContent.role },
          ...blankSlides,
          { ...thankYou, slideNumber: slideCount, role: 'thank_you' },
        ];
      } else {
        slidesForDisplay = applyPerSlideResearchBlanks(slidesForDisplay);
      }

      setSlides(slidesForDisplay);
      setSelectedSlideIndex(0);
      setCurrentStep('slides');

      // New generation = new record in "My Presentations"
      setCurrentPresentationId(null);
      setGeneratedShareUrl(null);
    } catch (e: any) {
      console.error('Slides generation error:', e);
      setError(e?.message || 'Failed to generate slides');
    } finally {
      setIsLoading(false);
    }
  }, [outline, selectedTheme, brief, language, applyPerSlideResearchBlanks, effectiveResearchMode, researchModeType, slideCount, aiGenerateImagesByMode, inputMode]);

  // Regenerate image for current slide using AI (simple auto-only)
  const handleRegenerateImage = useCallback(async () => {
    if (slides.length === 0) return;
    
    const currentSlide = slides[selectedSlideIndex];
    if (!currentSlide) return;

    setIsRegeneratingImage(true);

    try {
      // If slide is empty and no custom prompt, use a default based on role
      let effectivePrompt = imagePromptText.trim();
      const hasContent = currentSlide.title || (currentSlide.bullets && currentSlide.bullets.length > 0);
      if (!hasContent && !effectivePrompt) {
        // Provide a sensible default for blank slides
        const defaultPrompts: Record<string, string> = {
          cover: 'professional presentation cover, modern design, clean',
          content: 'professional business scene, modern, clean composition',
          thank_you: 'thank you, celebration, success, professional',
        };
        effectivePrompt = defaultPrompts[currentSlide.role] || defaultPrompts.content;
      }

      const response = await callEdgeFunctionWithRetry<{
        success: boolean;
        imageUrl?: string;
        error?: string;
      }>('wakti-slide-regenerate-image', {
        body: {
          title: currentSlide.title,
          bullets: currentSlide.bullets,
          role: currentSlide.role,
          objective: brief?.objective,
          audience: brief?.audience,
          tone: brief?.tone,
          userPrompt: effectivePrompt || undefined,
        },
        maxRetries: 2,
        retryDelay: 1000,
      });

      if (!response?.success || !response?.imageUrl) {
        throw new Error(response?.error || 'Failed to regenerate image');
      }

      // Update the slide with the new image
      setSlides(prev => prev.map((s, i) =>
        i === selectedSlideIndex ? { ...s, imageUrl: response.imageUrl, imageFit: (s.imageFit || 'crop'), imageTransform: getDefaultImageTransform(), imageFocusX: 'center', imageFocusY: 'center' } : s
      ));

      setImagePromptText('');

      toast.success(language === 'ar' ? 'تم إنشاء الصورة بنجاح' : 'Image regenerated successfully');
    } catch (e: any) {
      console.error('Image regeneration error:', e);
      toast.error(language === 'ar' ? 'فشل إنشاء الصورة' : 'Failed to regenerate image');
    } finally {
      setIsRegeneratingImage(false);
    }
  }, [slides, selectedSlideIndex, brief, language, imagePromptText]);

  // Export as PDF
  const handleExportPDF = useCallback(async () => {
    if (slides.length === 0) return;
    setIsExporting(true);
    setShowExportMenu(false);
    
    // Dismiss any existing toasts first
    toast.dismiss();
    
    const toastId = toast.loading(language === 'ar' ? 'جارٍ إنشاء PDF...' : 'Creating PDF...');
    
    try {
      const pdfBlob = await exportSlidesToPDFClean(
        slides,
        brief?.subject || topic,
        selectedTheme,
        language
      );

      const filename = generateFilename(brief?.subject || topic, 'pdf');
      await downloadBlob(pdfBlob, filename);

      toast.dismiss(toastId);
      toast.success(language === 'ar' ? `تم حفظ ${filename}` : `Saved ${filename}`);
    } catch (err) {
      console.error('PDF export error:', err);
      toast.dismiss(toastId);
      toast.error(language === 'ar' ? 'فشل في تصدير PDF' : 'Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  }, [slides, brief, topic, selectedTheme, language]);

  // Export as PPTX (PowerPoint)
  const handleExportPPTX = useCallback(async () => {
    if (slides.length === 0) return;
    setIsExporting(true);
    setShowExportMenu(false);
    
    // Dismiss any existing toasts first
    toast.dismiss();
    
    const toastId = toast.loading(language === 'ar' ? 'جارٍ إنشاء PowerPoint...' : 'Creating PowerPoint...');
    
    try {
      const pptxBlob = await exportSlidesToPPTX(
        slides,
        brief?.subject || topic,
        selectedTheme,
        language
      );

      const filename = generateFilename(brief?.subject || topic, 'pptx');
      await downloadBlob(pptxBlob, filename);

      toast.dismiss(toastId);
      toast.success(language === 'ar' ? `تم حفظ ${filename}` : `Saved ${filename}`);
    } catch (err) {
      console.error('PPTX export error:', err);
      toast.dismiss(toastId);
      toast.error(language === 'ar' ? 'فشل في تصدير PowerPoint' : 'Failed to export PowerPoint');
    } finally {
      setIsExporting(false);
    }
  }, [slides, brief, topic, selectedTheme, language]);

  // Cache for generated slide audio (persists during session)
  const slideAudioCache = React.useRef<Map<string, { blob: Blob; durationMs: number }>>(new Map());
  
  // Ref for the slide preview element (used for html2canvas capture)
  const slidePreviewRef = useRef<HTMLDivElement>(null);

  const waitForNextPaint = useCallback(async (): Promise<void> => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }, []);

  const waitForSlideAssetsReady = useCallback(async (root: HTMLElement): Promise<void> => {
    // Wait for fonts if supported
    try {
      const anyDoc = document as unknown as { fonts?: { ready?: Promise<unknown> } };
      if (anyDoc.fonts?.ready) {
        await anyDoc.fonts.ready;
      }
    } catch {
      // ignore
    }

    // Wait for images inside the slide preview
    const imgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[];
    await Promise.all(
      imgs.map(async (img) => {
        if (img.complete && img.naturalWidth > 0) {
          return;
        }
        try {
          // decode() is more reliable than onload for already-started loads
          if (typeof (img as any).decode === 'function') {
            await (img as any).decode();
            return;
          }
        } catch {
          // fall back to load event
        }
        await new Promise<void>((resolve) => {
          const cleanup = () => {
            img.removeEventListener('load', onLoad);
            img.removeEventListener('error', onLoad);
          };
          const onLoad = () => {
            cleanup();
            resolve();
          };
          img.addEventListener('load', onLoad);
          img.addEventListener('error', onLoad);
        });
      })
    );

    // Give layout one extra frame to settle (line wrapping / font swap)
    await waitForNextPaint();
  }, [waitForNextPaint]);

  // Pre-bake image transforms to a canvas data URL so html2canvas captures them correctly
  // This replicates the CSS: object-fit: cover, object-position, transform: scale()
  const bakeImageTransform = useCallback(async (slide: Slide): Promise<string | null> => {
    if (!slide.imageUrl) return null;
    const fit = slide.imageFit || 'crop';
    if (fit !== 'crop') return null; // Only crop mode needs baking

    const t = clampTransformForCrop(getEffectiveTransform(slide));
    const userScale = t.scale ?? 1;
    const effectiveScale = userScale * CROP_OVERSCAN_SCALE;
    // objX/objY are 0-100 representing object-position percentage
    const objX = clamp(50 - (t.xPct ?? 0), 0, 100);
    const objY = clamp(50 - (t.yPct ?? 0), 0, 100);

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Target canvas size (matches the slide image container aspect ratio ~16:9)
        const canvasW = 800;
        const canvasH = 450;
        const canvasAspect = canvasW / canvasH;

        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }

        const imgW = img.naturalWidth;
        const imgH = img.naturalHeight;
        const imgAspect = imgW / imgH;

        // Step 1: Calculate "object-fit: cover" dimensions
        // The image is scaled to cover the container while maintaining aspect ratio
        let coverW: number, coverH: number;
        if (imgAspect > canvasAspect) {
          // Image is wider than container - height fills, width crops
          coverH = canvasH;
          coverW = canvasH * imgAspect;
        } else {
          // Image is taller than container - width fills, height crops
          coverW = canvasW;
          coverH = canvasW / imgAspect;
        }

        // Step 2: Apply the scale transform (zoom in)
        const scaledW = coverW * effectiveScale;
        const scaledH = coverH * effectiveScale;

        // Step 3: Calculate position based on object-position
        // object-position: X% Y% means the X% point of the image aligns with the X% point of the container
        const drawX = (canvasW - scaledW) * (objX / 100);
        const drawY = (canvasH - scaledH) * (objY / 100);

        // Draw the image with the calculated transform
        ctx.drawImage(img, drawX, drawY, scaledW, scaledH);
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
      img.onerror = () => resolve(null);
      img.src = slide.imageUrl!;
    });
  }, []);

  // Generate a hash for slide content to detect changes
  const getSlideHash = (slide: Slide, voiceGender: string): string => {
    const text = buildNarrationText(slide);
    return `${text}-${voiceGender}-${language}`;
  };

  // Generate or retrieve cached audio for a slide
  const getSlideAudio = async (
    slide: Slide,
    slideIndex: number,
    toastId: string | number,
    token: string
  ): Promise<{ blob: Blob; durationMs: number } | null> => {
    const hash = getSlideHash(slide, slide.voiceGender || 'male');
    
    // Check cache first
    if (slideAudioCache.current.has(hash)) {
      console.log(`Using cached audio for slide ${slideIndex + 1}`);
      return slideAudioCache.current.get(hash)!;
    }

    const narrationText = buildNarrationText(slide);
    if (!narrationText.trim()) {
      return null;
    }

    toast.loading(
      language === 'ar' 
        ? `جارٍ إنشاء الصوت للشريحة ${slideIndex + 1}/${slides.length}...`
        : `Generating audio for slide ${slideIndex + 1}/${slides.length}...`,
      { id: toastId }
    );

    const response = await fetch(
      'https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/presentation-elevenlabs-tts',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: narrationText,
          language: language,
          gender: slide.voiceGender || 'male',
        }),
      }
    );

    if (!response.ok) {
      console.error(`TTS error for slide ${slideIndex + 1}:`, await response.text());
      return null;
    }

    const audioBlob = await response.blob();
    
    // Get actual duration by decoding audio
    let durationMs = 5000; // Default fallback
    try {
      const audioContext = new AudioContext();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      durationMs = audioBuffer.duration * 1000;
      await audioContext.close();
    } catch (e) {
      // Estimate: ~150 words per minute, ~5 chars per word
      durationMs = Math.max(3000, (narrationText.length / 5 / 150) * 60 * 1000);
    }

    const result = { blob: audioBlob, durationMs };
    slideAudioCache.current.set(hash, result);
    return result;
  };

  const handleCreateShareLink = useCallback(async () => {
    if (slides.length === 0) return;
    
    // If we already have a share link, just copy it again
    if (generatedShareUrl) {
      try {
        await navigator.clipboard.writeText(generatedShareUrl);
        toast.success(language === 'ar' ? 'تم نسخ رابط المشاركة' : 'Share link copied');
        toast.success(generatedShareUrl);
      } catch {
        toast.error(language === 'ar' ? 'فشل في نسخ الرابط' : 'Failed to copy link');
      }
      setShowExportMenu(false);
      return;
    }
    
    if (!slidePreviewRef.current) {
      toast.error(language === 'ar' ? 'خطأ: لم يتم العثور على الشريحة' : 'Error: Slide preview not found');
      return;
    }

    setIsExporting(true);
    setShowExportMenu(false);

    toast.dismiss();
    const toastId = toast.loading(language === 'ar' ? 'جارٍ إنشاء رابط المشاركة...' : 'Creating share link...');

    const originalSlideIndex = selectedSlideIndex;

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const shareToken = generateShareToken(12);
      const bucket = 'ai-temp-images';
      const basePath = `presentation-share/${shareToken}`;

      toast.loading(language === 'ar' ? 'التحقق من التخزين...' : 'Checking storage...', { id: toastId });
      const preflightPath = `${basePath}/preflight.txt`;
      const preflightBlob = new Blob([`ok:${new Date().toISOString()}`], { type: 'text/plain' });
      const { error: preflightErr } = await supabase.storage.from(bucket).upload(preflightPath, preflightBlob, {
        contentType: 'text/plain',
        upsert: true,
      });
      if (preflightErr) throw preflightErr;

      // Step 2: Capture a single thumbnail (for "My Presentations")
      toast.loading(language === 'ar' ? 'جارٍ إنشاء الصورة المصغرة...' : 'Creating thumbnail...', { id: toastId });

      const originalSlides = [...slides];
      const thumbnailPath = `${basePath}/thumbnail.jpg`;

      // Render first slide for thumbnail
      setSelectedSlideIndex(0);
      await waitForNextPaint();
      if (slidePreviewRef.current) {
        await waitForSlideAssetsReady(slidePreviewRef.current);
      }
      await new Promise(r => setTimeout(r, 200));

      // Pre-bake image transform and directly manipulate DOM before capture (thumbnail only)
      const firstSlide = originalSlides[0];
      const bakedImageUrl = firstSlide ? await bakeImageTransform(firstSlide) : null;
      let originalImgSrc: string | null = null;
      let originalImgStyle: string | null = null;
      let imgElement: HTMLImageElement | null = null;

      if (bakedImageUrl && slidePreviewRef.current) {
        imgElement = slidePreviewRef.current.querySelector('img') as HTMLImageElement | null;
        if (imgElement) {
          originalImgSrc = imgElement.src;
          originalImgStyle = imgElement.getAttribute('style');
          imgElement.src = bakedImageUrl;
          imgElement.style.cssText = 'width: 100%; height: 100%; object-fit: fill; transform: none;';
          await new Promise<void>((resolve) => {
            const onLoad = () => { resolve(); };
            if (imgElement!.complete) { resolve(); return; }
            imgElement!.addEventListener('load', onLoad, { once: true });
            setTimeout(resolve, 500);
          });
        }
      }

      const thumbCanvas = await html2canvas(slidePreviewRef.current!, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
      });

      if (imgElement && originalImgSrc) {
        imgElement.src = originalImgSrc;
        if (originalImgStyle) {
          imgElement.setAttribute('style', originalImgStyle);
        }
      }

      const thumbJpeg = thumbCanvas.toDataURL('image/jpeg', 0.92);
      const thumbBlob = dataUrlToBlob(thumbJpeg);
      const { error: thumbUploadErr } = await supabase.storage.from(bucket).upload(thumbnailPath, thumbBlob, {
        contentType: 'image/jpeg',
        upsert: true,
      });
      if (thumbUploadErr) throw thumbUploadErr;

      const { data: thumbUrlData } = supabase.storage.from(bucket).getPublicUrl(thumbnailPath);
      setGeneratedThumbnailUrl(thumbUrlData.publicUrl);

      // Restore original slide index
      setSelectedSlideIndex(originalSlideIndex);

      // Step 3: Generate/retrieve audio for all slides (per-slide) to get exact durations
      const slideAudioData: { blob: Blob | null; durationMs: number }[] = [];
      const TRANSITION_MS = 100; // Small gap between slides (breathing room)

      for (let i = 0; i < slides.length; i++) {
        toast.loading(
          language === 'ar' ? `جارٍ إنشاء الصوت ${i + 1}/${slides.length}...` : `Audio ${i + 1}/${slides.length}...`,
          { id: toastId }
        );
        const audio = await getSlideAudio(slides[i], i, toastId, token);
        slideAudioData.push(audio || { blob: null, durationMs: 3000 });
      }

      // Step 4: Merge per-slide audio into one WAV track, and compute cue points
      // We compute cue points from decoded sample lengths to avoid drift.
      toast.loading(language === 'ar' ? 'جارٍ تجميع الصوت...' : 'Combining audio...', { id: toastId });

      const audioContext = new AudioContext();
      const gapSamples = Math.ceil((TRANSITION_MS / 1000) * audioContext.sampleRate);
      const cuePoints: { startMs: number; durationMs: number }[] = [];

      const decodedBuffers: Array<AudioBuffer | null> = [];
      for (let i = 0; i < slideAudioData.length; i++) {
        const audio = slideAudioData[i];
        if (audio.blob && audio.blob.size > 0) {
          try {
            const arrayBuffer = await audio.blob.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
            decodedBuffers.push(audioBuffer);
            continue;
          } catch (e) {
            console.error(`Failed to decode audio for slide ${i}:`, e);
          }
        }
        decodedBuffers.push(null);
      }

      // Compute total samples based on decoded buffers + gap.
      const fallbackSilentSamples = Math.ceil(1.0 * audioContext.sampleRate);
      const perSlideSamples = decodedBuffers.map((b) => (b ? b.length : fallbackSilentSamples));
      const totalSamples = perSlideSamples.reduce((acc, s) => acc + s + gapSamples, 0);
      const combinedBuffer = audioContext.createBuffer(2, totalSamples, audioContext.sampleRate);

      const leftChannel = combinedBuffer.getChannelData(0);
      const rightChannel = combinedBuffer.getChannelData(1);

      let sampleOffset = 0;
      for (let i = 0; i < decodedBuffers.length; i++) {
        const startMs = (sampleOffset / audioContext.sampleRate) * 1000;
        const slideSamples = perSlideSamples[i] ?? fallbackSilentSamples;
        const durationMs = ((slideSamples + gapSamples) / audioContext.sampleRate) * 1000;
        cuePoints.push({ startMs, durationMs });

        const buf = decodedBuffers[i];
        if (buf) {
          const l = buf.getChannelData(0);
          const r = buf.numberOfChannels > 1 ? buf.getChannelData(1) : l;
          const copyLen = Math.min(slideSamples, l.length);
          for (let j = 0; j < copyLen && sampleOffset + j < totalSamples; j++) {
            leftChannel[sampleOffset + j] = l[j];
            rightChannel[sampleOffset + j] = r[j];
          }
        }
        // advance over slide audio + gap (gap stays zeros)
        sampleOffset += slideSamples + gapSamples;
      }

      const totalDurationMs = (totalSamples / audioContext.sampleRate) * 1000;

      const wavBlob = audioBufferToWav(combinedBuffer);
      await audioContext.close();

      const audioPath = `${basePath}/audio.wav`;
      const { error: audioUploadErr } = await supabase.storage.from(bucket).upload(audioPath, wavBlob, {
        contentType: 'audio/wav',
        upsert: true,
      });
      if (audioUploadErr) throw audioUploadErr;

      // Step 5: Write manifest.json (v2: data-driven slides)
      const title = brief?.subject || topic || (language === 'ar' ? 'عرض تقديمي' : 'Presentation');
      const manifest: ShareManifestV2 = {
        version: 2,
        createdAt: new Date().toISOString(),
        title,
        theme: selectedTheme,
        language,
        audioPath,
        totalDurationMs,
        thumbnailPath,
        slides: slides.map((s, idx) => ({
          index: idx,
          title: s.title || `Slide ${idx + 1}`,
          startMs: cuePoints[idx]?.startMs ?? 0,
          durationMs: cuePoints[idx]?.durationMs ?? 0,
          data: {
            id: s.id,
            slideNumber: s.slideNumber,
            role: s.role,
            layoutType: s.layoutType,
            theme: s.theme,
            title: s.title,
            subtitle: s.subtitle,
            bullets: s.bullets,
            highlightedStats: s.highlightedStats,
            columns: s.columns as unknown[] | undefined,
            imageUrl: s.imageUrl,
            imageMeta: s.imageMeta,
            footer: s.footer,
            titleStyle: s.titleStyle,
            subtitleStyle: s.subtitleStyle,
            bulletStyle: s.bulletStyle,
            accentColor: s.accentColor,
            accentFontWeight: s.accentFontWeight,
            accentFontStyle: s.accentFontStyle,
            accentFontSize: s.accentFontSize,
            bulletDotColor: s.bulletDotColor,
            bulletDotSize: s.bulletDotSize,
            bulletDotShape: s.bulletDotShape,
            layoutVariant: s.layoutVariant,
            imageSize: s.imageSize,
            imageFit: s.imageFit,
            imageTransform: s.imageTransform,
            imageFocusX: s.imageFocusX,
            imageFocusY: s.imageFocusY,
            slideBg: s.slideBg,
            voiceGender: s.voiceGender,
          },
        })),
      };

      const manifestPath = `${basePath}/manifest.json`;
      const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
      const { error: manifestErr } = await supabase.storage.from(bucket).upload(manifestPath, manifestBlob, {
        contentType: 'application/json',
        upsert: true,
      });
      if (manifestErr) throw manifestErr;

      const shareBaseUrl =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? 'http://localhost:8080'
          : window.location.origin;
      const shareUrl = `${shareBaseUrl}/p/${shareToken}`;
      setGeneratedShareUrl(shareUrl);
      try {
        await navigator.clipboard.writeText(shareUrl);
      } catch {
        // ignore
      }

      toast.dismiss(toastId);
      toast.success(language === 'ar' ? 'تم نسخ رابط المشاركة' : 'Share link copied');
      toast.success(shareUrl);
      // Auto-save is triggered by the useEffect watching generatedShareUrl
    } catch (err) {
      console.error('Share link error:', err);
      toast.dismiss(toastId);
      toast.error(language === 'ar' ? 'فشل في إنشاء رابط المشاركة' : 'Failed to create share link');
    } finally {
      setIsExporting(false);
    }
  }, [bakeImageTransform, brief, generatedShareUrl, language, selectedSlideIndex, selectedTheme, slides, topic, waitForNextPaint, waitForSlideAssetsReady]);

  // Load saved presentations
  const loadSavedPresentations = useCallback(async () => {
    if (!user?.id) return;
    setIsLoadingPresentations(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('user_presentations')
        .select('id, title, share_url, theme, language, thumbnail_url, created_at, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      
      if (fetchError) throw fetchError;
      setSavedPresentations(data || []);
    } catch (err) {
      console.error('Failed to load presentations:', err);
      toast.error(language === 'ar' ? 'فشل في تحميل العروض' : 'Failed to load presentations');
    } finally {
      setIsLoadingPresentations(false);
    }
  }, [user?.id, language]);

  const upsertPresentation = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user?.id || slides.length === 0) return;

    const silent = !!opts?.silent;
    if (!silent) setIsSavingPresentation(true);

    const title = brief?.subject || topic || (language === 'ar' ? 'عرض تقديمي' : 'Presentation');

    try {
      const slidesData = slides.map(s => ({
        ...s,
        imageUrl: s.imageUrl || null,
      }));

      // Use thumbnail from share link generation if available, otherwise capture on manual save
      let thumbnailUrl: string | null = generatedThumbnailUrl;
      if (!thumbnailUrl && !silent && slidePreviewRef.current && slides.length > 0) {
        try {
          // Capture current slide as thumbnail (don't change slide index)
          const canvas = await html2canvas(slidePreviewRef.current, {
            scale: 0.5,
            useCORS: true,
            allowTaint: true,
            backgroundColor: null,
          });
          const thumbBlob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.7)
          );
          
          if (thumbBlob) {
            const thumbPath = `presentation-thumbnails/${user.id}/${Date.now()}.jpg`;
            const { error: thumbErr } = await supabase.storage
              .from('ai-temp-images')
              .upload(thumbPath, thumbBlob, { contentType: 'image/jpeg', upsert: true });
            if (!thumbErr) {
              const { data: urlData } = supabase.storage.from('ai-temp-images').getPublicUrl(thumbPath);
              thumbnailUrl = urlData.publicUrl;
            }
          }
        } catch (thumbError) {
          console.warn('Thumbnail capture failed:', thumbError);
        }
      }

      if (currentPresentationId) {
        const updatePayload: Record<string, unknown> = {
          title,
          theme: selectedTheme,
          language,
          slides_data: slidesData,
          share_url: generatedShareUrl,
          updated_at: new Date().toISOString(),
        };
        if (thumbnailUrl) updatePayload.thumbnail_url = thumbnailUrl;
        
        const { error: updateError } = await supabase
          .from('user_presentations')
          .update(updatePayload)
          .eq('id', currentPresentationId);

        if (updateError) throw updateError;
        if (!silent) toast.success(language === 'ar' ? 'تم حفظ العرض' : 'Presentation saved');
      } else {
        const { data: newPres, error: insertError } = await supabase
          .from('user_presentations')
          .insert({
            user_id: user.id,
            title,
            theme: selectedTheme,
            language,
            slides_data: slidesData as unknown as import('@/integrations/supabase/types').Json,
            share_url: generatedShareUrl,
            thumbnail_url: thumbnailUrl || null,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        setCurrentPresentationId(newPres.id);
        if (!silent) toast.success(language === 'ar' ? 'تم حفظ العرض' : 'Presentation saved');
      }

      await loadSavedPresentations();
    } catch (err) {
      console.error('Failed to save presentation:', err);
      if (!silent) toast.error(language === 'ar' ? 'فشل في حفظ العرض' : 'Failed to save presentation');
    } finally {
      if (!silent) setIsSavingPresentation(false);
    }
  }, [user?.id, slides, brief, topic, language, selectedTheme, currentPresentationId, generatedShareUrl, generatedThumbnailUrl, loadSavedPresentations]);

  // Save current presentation (manual, with toasts)
  const savePresentation = useCallback(async () => {
    await upsertPresentation({ silent: false });
  }, [upsertPresentation]);

  const queueAutoSave = useCallback((delayMs = 900) => {
    if (!user?.id) return;
    if (slides.length === 0) return;
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => {
      upsertPresentation({ silent: true });
    }, delayMs);
  }, [slides.length, upsertPresentation, user?.id]);

  // Auto-save whenever slides exist and the user is on the slides step.
  useEffect(() => {
    if (currentStep !== 'slides') return;
    if (!user?.id) return;
    if (slides.length === 0) return;
    queueAutoSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides, currentStep, user?.id]);

  // Auto-save when share link is generated/updated.
  useEffect(() => {
    if (!generatedShareUrl) return;
    if (!user?.id) return;
    if (slides.length === 0) return;
    queueAutoSave(200);
  }, [generatedShareUrl, queueAutoSave, slides.length, user?.id]);

  const migrateLegacyPresentations = useCallback(async () => {
    if (hasAttemptedLegacyMigrationRef.current) return;
    hasAttemptedLegacyMigrationRef.current = true;
    if (!user?.id) return;

    type LegacyPresentation = {
      title?: string;
      theme?: string;
      language?: string;
      slides?: unknown;
      slides_data?: unknown;
      share_url?: string | null;
      updated_at?: string;
      created_at?: string;
    };

    const candidateKeys = [
      'wakti_presentations',
      'wakti_presentation_history',
      'presentation_history',
      'presentations',
      'wakti_presentation_drafts',
    ];

    const candidates: LegacyPresentation[] = [];

    try {
      for (const k of candidateKeys) {
        const raw = window.localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          candidates.push(...parsed);
        }
      }
    } catch (e) {
      // Ignore malformed legacy data
      console.warn('Legacy presentations parse error:', e);
    }

    if (candidates.length === 0) return;

    // Best-effort insert. We do simple dedupe by share_url + title.
    let inserted = 0;
    for (const item of candidates) {
      const title = (item.title || (language === 'ar' ? 'عرض تقديمي' : 'Presentation')) as string;
      const theme = (item.theme || selectedTheme) as string;
      const lang = (item.language || language) as string;
      const slidesData = (item.slides_data || item.slides || []) as unknown;
      const shareUrl = (item.share_url ?? null) as string | null;

      try {
        // Skip if already exists in current loaded list
        const already = savedPresentations.some((p) => (shareUrl && p.share_url === shareUrl) || p.title === title);
        if (already) continue;

        const { error: insertError } = await supabase
          .from('user_presentations')
          .insert({
            user_id: user.id,
            title,
            theme,
            language: lang,
            slides_data: slidesData as unknown as import('@/integrations/supabase/types').Json,
            share_url: shareUrl,
          });

        if (insertError) {
          console.warn('Legacy insert failed:', insertError);
          continue;
        }
        inserted += 1;
      } catch (e) {
        console.warn('Legacy insert exception:', e);
      }
    }

    if (inserted > 0) {
      toast.success(language === 'ar' ? `تم استيراد ${inserted} عروض` : `Imported ${inserted} presentations`);
      await loadSavedPresentations();
    }
  }, [language, loadSavedPresentations, savedPresentations, selectedTheme, user?.id]);

  // Load a saved presentation
  const loadPresentation = useCallback(async (presentationId: string) => {
    setIsLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('user_presentations')
        .select('*')
        .eq('id', presentationId)
        .single();
      
      if (fetchError) throw fetchError;
      if (!data) throw new Error('Presentation not found');
      
      // Restore state
      setCurrentPresentationId(data.id);
      setSelectedTheme(data.theme as ThemeKey);
      setGeneratedShareUrl(data.share_url);
      const loadedSlides = Array.isArray(data.slides_data) ? (data.slides_data as unknown as Slide[]) : [];
      setSlides(loadedSlides);
      setCurrentStep('slides');
      setActiveTab('create');
      
      toast.success(language === 'ar' ? 'تم تحميل العرض' : 'Presentation loaded');
    } catch (err) {
      console.error('Failed to load presentation:', err);
      toast.error(language === 'ar' ? 'فشل في تحميل العرض' : 'Failed to load presentation');
    } finally {
      setIsLoading(false);
    }
  }, [language]);

  // Delete a presentation
  const deletePresentation = useCallback(async (presentationId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('user_presentations')
        .delete()
        .eq('id', presentationId);
      
      if (deleteError) throw deleteError;
      
      setSavedPresentations(prev => prev.filter(p => p.id !== presentationId));
      if (currentPresentationId === presentationId) {
        setCurrentPresentationId(null);
      }
      toast.success(language === 'ar' ? 'تم حذف العرض' : 'Presentation deleted');
    } catch (err) {
      console.error('Failed to delete presentation:', err);
      toast.error(language === 'ar' ? 'فشل في حذف العرض' : 'Failed to delete presentation');
    }
  }, [currentPresentationId, language]);

  // Edit slide content
  const updateSlideField = useCallback((field: 'title' | 'subtitle', value: string) => {
    setSlides(prev => prev.map((slide, i) => 
      i === selectedSlideIndex ? { ...slide, [field]: value } : slide
    ));
  }, [selectedSlideIndex]);

  const updateSlideBullet = useCallback((bulletIndex: number, value: string) => {
    setSlides(prev => prev.map((slide, i) => {
      if (i !== selectedSlideIndex) return slide;
      const newBullets = [...(slide.bullets || [])];
      newBullets[bulletIndex] = value;
      return { ...slide, bullets: newBullets };
    }));
  }, [selectedSlideIndex]);

  const deleteSlideBullet = useCallback((bulletIndex: number) => {
    setSlides(prev => prev.map((slide, i) => {
      if (i !== selectedSlideIndex) return slide;
      const newBullets = (slide.bullets || []).filter((_, idx) => idx !== bulletIndex);
      return { ...slide, bullets: newBullets };
    }));
  }, [selectedSlideIndex]);

  const addSlideBullet = useCallback(() => {
    setSlides(prev => {
      const newSlides = [...prev];
      const slide = newSlides[selectedSlideIndex];
      if (slide) {
        const newBullets = [...(slide.bullets || []), ''];
        newSlides[selectedSlideIndex] = { ...slide, bullets: newBullets };
      }
      return newSlides;
    });
  }, [selectedSlideIndex]);

  const renumberSlides = useCallback((nextSlides: Slide[]) => {
    return nextSlides.map((s, idx) => ({ ...s, slideNumber: idx + 1 }));
  }, []);

  const isLockedSlide = useCallback((slide?: Slide) => {
    return slide?.role === 'cover' || slide?.role === 'thank_you';
  }, []);

  const handleAddSlideAfterCurrent = useCallback(() => {
    if (slides.length === 0) return;

    const currentSlide = slides[selectedSlideIndex];
    const lastIndex = slides.length - 1;
    const hasThankYouAtEnd = slides[lastIndex]?.role === 'thank_you';
    const maxInsertIndex = hasThankYouAtEnd ? lastIndex : slides.length;
    const insertIndex = Math.min(selectedSlideIndex + 1, maxInsertIndex);

    const newSlide: Slide = {
      id: `slide-custom-${Date.now()}`,
      slideNumber: insertIndex + 1,
      role: 'content',
      layoutType: 'title_and_bullets',
      theme: selectedTheme,
      title: language === 'ar' ? 'شريحة جديدة' : 'New Slide',
      subtitle: '',
      bullets: [language === 'ar' ? 'نقطة جديدة' : 'New bullet point'],
    };

    const next = [...slides.slice(0, insertIndex), newSlide, ...slides.slice(insertIndex)];
    const renumbered = renumberSlides(next);
    setSlides(renumbered);
    setSelectedSlideIndex(insertIndex);
  }, [language, renumberSlides, selectedSlideIndex, selectedTheme, slides]);

  const handleDeleteCurrentSlide = useCallback(() => {
    if (slides.length === 0) return;

    const currentSlide = slides[selectedSlideIndex];
    if (isLockedSlide(currentSlide)) {
      toast.error(language === 'ar' ? 'لا يمكن حذف شريحة الغلاف أو شريحة الشكر' : 'Cover and Thank You slides cannot be deleted');
      return;
    }

    const next = slides.filter((_, idx) => idx !== selectedSlideIndex);
    const renumbered = renumberSlides(next);

    const nextIndex = Math.min(selectedSlideIndex, Math.max(0, renumbered.length - 1));
    setSlides(renumbered);
    setSelectedSlideIndex(nextIndex);
  }, [isLockedSlide, language, renumberSlides, selectedSlideIndex, slides]);

  // Update text styling
  const applySlideUpdate = useCallback(
    (updateFn: (slide: Slide) => Slide) => {
      setSlides(prev => prev.map((slide, i) => (i === selectedSlideIndex ? updateFn(slide) : slide)));
    },
    [selectedSlideIndex]
  );

  const applySlideBackgroundUpdate = useCallback(
    (updateFn: (slide: Slide) => Slide) => {
      setSlides(prev =>
        prev.map((slide, i) => (applyBackgroundToAllSlides || i === selectedSlideIndex ? updateFn(slide) : slide))
      );
    },
    [applyBackgroundToAllSlides, selectedSlideIndex]
  );

  const updateTitleStyle = useCallback((updates: Partial<TextStyle>) => {
    applySlideUpdate((slide) => {
      const currentStyle = slide.titleStyle || { fontSize: 'medium', fontWeight: 'bold', color: '#ffffff' };
      return { ...slide, titleStyle: { ...currentStyle, ...updates } };
    });
  }, [applySlideUpdate]);

  const updateBulletStyle = useCallback((updates: Partial<TextStyle>) => {
    applySlideUpdate((slide) => {
      const currentStyle = slide.bulletStyle || { fontSize: 'medium', fontWeight: 'normal', color: '#e2e8f0' };
      return { ...slide, bulletStyle: { ...currentStyle, ...updates } };
    });
  }, [applySlideUpdate]);

  const updateSubtitleStyle = useCallback((updates: Partial<TextStyle>) => {
    applySlideUpdate((slide) => {
      const currentStyle = slide.subtitleStyle || { fontSize: 'medium', fontWeight: 'normal', color: '#94a3b8' };
      return { ...slide, subtitleStyle: { ...currentStyle, ...updates } };
    });
  }, [applySlideUpdate]);

  // Start new presentation - reset all state
  const handleStartNew = useCallback(() => {
    setCurrentStep('topic');
    setTopic('');
    setSlideCount(4);
    setResearchMode(false);
    setResearchModeType('global');
    setInputMode('topic_only');
    setBrief(null);
    setOutline([]);
    setSlides([]);
    setSelectedSlideIndex(0);
    setIsEditMode(false);
    setError('');
  }, []);

  const handleResearchCurrentSlide = useCallback(async () => {
    if (!brief) return;
    if (!effectiveResearchMode || researchModeType !== 'per_slide') return;
    if (slides.length === 0) return;

    const currentSlide = slides[selectedSlideIndex];
    if (!currentSlide) return;
    if (currentSlide.role === 'cover' || currentSlide.role === 'thank_you') return;

    setIsSlideResearching(true);
    try {
      const response = await callEdgeFunctionWithRetry<{
        success: boolean;
        slide?: { title: string; subtitle?: string; bullets: string[] };
        error?: string;
      }>('wakti-presentation-slide-research', {
        body: {
          topic: topic.trim(),
          slideNumber: currentSlide.slideNumber,
          slideCount,
          language,
          objective: brief.objective,
          audience: brief.audience,
          scenario: brief.scenario,
          tone: brief.tone,
          currentTitle: currentSlide.title,
          currentBullets: currentSlide.bullets || [],
          query: slideResearchQuery || undefined,
        },
        maxRetries: 2,
        retryDelay: 1000,
      });

      if (!response?.success || !response?.slide) {
        throw new Error(response?.error || 'Failed to research slide');
      }

      setSlides(prev => prev.map((s, i) => {
        if (i !== selectedSlideIndex) return s;
        return {
          ...s,
          title: response.slide!.title,
          subtitle: response.slide!.subtitle || '',
          bullets: Array.isArray(response.slide!.bullets) ? response.slide!.bullets : [],
        };
      }));

      toast.success(language === 'ar' ? 'تمت إضافة البحث للشريحة' : 'Slide updated with research');
    } catch (e: any) {
      console.error('Per-slide research error:', e);
      toast.error(language === 'ar' ? 'فشل البحث للشريحة' : 'Failed to research slide');
    } finally {
      setIsSlideResearching(false);
    }
  }, [brief, language, effectiveResearchMode, researchModeType, selectedSlideIndex, slideCount, slideResearchQuery, slides, topic]);

  const handleRegenerateField = useCallback(async (params: { field: 'title' | 'subtitle' | 'bullet'; bulletIndex?: number }) => {
    if (!brief) return;
    if (slides.length === 0) return;
    const currentSlide = slides[selectedSlideIndex];
    if (!currentSlide) return;

    const currentText =
      params.field === 'title'
        ? currentSlide.title
        : params.field === 'subtitle'
          ? (currentSlide.subtitle || '')
          : (typeof params.bulletIndex === 'number' ? (currentSlide.bullets?.[params.bulletIndex] || '') : '');

    if (!currentText.trim()) return;

    setIsRegeneratingField(prev => {
      if (params.field === 'title') return { ...prev, title: true };
      if (params.field === 'subtitle') return { ...prev, subtitle: true };
      return {
        ...prev,
        bullets: { ...prev.bullets, [params.bulletIndex as number]: true },
      };
    });

    try {
      const response = await callEdgeFunctionWithRetry<{ success: boolean; text?: string; error?: string }>('wakti-presentation-regenerate-field', {
        body: {
          topic: topic.trim(),
          slideNumber: currentSlide.slideNumber,
          slideCount,
          language,
          objective: brief.objective,
          audience: brief.audience,
          scenario: brief.scenario,
          tone: brief.tone,
          field: params.field,
          currentText,
          currentTitle: currentSlide.title,
          currentSubtitle: currentSlide.subtitle || '',
          currentBullets: currentSlide.bullets || [],
          bulletIndex: params.field === 'bullet' ? params.bulletIndex : undefined,
        },
        maxRetries: 2,
        retryDelay: 1000,
      });

      if (!response?.success || !response?.text) {
        throw new Error(response?.error || 'Failed to regenerate');
      }

      const newText = response.text.trim();
      if (!newText) throw new Error('Empty result');

      setSlides(prev => prev.map((s, i) => {
        if (i !== selectedSlideIndex) return s;
        if (params.field === 'title') return { ...s, title: newText };
        if (params.field === 'subtitle') return { ...s, subtitle: newText };
        if (params.field === 'bullet' && typeof params.bulletIndex === 'number') {
          const nextBullets = [...(s.bullets || [])];
          nextBullets[params.bulletIndex] = newText;
          return { ...s, bullets: nextBullets };
        }
        return s;
      }));
    } catch (e) {
      console.error('Regenerate field error:', e);
      toast.error(language === 'ar' ? 'فشل إعادة الصياغة' : 'Failed to regenerate');
    } finally {
      setIsRegeneratingField(prev => {
        if (params.field === 'title') return { ...prev, title: false };
        if (params.field === 'subtitle') return { ...prev, subtitle: false };
        const idx = params.bulletIndex as number;
        const next = { ...prev.bullets };
        delete next[idx];
        return { ...prev, bullets: next };
      });
    }
  }, [brief, slides, selectedSlideIndex, topic, slideCount, language]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  const renderStepIndicator = () => {
    const steps: { key: Step; label: { en: string; ar: string } }[] = [
      { key: 'topic', label: { en: 'Topic', ar: 'الموضوع' } },
      { key: 'brief', label: { en: 'Brief', ar: 'الملخص' } },
      { key: 'outline', label: { en: 'Outline', ar: 'المخطط' } },
      { key: 'slides', label: { en: 'Slides', ar: 'الشرائح' } },
    ];

    const currentIndex = steps.findIndex(s => s.key === currentStep);

    return (
      <div className="flex items-center justify-center gap-3 mb-6">
        {steps.map((step, i) => (
          <React.Fragment key={step.key}>
            <div
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium border shadow-sm transition-all ${
                i <= currentIndex
                  ? 'bg-primary text-primary-foreground border-primary/60 shadow-md'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/40'
              }`}
            >
              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 text-[11px]">
                {i < currentIndex ? <Check className="w-3 h-3" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{step.label[language]}</span>
            </div>
            {i < steps.length - 1 && (
              <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const renderTopicStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4 shadow-vibrant">
          <Presentation className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-semibold">
          {language === 'ar' ? 'إنشاء عرض تقديمي جديد' : 'Create a New Presentation'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {language === 'ar' 
            ? 'صف موضوعك وسنقوم بإنشاء عرض تقديمي احترافي لك'
            : 'Describe your topic and we\'ll create a professional presentation for you'}
        </p>
      </div>

      <div className="space-y-4 mt-2">
        <div>
          <label className="text-sm font-medium mb-2 block">
            {language === 'ar' ? 'موضوع العرض التقديمي' : 'Presentation Topic'}
          </label>
          <textarea
            className="w-full border rounded-xl p-4 min-h-[120px] focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            placeholder={language === 'ar' 
              ? 'مثال: عرض تقديمي لتطبيق إنتاجية ذكي للآباء المشغولين...'
              : 'e.g., Pitch deck for a mindful productivity app for busy parents...'}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>

        {/* Input Mode Selection - Enhanced Wakti Style */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Wand2 className="w-4 h-4 text-primary" />
            <label className="text-sm font-semibold">
              {language === 'ar' ? 'كيف يستخدم وقتي نصك؟' : 'How should Wakti use your text?'}
            </label>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {INPUT_MODES.map((mode) => {
              const isSelected = inputMode === mode.key;
              const ModeIcon = mode.key === 'verbatim' ? Type 
                : mode.key === 'polish' ? Wand2 
                : mode.key === 'topic_only' ? Lightbulb 
                : FileQuestion;
              
              return (
                <div
                  key={mode.key}
                  onClick={() => {
                    setInputMode(mode.key);
                    if (mode.key !== 'topic_only') {
                      setResearchMode(false);
                      setResearchModeType('global');
                    }
                  }}
                  className={`relative rounded-2xl border p-4 cursor-pointer transition-all duration-200 overflow-hidden ${
                    isSelected
                      ? 'border-primary/60 bg-gradient-to-br from-secondary/35 via-background to-background shadow-vibrant'
                      : 'border-border/60 bg-gradient-to-br from-card via-background to-background shadow-soft hover:shadow-colored hover:border-primary/30'
                  }`}
                >
                  <div className={`pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 ${
                    isSelected ? 'opacity-100' : 'group-hover:opacity-100'
                  }`} />

                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="absolute top-3 right-3">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-colored">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    </div>
                  )}
                  
                  {/* Mode header */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${
                      isSelected 
                        ? 'bg-primary/15 text-primary shadow-soft' 
                        : 'bg-muted/70 text-muted-foreground'
                    }`}>
                      <ModeIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-semibold text-sm ${
                        isSelected ? 'text-primary' : 'text-foreground'
                      }`}>
                        {mode.label[language]}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {mode.description[language]}
                      </p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className={`border-t my-3 ${isSelected ? 'border-primary/15' : 'border-border/40'}`} />

                  {/* AI Image Generation Toggle */}
                  <div 
                    className={`flex items-center justify-between gap-2 p-2.5 rounded-xl transition-colors border ${
                      isSelected
                        ? 'bg-background/60 border-primary/15 hover:bg-background/75'
                        : 'bg-muted/40 border-border/40 hover:bg-muted/60'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      <ImageLucide className={`w-3.5 h-3.5 ${
                        aiGenerateImagesByMode[mode.key] ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                      <span className="text-xs font-medium">
                        {language === 'ar' ? 'إنشاء صور AI' : 'AI Images'}
                      </span>
                    </div>
                    <Switch
                      checked={!!aiGenerateImagesByMode[mode.key]}
                      onCheckedChange={() => {
                        setAiGenerateImagesByMode((prev) => ({
                          ...prev,
                          [mode.key]: !prev[mode.key],
                        }));
                      }}
                      className="scale-75"
                    />
                  </div>

                  {/* Web Research option - only for topic_only mode */}
                  {mode.key === 'topic_only' && (
                    <div 
                      className={`mt-2 flex items-center justify-between gap-2 p-2.5 rounded-xl transition-colors border ${
                        isSelected
                          ? 'bg-background/60 border-primary/15 hover:bg-background/75'
                          : 'bg-muted/40 border-border/40 hover:bg-muted/60'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2">
                        <Globe className={`w-3.5 h-3.5 ${
                          researchMode ? 'text-primary' : 'text-muted-foreground'
                        }`} />
                        <span className="text-xs font-medium">
                          {language === 'ar' ? 'بحث الويب' : 'Web Research'}
                        </span>
                      </div>
                      <Switch
                        checked={researchMode}
                        onCheckedChange={(checked) => {
                          setResearchMode(checked);
                          if (!checked) setResearchModeType('global');
                        }}
                        className="scale-75"
                      />
                    </div>
                  )}

                  {/* Research mode options */}
                  {mode.key === 'topic_only' && researchMode && (
                    <div className="mt-2 p-2.5 rounded-xl bg-gradient-to-br from-primary/10 via-background/70 to-background border border-primary/20 shadow-soft">
                      <div className="flex items-center gap-3 text-xs">
                        <label 
                          className="flex items-center gap-1.5 cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="radio"
                            name="presentationResearchMode"
                            checked={researchModeType === 'global'}
                            onChange={() => setResearchModeType('global')}
                            className="accent-primary w-3 h-3"
                          />
                          <span className={researchModeType === 'global' ? 'text-primary font-medium' : 'text-muted-foreground'}>
                            {language === 'ar' ? 'شامل' : 'Global'}
                          </span>
                        </label>
                        <label 
                          className="flex items-center gap-1.5 cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="radio"
                            name="presentationResearchMode"
                            checked={researchModeType === 'per_slide'}
                            onChange={() => setResearchModeType('per_slide')}
                            className="accent-primary w-3 h-3"
                          />
                          <span className={researchModeType === 'per_slide' ? 'text-primary font-medium' : 'text-muted-foreground'}>
                            {language === 'ar' ? 'لكل شريحة' : 'Per Slide'}
                          </span>
                        </label>
                      </div>
                      {researchModeType === 'per_slide' && (
                        <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight">
                          {language === 'ar'
                            ? 'سيتم إنشاء الغلاف والشريحة التالية وشكراً فقط'
                            : 'Only Cover + next slide + Thank You generated'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Number of Slides - standalone */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            {language === 'ar' ? 'عدد الشرائح' : 'Number of Slides'}
          </label>
          <div className="flex flex-col gap-2">
            <input
              type="range"
              min={3}
              max={12}
              step={1}
              value={slideCount}
              onChange={(e) => setSlideCount(Number(e.target.value))}
              className="w-full accent-primary"
              aria-label={language === 'ar' ? 'عدد الشرائح' : 'Number of slides'}
            />
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>{language === 'ar' ? 'الحد الأدنى: 3 شرائح' : 'Min: 3 slides'}</span>
              <span className="font-medium">
                {slideCount} {language === 'ar' ? 'شريحة' : 'slides'}
              </span>
              <span>{language === 'ar' ? 'الحد الأقصى: 12 شريحة' : 'Max: 12 slides'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleGenerateBrief}
          disabled={(inputMode !== 'blank' && !topic.trim()) || isLoading}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#060541] to-[#0a0a6b] text-white font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {language === 'ar' ? 'جارٍ الإنشاء...' : 'Generating...'}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {language === 'ar' ? 'إنشاء الملخص' : 'Generate Brief'}
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderBriefStep = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentStep('topic')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {language === 'ar' ? 'رجوع' : 'Back'}
        </button>
        <h2 className="text-lg font-semibold">
          {language === 'ar' ? 'مراجعة الملخص' : 'Review Brief'}
        </h2>
        <div className="w-16" />
      </div>

      {brief && (
        <div className="space-y-4 bg-muted/30 rounded-xl p-4">
          {/* Subject - text input */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {language === 'ar' ? 'الموضوع' : 'Subject'}
            </label>
            <input
              type="text"
              className="w-full border rounded-lg px-3 py-2 bg-background"
              placeholder={language === 'ar' ? 'موضوع العرض التقديمي' : 'Presentation subject'}
              value={brief.subject || ''}
              onChange={(e) => setBrief({ ...brief, subject: e.target.value })}
            />
          </div>

          {/* Objective - enhanced dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              🎯 {language === 'ar' ? 'الهدف' : 'Objective'}
            </label>
            <select
              className="w-full border-2 rounded-xl px-4 py-2.5 bg-background cursor-pointer hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
              value={brief.objective || ''}
              onChange={(e) => setBrief({ ...brief, objective: e.target.value })}
              aria-label={language === 'ar' ? 'الهدف' : 'Objective'}
            >
              <option value="">{language === 'ar' ? 'اختر الهدف' : 'Select objective'}</option>
              {OBJECTIVES.map(o => (
                <option key={o.key} value={o.key}>{o.label[language]}</option>
              ))}
            </select>
          </div>

          {/* Audience - enhanced dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              👥 {language === 'ar' ? 'الجمهور' : 'Audience'}
            </label>
            <select
              className="w-full border-2 rounded-xl px-4 py-2.5 bg-background cursor-pointer hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
              value={brief.audience || ''}
              onChange={(e) => setBrief({ ...brief, audience: e.target.value })}
              aria-label={language === 'ar' ? 'الجمهور' : 'Audience'}
            >
              <option value="">{language === 'ar' ? 'اختر الجمهور' : 'Select audience'}</option>
              {AUDIENCES.map(a => (
                <option key={a.key} value={a.key}>{a.label[language]}</option>
              ))}
            </select>
          </div>

          {/* Scenario - enhanced dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              📍 {language === 'ar' ? 'السيناريو' : 'Scenario'}
            </label>
            <select
              className="w-full border-2 rounded-xl px-4 py-2.5 bg-background cursor-pointer hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
              value={brief.scenario || ''}
              onChange={(e) => setBrief({ ...brief, scenario: e.target.value })}
              aria-label={language === 'ar' ? 'السيناريو' : 'Scenario'}
            >
              <option value="">{language === 'ar' ? 'اختر السيناريو' : 'Select scenario'}</option>
              {SCENARIOS.map(s => (
                <option key={s.key} value={s.key}>{s.label[language]}</option>
              ))}
            </select>
          </div>

          {/* Tone - enhanced dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              🎭 {language === 'ar' ? 'النبرة' : 'Tone'}
            </label>
            <select
              className="w-full border-2 rounded-xl px-4 py-2.5 bg-background cursor-pointer hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
              value={brief.tone || ''}
              onChange={(e) => setBrief({ ...brief, tone: e.target.value })}
              aria-label={language === 'ar' ? 'النبرة' : 'Tone'}
            >
              <option value="">{language === 'ar' ? 'اختر النبرة' : 'Select tone'}</option>
              {TONES.map(t => (
                <option key={t.key} value={t.key}>{t.label[language]}</option>
              ))}
            </select>
          </div>

          {/* Slide Count - read-only summary (value comes from first screen slider) */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {language === 'ar' ? 'عدد الشرائح' : 'Number of Slides'}
            </label>
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs bg-background">
              <span className="font-semibold">
                {slideCount} {language === 'ar' ? 'شريحة' : 'slides'}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {language === 'ar'
                  ? 'يمكنك تغيير العدد من الخطوة السابقة'
                  : 'Change this in the previous step'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Rich Theme Picker */}
      <div>
        <label className="text-sm font-medium mb-3 block">
          {language === 'ar' ? 'اختر نمط العرض' : 'Choose Presentation Style'}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {THEMES.map(theme => (
            <button
              key={theme.key}
              onClick={() => setSelectedTheme(theme.key)}
              aria-label={theme.label[language]}
              className={`text-left p-3 rounded-2xl border-2 transition-all ${
                selectedTheme === theme.key
                  ? 'border-primary ring-2 ring-primary/20 shadow-xl scale-[1.02]'
                  : 'border-border hover:border-muted-foreground/50 hover:shadow-lg'
              }`}
            >
              {/* Rich mini slide preview */}
              <div className={`aspect-video rounded-xl bg-gradient-to-br ${theme.bgGradient} p-2 mb-3 overflow-hidden relative`}>
                {/* Inner card simulation */}
                <div className={`absolute inset-1.5 ${theme.cardBg} rounded-lg ${theme.cardShadow} flex flex-col`}>
                  {/* Header bar */}
                  <div className={`h-2 ${theme.headerBg} rounded-t-lg`} />
                  {/* Content area */}
                  <div className="flex-1 p-1.5 flex flex-col justify-center gap-1">
                    <div className={`h-1 w-3/4 rounded ${theme.accent}`} />
                    <div className={`h-0.5 w-full rounded ${theme.bulletColor} opacity-40`} />
                    <div className={`h-0.5 w-4/5 rounded ${theme.bulletColor} opacity-30`} />
                    <div className={`h-0.5 w-3/5 rounded ${theme.bulletColor} opacity-20`} />
                  </div>
                </div>
                {/* Image indicator for visual themes */}
                {(theme.imageIntensity === 'heavy' || theme.imageIntensity === 'dominant') && (
                  <div className="absolute bottom-2 right-2 w-4 h-3 bg-gray-300 rounded-sm flex items-center justify-center">
                    <ImageIcon className="w-2 h-2 text-gray-500" />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <span className="text-sm font-semibold block">{theme.label[language]}</span>
                <span className="text-xs text-muted-foreground block leading-tight">{theme.description[language]}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          onClick={handleGenerateOutline}
          disabled={isLoading}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#060541] to-[#0a0a6b] text-white font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {language === 'ar' ? 'جارٍ الإنشاء...' : 'Generating...'}
            </>
          ) : (
            <>
              <Layout className="w-4 h-4" />
              {language === 'ar' ? 'إنشاء المخطط' : 'Generate Outline'}
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderOutlineStep = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentStep('brief')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {language === 'ar' ? 'رجوع' : 'Back'}
        </button>
        <h2 className="text-lg font-semibold">
          {language === 'ar' ? 'مخطط الشرائح' : 'Slide Outline'}
        </h2>
        <div className="w-16" />
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
        {outline.map((slide, i) => (
          <div
            key={i}
            className="p-4 rounded-xl border bg-card hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                {slide.slideNumber}
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm">{slide.title}</h3>
                <ul className="mt-1 space-y-0.5">
                  {slide.bullets.map((b, j) => (
                    <li key={j} className="text-xs text-muted-foreground flex items-start gap-1">
                      <span className="text-primary">•</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          onClick={handleGenerateSlides}
          disabled={isLoading}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#060541] to-[#0a0a6b] text-white font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {language === 'ar' ? 'جارٍ إنشاء الشرائح...' : 'Creating Slides...'}
            </>
          ) : (
            <>
              <ImageIcon className="w-4 h-4" />
              {language === 'ar' ? 'إنشاء الشرائح' : 'Create Slides'}
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderSlidesStep = () => {
    const currentSlide = slides[selectedSlideIndex];
    const theme = THEMES.find(t => t.key === selectedTheme);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCurrentStep('outline')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {language === 'ar' ? 'رجوع' : 'Back'}
          </button>
          <h2 className="text-lg font-semibold">
            {language === 'ar' ? 'عرض الشرائح' : 'Slide Preview'}
          </h2>
          <div className="flex items-center gap-2">
            {/* Start New button */}
            <button
              onClick={handleStartNew}
              className="p-2 rounded-lg border hover:bg-muted transition-colors"
              title={language === 'ar' ? 'عرض جديد' : 'New Presentation'}
            >
              <FilePlus2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleAddSlideAfterCurrent}
              disabled={slides.length === 0}
              className="p-2 rounded-lg border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={language === 'ar' ? 'إضافة شريحة بعد الحالية' : 'Add slide after current'}
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={handleDeleteCurrentSlide}
              disabled={slides.length === 0 || isLockedSlide(slides[selectedSlideIndex])}
              className="p-2 rounded-lg border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={language === 'ar' ? 'حذف الشريحة الحالية' : 'Delete current slide'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`p-2 rounded-lg border transition-colors ${isEditMode ? 'bg-primary text-white' : 'hover:bg-muted'}`}
              title={language === 'ar' ? 'تعديل' : 'Edit'}
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSelectedTheme(THEMES[(THEMES.findIndex(t => t.key === selectedTheme) + 1) % THEMES.length].key)}
              className="p-2 rounded-lg border hover:bg-muted transition-colors"
              title={language === 'ar' ? 'تغيير السمة' : 'Change Theme'}
            >
              <Palette className="w-4 h-4" />
            </button>
            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={isExporting}
                className="p-2 rounded-lg border hover:bg-muted transition-colors flex items-center gap-1"
                title={language === 'ar' ? 'تصدير' : 'Export'}
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4" />
                )}
              </button>
              
              {/* Export menu dropdown */}
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 bg-card border rounded-lg shadow-lg z-50 min-w-[140px] py-1">
                  <button
                    onClick={handleExportPDF}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-red-500" />
                    PDF
                  </button>
                  <button
                    onClick={handleExportPPTX}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-orange-500" />
                    PowerPoint
                  </button>
                  <button
                    onClick={handleCreateShareLink}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 transition-colors"
                  >
                    <Share2 className="w-4 h-4 text-blue-500" />
                    {language === 'ar' ? 'رابط مشاركة' : 'Share Link'}
                  </button>
                  <div className="border-t border-border my-1" />
                  <button
                    onClick={() => {
                      setShowExportMenu(false);
                      savePresentation();
                    }}
                    disabled={isSavingPresentation}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {isSavingPresentation ? (
                      <Loader2 className="w-4 h-4 text-green-500 animate-spin" />
                    ) : (
                      <FilePlus2 className="w-4 h-4 text-green-500" />
                    )}
                    {language === 'ar' ? 'حفظ العرض' : 'Save Presentation'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main slide canvas - Theme-aware with per-slide background */}
        <div className="relative max-w-4xl mx-auto">
          <div 
            ref={slidePreviewRef}
            className={`aspect-video rounded-2xl overflow-hidden ${theme?.cardShadow || 'shadow-2xl'} relative`}
            style={currentSlide?.slideBg ? getColorStyle(currentSlide.slideBg, 'background') : undefined}
          >
            {/* Gradient background fallback when not using custom color */}
            {!currentSlide?.slideBg && (
              <div className={`absolute inset-0 bg-gradient-to-br ${
                selectedTheme === 'academic' ? 'from-slate-900 via-slate-800 to-slate-900' :
                selectedTheme === 'pitch_deck' ? 'from-slate-900 via-emerald-900/20 to-slate-900' :
                selectedTheme === 'creative' ? 'from-orange-600 via-pink-600 to-purple-700' :
                selectedTheme === 'professional' ? 'from-slate-800 via-indigo-900 to-slate-900' :
                'from-slate-800 to-slate-900'
              }`} />
            )}
            {/* Subtle gradient overlay */}
            <div className={`absolute inset-0 pointer-events-none ${
              selectedTheme === 'pitch_deck' ? 'bg-gradient-to-br from-emerald-500/10 to-teal-500/5' :
              selectedTheme === 'creative' ? 'bg-gradient-to-br from-orange-500/10 to-pink-500/10' :
              selectedTheme === 'professional' ? 'bg-gradient-to-br from-indigo-500/10 to-blue-500/5' :
              'bg-gradient-to-br from-blue-900/20 to-purple-900/10'
            }`} />
            
            {/* Content area - better mobile padding */}
            <div className="relative h-full p-4 sm:p-6 md:p-8 lg:p-10 flex flex-col overflow-hidden">
              {currentSlide && (
                <>
                  {/* Cover slide - no image */}
                  {currentSlide.role === 'cover' && !currentSlide.imageUrl && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                      <h1 
                        className={`${getFontSizeClass(currentSlide.titleStyle?.fontSize, 'title')} ${currentSlide.titleStyle?.fontWeight === 'normal' ? 'font-normal' : 'font-bold'} ${currentSlide.titleStyle?.fontStyle === 'italic' ? 'italic' : ''} ${currentSlide.titleStyle?.textDecoration === 'underline' ? 'underline' : ''} mb-4 leading-tight`}
                        style={{ color: currentSlide.titleStyle?.color || '#ffffff' }}
                      >
                        {currentSlide.title}
                      </h1>
                      {currentSlide.subtitle && (
                        <p className={`${getFontSizeClass(currentSlide.subtitleStyle?.fontSize)} mb-4`} style={{ color: currentSlide.subtitleStyle?.color || '#94a3b8' }}>{currentSlide.subtitle}</p>
                      )}
                      <div className={`w-24 h-1 rounded-full mt-4 ${getThemeAccent(selectedTheme).bg}`} />
                    </div>
                  )}

                  {/* Cover slide WITH image - respects layout variant */}
                  {currentSlide.role === 'cover' && currentSlide.imageUrl && (
                    <>
                      {/* Image Left */}
                      {currentSlide.layoutVariant === 'image_left' && (
                        <div className="flex-1 flex gap-4 items-center">
                          <div className={`${currentSlide.imageSize === 'small' ? 'w-1/3' : currentSlide.imageSize === 'large' ? 'w-2/3' : 'w-1/2'} aspect-[16/9]`}>
                            {renderSlideImage(currentSlide, { className: 'w-full h-full', enableDrag: true, onPointerDown: onImagePointerDown, onPointerMove: onImagePointerMove, onPointerUp: onImagePointerCancelOrUp, onPointerCancel: onImagePointerCancelOrUp })}
                          </div>
                          <div className="flex-1 flex flex-col justify-center">
                            <h1 className={`${getFontSizeClass(currentSlide.titleStyle?.fontSize, 'title')} ${currentSlide.titleStyle?.fontWeight === 'normal' ? 'font-normal' : 'font-bold'} mb-2`} style={{ color: currentSlide.titleStyle?.color || '#ffffff' }}>{currentSlide.title}</h1>
                            {currentSlide.subtitle && <p className={`${getFontSizeClass(currentSlide.subtitleStyle?.fontSize)}`} style={{ color: currentSlide.subtitleStyle?.color || '#94a3b8' }}>{currentSlide.subtitle}</p>}
                            <div className={`w-16 h-1 rounded-full mt-3 ${getThemeAccent(selectedTheme).bg}`} />
                          </div>
                        </div>
                      )}
                      {/* Image Right (default) */}
                      {(currentSlide.layoutVariant === 'text_left' || !currentSlide.layoutVariant || currentSlide.layoutVariant === 'text_only') && (
                        <div className="flex-1 flex gap-4 items-center">
                          <div className="flex-1 flex flex-col justify-center">
                            <h1 className={`${getFontSizeClass(currentSlide.titleStyle?.fontSize, 'title')} ${currentSlide.titleStyle?.fontWeight === 'normal' ? 'font-normal' : 'font-bold'} mb-2`} style={{ color: currentSlide.titleStyle?.color || '#ffffff' }}>{currentSlide.title}</h1>
                            {currentSlide.subtitle && <p className={`${getFontSizeClass(currentSlide.subtitleStyle?.fontSize)}`} style={{ color: currentSlide.subtitleStyle?.color || '#94a3b8' }}>{currentSlide.subtitle}</p>}
                            <div className={`w-16 h-1 rounded-full mt-3 ${getThemeAccent(selectedTheme).bg}`} />
                          </div>
                          <div className={`${currentSlide.imageSize === 'small' ? 'w-1/3' : currentSlide.imageSize === 'large' ? 'w-2/3' : 'w-1/2'} aspect-[16/9]`}>
                            {renderSlideImage(currentSlide, { className: 'w-full h-full', enableDrag: true, onPointerDown: onImagePointerDown, onPointerMove: onImagePointerMove, onPointerUp: onImagePointerCancelOrUp, onPointerCancel: onImagePointerCancelOrUp })}
                          </div>
                        </div>
                      )}
                      {/* Image Top */}
                      {currentSlide.layoutVariant === 'image_top' && (
                        <div className="flex-1 flex flex-col gap-3">
                          <div className={`w-full ${currentSlide.imageSize === 'small' ? 'max-w-[70%]' : currentSlide.imageSize === 'large' ? 'max-w-full' : 'max-w-[85%]'} mx-auto aspect-[16/9]`}>
                            {renderSlideImage(currentSlide, { className: 'w-full h-full', enableDrag: true, onPointerDown: onImagePointerDown, onPointerMove: onImagePointerMove, onPointerUp: onImagePointerCancelOrUp, onPointerCancel: onImagePointerCancelOrUp })}
                          </div>
                          <div className="flex-1 flex flex-col items-center justify-center text-center">
                            <h1 className={`${getFontSizeClass(currentSlide.titleStyle?.fontSize, 'title')} ${currentSlide.titleStyle?.fontWeight === 'normal' ? 'font-normal' : 'font-bold'} mb-2`} style={{ color: currentSlide.titleStyle?.color || '#ffffff' }}>{currentSlide.title}</h1>
                            {currentSlide.subtitle && <p className={`${getFontSizeClass(currentSlide.subtitleStyle?.fontSize)}`} style={{ color: currentSlide.subtitleStyle?.color || '#94a3b8' }}>{currentSlide.subtitle}</p>}
                            <div className={`w-16 h-1 rounded-full mt-3 ${getThemeAccent(selectedTheme).bg}`} />
                          </div>
                        </div>
                      )}
                      {/* Image Bottom */}
                      {currentSlide.layoutVariant === 'image_bottom' && (
                        <div className="flex-1 flex flex-col gap-3">
                          <div className="flex-1 flex flex-col items-center justify-center text-center">
                            <h1 className={`${getFontSizeClass(currentSlide.titleStyle?.fontSize, 'title')} ${currentSlide.titleStyle?.fontWeight === 'normal' ? 'font-normal' : 'font-bold'} mb-2`} style={{ color: currentSlide.titleStyle?.color || '#ffffff' }}>{currentSlide.title}</h1>
                            {currentSlide.subtitle && <p className={`${getFontSizeClass(currentSlide.subtitleStyle?.fontSize)}`} style={{ color: currentSlide.subtitleStyle?.color || '#94a3b8' }}>{currentSlide.subtitle}</p>}
                            <div className={`w-16 h-1 rounded-full mt-3 ${getThemeAccent(selectedTheme).bg}`} />
                          </div>
                          <div className={`w-full ${currentSlide.imageSize === 'small' ? 'max-w-[70%]' : currentSlide.imageSize === 'large' ? 'max-w-full' : 'max-w-[85%]'} mx-auto aspect-[16/9]`}>
                            {renderSlideImage(currentSlide, { className: 'w-full h-full', enableDrag: true, onPointerDown: onImagePointerDown, onPointerMove: onImagePointerMove, onPointerUp: onImagePointerCancelOrUp, onPointerCancel: onImagePointerCancelOrUp })}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Thank you slide - with full edit support and layout options */}
                  {currentSlide.role === 'thank_you' && !currentSlide.imageUrl && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                      <h1 
                        className={`${getFontSizeClass(currentSlide.titleStyle?.fontSize, 'title')} ${currentSlide.titleStyle?.fontWeight === 'normal' ? 'font-normal' : 'font-bold'} ${currentSlide.titleStyle?.fontStyle === 'italic' ? 'italic' : ''} ${currentSlide.titleStyle?.textDecoration === 'underline' ? 'underline' : ''} mb-4`}
                        style={{ color: currentSlide.titleStyle?.color || '#ffffff' }}
                      >
                        {currentSlide.title}
                      </h1>
                      {currentSlide.subtitle && (
                        <p 
                          className={`${getFontSizeClass(currentSlide.subtitleStyle?.fontSize)} mb-6`}
                          style={{ color: currentSlide.subtitleStyle?.color || '#94a3b8' }}
                        >
                          {currentSlide.subtitle}
                        </p>
                      )}
                      <div className={`w-20 h-1 rounded-full ${getThemeAccent(selectedTheme).bg}`} />
                    </div>
                  )}

                  {/* Thank you slide WITH image - respects layout variant */}
                  {currentSlide.role === 'thank_you' && currentSlide.imageUrl && (
                    <>
                      {/* Image Left layout */}
                      {currentSlide.layoutVariant === 'image_left' && (
                        <div className="flex-1 flex gap-4 items-center">
                          <div className={`${currentSlide.imageSize === 'small' ? 'w-1/3' : currentSlide.imageSize === 'large' ? 'w-2/3' : 'w-1/2'} aspect-[16/9]`}>
                            {renderSlideImage(currentSlide, { className: 'w-full h-full', enableDrag: true, onPointerDown: onImagePointerDown, onPointerMove: onImagePointerMove, onPointerUp: onImagePointerCancelOrUp, onPointerCancel: onImagePointerCancelOrUp })}
                          </div>
                          <div className="flex-1 flex flex-col justify-center">
                            <h1 className={`${getFontSizeClass(currentSlide.titleStyle?.fontSize, 'title')} ${currentSlide.titleStyle?.fontWeight === 'normal' ? 'font-normal' : 'font-bold'} mb-2`} style={{ color: currentSlide.titleStyle?.color || '#ffffff' }}>{currentSlide.title}</h1>
                            {currentSlide.subtitle && <p className={`${getFontSizeClass(currentSlide.subtitleStyle?.fontSize)}`} style={{ color: currentSlide.subtitleStyle?.color || '#94a3b8' }}>{currentSlide.subtitle}</p>}
                            <div className={`w-16 h-1 rounded-full mt-3 ${getThemeAccent(selectedTheme).bg}`} />
                          </div>
                        </div>
                      )}
                      {/* Image Right layout (default for thank you with image) */}
                      {(currentSlide.layoutVariant === 'text_left' || !currentSlide.layoutVariant || currentSlide.layoutVariant === 'text_only') && (
                        <div className="flex-1 flex gap-4 items-center">
                          <div className="flex-1 flex flex-col justify-center">
                            <h1 className={`${getFontSizeClass(currentSlide.titleStyle?.fontSize, 'title')} ${currentSlide.titleStyle?.fontWeight === 'normal' ? 'font-normal' : 'font-bold'} mb-2`} style={{ color: currentSlide.titleStyle?.color || '#ffffff' }}>{currentSlide.title}</h1>
                            {currentSlide.subtitle && <p className={`${getFontSizeClass(currentSlide.subtitleStyle?.fontSize)}`} style={{ color: currentSlide.subtitleStyle?.color || '#94a3b8' }}>{currentSlide.subtitle}</p>}
                            <div className={`w-16 h-1 rounded-full mt-3 ${getThemeAccent(selectedTheme).bg}`} />
                          </div>
                          <div className={`${currentSlide.imageSize === 'small' ? 'w-1/3' : currentSlide.imageSize === 'large' ? 'w-2/3' : 'w-1/2'} aspect-[16/9]`}>
                            {renderSlideImage(currentSlide, { className: 'w-full h-full', enableDrag: true, onPointerDown: onImagePointerDown, onPointerMove: onImagePointerMove, onPointerUp: onImagePointerCancelOrUp, onPointerCancel: onImagePointerCancelOrUp })}
                          </div>
                        </div>
                      )}
                      {/* Image Top layout */}
                      {currentSlide.layoutVariant === 'image_top' && (
                        <div className="flex-1 flex flex-col gap-3">
                          <div className={`w-full ${currentSlide.imageSize === 'small' ? 'max-w-[70%]' : currentSlide.imageSize === 'large' ? 'max-w-full' : 'max-w-[85%]'} mx-auto aspect-[16/9]`}>
                            {renderSlideImage(currentSlide, { className: 'w-full h-full', enableDrag: true, onPointerDown: onImagePointerDown, onPointerMove: onImagePointerMove, onPointerUp: onImagePointerCancelOrUp, onPointerCancel: onImagePointerCancelOrUp })}
                          </div>
                          <div className="flex-1 flex flex-col items-center justify-center text-center">
                            <h1 className={`${getFontSizeClass(currentSlide.titleStyle?.fontSize, 'title')} ${currentSlide.titleStyle?.fontWeight === 'normal' ? 'font-normal' : 'font-bold'} mb-2`} style={{ color: currentSlide.titleStyle?.color || '#ffffff' }}>{currentSlide.title}</h1>
                            {currentSlide.subtitle && <p className={`${getFontSizeClass(currentSlide.subtitleStyle?.fontSize)}`} style={{ color: currentSlide.subtitleStyle?.color || '#94a3b8' }}>{currentSlide.subtitle}</p>}
                            <div className={`w-16 h-1 rounded-full mt-3 ${getThemeAccent(selectedTheme).bg}`} />
                          </div>
                        </div>
                      )}
                      {/* Image Bottom layout */}
                      {currentSlide.layoutVariant === 'image_bottom' && (
                        <div className="flex-1 flex flex-col gap-3">
                          <div className="flex-1 flex flex-col items-center justify-center text-center">
                            <h1 className={`${getFontSizeClass(currentSlide.titleStyle?.fontSize, 'title')} ${currentSlide.titleStyle?.fontWeight === 'normal' ? 'font-normal' : 'font-bold'} mb-2`} style={{ color: currentSlide.titleStyle?.color || '#ffffff' }}>{currentSlide.title}</h1>
                            {currentSlide.subtitle && <p className={`${getFontSizeClass(currentSlide.subtitleStyle?.fontSize)}`} style={{ color: currentSlide.subtitleStyle?.color || '#94a3b8' }}>{currentSlide.subtitle}</p>}
                            <div className={`w-16 h-1 rounded-full mt-3 ${getThemeAccent(selectedTheme).bg}`} />
                          </div>
                          <div className={`w-full ${currentSlide.imageSize === 'small' ? 'max-w-[70%]' : currentSlide.imageSize === 'large' ? 'max-w-full' : 'max-w-[85%]'} mx-auto aspect-[16/9]`}>
                            {renderSlideImage(currentSlide, { className: 'w-full h-full', enableDrag: true, onPointerDown: onImagePointerDown, onPointerMove: onImagePointerMove, onPointerUp: onImagePointerCancelOrUp, onPointerCancel: onImagePointerCancelOrUp })}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Content slides with columns (no image, and not text_only layout) */}
                  {currentSlide.role !== 'cover' && currentSlide.role !== 'thank_you' && currentSlide.columns && currentSlide.columns.length > 0 && !currentSlide.imageUrl && currentSlide.layoutVariant !== 'text_only' && (
                    <div className="flex-1 flex flex-col">
                      {/* Title with accent - with full edit support */}
                      <div className="mb-6">
                        <h2 
                          className={`${getFontSizeClass(currentSlide.titleStyle?.fontSize, 'title')} ${currentSlide.titleStyle?.fontWeight === 'normal' ? 'font-normal' : 'font-bold'} ${currentSlide.titleStyle?.fontStyle === 'italic' ? 'italic' : ''} ${currentSlide.titleStyle?.textDecoration === 'underline' ? 'underline' : ''} mb-2`}
                          style={{ color: currentSlide.titleStyle?.color || '#ffffff' }}
                        >
                          {currentSlide.title}
                        </h2>
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${getThemeAccent(selectedTheme).bg}`} />
                          <div className={`w-2 h-2 rounded-full ${getThemeAccent(selectedTheme).bg}`} />
                          <div className={`w-2 h-2 rounded-full ${getThemeAccent(selectedTheme).bg}`} />
                        </div>
                      </div>
                      
                      {/* 3-column cards */}
                      <div className="flex-1 grid grid-cols-3 gap-4">
                        {currentSlide.columns.map((col, i) => (
                          <div key={i} className="bg-slate-800/80 backdrop-blur rounded-xl p-4 border border-slate-700 flex flex-col">
                            <div className="text-3xl mb-3 text-center">{col.icon || '📌'}</div>
                            <h3 className="font-bold text-white text-center mb-2">{col.title}</h3>
                            {col.description && (
                              <p className="text-slate-300 text-sm text-center">{col.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Content slides with dynamic layout based on layoutVariant - handles all image layouts */}
                  {currentSlide.role !== 'cover' && currentSlide.role !== 'thank_you' && (currentSlide.imageUrl || currentSlide.layoutVariant) && (
                    <div className="flex-1 flex flex-col">
                      {/* Title - with custom styling */}
                      <div className="mb-4">
                        <h2 
                          className={`${getFontSizeClass(currentSlide.titleStyle?.fontSize, 'title')} ${currentSlide.titleStyle?.fontWeight === 'normal' ? 'font-normal' : 'font-bold'} ${currentSlide.titleStyle?.fontStyle === 'italic' ? 'italic' : ''} ${currentSlide.titleStyle?.textDecoration === 'underline' ? 'underline' : ''}`}
                          style={{ color: currentSlide.titleStyle?.color || '#ffffff' }}
                        >
                          {currentSlide.title.split(' ').map((word, i) => 
                            i === 1 ? (
                              <span 
                                key={i} 
                                className={`${currentSlide.accentFontSize === 'small' ? 'text-[0.85em]' : currentSlide.accentFontSize === 'large' ? 'text-[1.15em]' : ''} ${currentSlide.accentFontWeight === 'normal' ? 'font-normal' : 'font-bold'} ${currentSlide.accentFontStyle === 'italic' ? 'italic' : ''}`}
                                style={{ color: currentSlide.accentColor || getThemeAccent(selectedTheme).hex }}
                              >
                                {word}{' '}
                              </span>
                            ) : word + ' '
                          )}
                        </h2>
                        {currentSlide.subtitle && (
                          <p className={`${getFontSizeClass(currentSlide.subtitleStyle?.fontSize)} mt-2`} style={{ color: currentSlide.subtitleStyle?.color || '#94a3b8' }}>
                            {currentSlide.subtitle}
                          </p>
                        )}
                        <div className="flex items-center gap-1 mt-2">
                          <div className={`${currentSlide.bulletDotSize === 'medium' ? 'w-2.5 h-2.5' : currentSlide.bulletDotSize === 'large' ? 'w-3 h-3' : 'w-2 h-2'} rounded-full`} style={{ backgroundColor: currentSlide.accentColor || getThemeAccent(selectedTheme).hex }} />
                          <div className={`${currentSlide.bulletDotSize === 'medium' ? 'w-2.5 h-2.5' : currentSlide.bulletDotSize === 'large' ? 'w-3 h-3' : 'w-2 h-2'} rounded-full`} style={{ backgroundColor: currentSlide.accentColor || getThemeAccent(selectedTheme).hex }} />
                          <div className={`${currentSlide.bulletDotSize === 'medium' ? 'w-2.5 h-2.5' : currentSlide.bulletDotSize === 'large' ? 'w-3 h-3' : 'w-2 h-2'} rounded-full`} style={{ backgroundColor: currentSlide.accentColor || getThemeAccent(selectedTheme).hex }} />
                        </div>
                      </div>
                      
                      {/* Layout: Image Top */}
                      {currentSlide.layoutVariant === 'image_top' && currentSlide.imageUrl && (
                        <div className="flex-1 flex flex-col gap-4 min-h-0">
                          <div className={`w-full ${currentSlide.imageSize === 'small' ? 'max-w-[70%]' : currentSlide.imageSize === 'large' ? 'max-w-full' : currentSlide.imageSize === 'full' ? 'max-w-full' : 'max-w-[85%]'} mx-auto aspect-[16/9]`}>
                            {renderSlideImage(currentSlide, { className: 'w-full h-full', enableDrag: true, onPointerDown: onImagePointerDown, onPointerMove: onImagePointerMove, onPointerUp: onImagePointerCancelOrUp, onPointerCancel: onImagePointerCancelOrUp })}
                          </div>
                          <div className="flex-1">
                            <ul className="space-y-1">
                              {currentSlide.bullets?.slice(0, 4).map((b, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  {renderBulletShape(currentSlide.bulletDotShape, i, currentSlide.bulletDotSize, currentSlide.bulletDotColor || currentSlide.accentColor || getThemeAccent(selectedTheme).hex)}
                                  <span 
                                    className={`${getFontSizeClass(currentSlide.bulletStyle?.fontSize)} leading-tight ${currentSlide.bulletStyle?.fontWeight === 'bold' ? 'font-bold' : ''} ${currentSlide.bulletStyle?.fontStyle === 'italic' ? 'italic' : ''}`} 
                                    style={{ color: currentSlide.bulletStyle?.color || '#e2e8f0' }}
                                  >
                                    {renderBoldText(b, selectedTheme)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                      {currentSlide.layoutVariant === 'image_left' && currentSlide.imageUrl && (
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 min-h-0">
                          <div className={`flex items-center justify-center w-full ${
                            currentSlide.imageSize === 'small' ? 'max-w-[70%]' :
                            currentSlide.imageSize === 'large' ? 'max-w-full' :
                            currentSlide.imageSize === 'full' ? 'max-w-full' :
                            'max-w-[85%]'
                          } mx-auto aspect-[16/9]`}>
                            {renderSlideImage(currentSlide, { className: 'w-full h-full', enableDrag: true, onPointerDown: onImagePointerDown, onPointerMove: onImagePointerMove, onPointerUp: onImagePointerCancelOrUp, onPointerCancel: onImagePointerCancelOrUp })}
                          </div>
                          <div className="flex-1 pl-2">
                            <ul className="space-y-1">
                              {currentSlide.bullets?.slice(0, 4).map((b, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  {renderBulletShape(currentSlide.bulletDotShape, i, currentSlide.bulletDotSize, currentSlide.bulletDotColor || currentSlide.accentColor || getThemeAccent(selectedTheme).hex)}
                                  <span 
                                    className={`${getFontSizeClass(currentSlide.bulletStyle?.fontSize)} leading-tight ${currentSlide.bulletStyle?.fontWeight === 'bold' ? 'font-bold' : ''} ${currentSlide.bulletStyle?.fontStyle === 'italic' ? 'italic' : ''}`} 
                                    style={{ color: currentSlide.bulletStyle?.color || '#e2e8f0' }}
                                  >
                                    {renderBoldText(b, selectedTheme)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* Layout: Image Bottom */}
                      {currentSlide.layoutVariant === 'image_bottom' && currentSlide.imageUrl && (
                        <div className="flex-1 flex flex-col gap-3 min-h-0">
                          <div className="flex-1">
                            <ul className="space-y-1">
                              {currentSlide.bullets?.slice(0, 4).map((b, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  {renderBulletShape(currentSlide.bulletDotShape, i, currentSlide.bulletDotSize, currentSlide.bulletDotColor || currentSlide.accentColor || getThemeAccent(selectedTheme).hex)}
                                  <span 
                                    className={`${getFontSizeClass(currentSlide.bulletStyle?.fontSize)} leading-tight ${currentSlide.bulletStyle?.fontWeight === 'bold' ? 'font-bold' : ''} ${currentSlide.bulletStyle?.fontStyle === 'italic' ? 'italic' : ''}`} 
                                    style={{ color: currentSlide.bulletStyle?.color || '#e2e8f0' }}
                                  >
                                    {renderBoldText(b, selectedTheme)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className={`w-full ${currentSlide.imageSize === 'small' ? 'max-w-[70%]' : currentSlide.imageSize === 'large' ? 'max-w-full' : currentSlide.imageSize === 'full' ? 'max-w-full' : 'max-w-[85%]'} mx-auto aspect-[16/9]`}>
                            {renderSlideImage(currentSlide, { className: 'w-full h-full', enableDrag: true, onPointerDown: onImagePointerDown, onPointerMove: onImagePointerMove, onPointerUp: onImagePointerCancelOrUp, onPointerCancel: onImagePointerCancelOrUp })}
                          </div>
                        </div>
                      )}

                      {/* Layout: Text Only */}
                      {currentSlide.layoutVariant === 'text_only' && (
                        <div className="flex-1">
                          <ul className="space-y-1.5">
                            {currentSlide.bullets?.slice(0, 5).map((b, i) => (
                              <li key={i} className="flex items-start gap-2">
                                {renderBulletShape(currentSlide.bulletDotShape, i, currentSlide.bulletDotSize, currentSlide.bulletDotColor || currentSlide.accentColor || getThemeAccent(selectedTheme).hex)}
                                <span 
                                  className={`${getFontSizeClass(currentSlide.bulletStyle?.fontSize)} leading-snug ${currentSlide.bulletStyle?.fontWeight === 'bold' ? 'font-bold' : ''} ${currentSlide.bulletStyle?.fontStyle === 'italic' ? 'italic' : ''}`} 
                                  style={{ color: currentSlide.bulletStyle?.color || '#e2e8f0' }}
                                >
                                  {renderBoldText(b, selectedTheme)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Fallback: No image but layout selected (show as text_only) */}
                      {!currentSlide.imageUrl && currentSlide.layoutVariant && currentSlide.layoutVariant !== 'text_only' && (
                        <div className="flex-1">
                          {currentSlide.subtitle && (
                            <p className={`${getFontSizeClass(currentSlide.subtitleStyle?.fontSize)} mb-3`} style={{ color: currentSlide.subtitleStyle?.color || '#94a3b8' }}>
                              {currentSlide.subtitle}
                            </p>
                          )}
                          <ul className="space-y-1.5">
                            {currentSlide.bullets?.slice(0, 5).map((b, i) => (
                              <li key={i} className="flex items-start gap-2">
                                {renderBulletShape(currentSlide.bulletDotShape, i, currentSlide.bulletDotSize, currentSlide.bulletDotColor || currentSlide.accentColor || getThemeAccent(selectedTheme).hex)}
                                <span className={`${getFontSizeClass(currentSlide.bulletStyle?.fontSize)} leading-snug`} style={{ color: currentSlide.bulletStyle?.color || '#e2e8f0' }}>
                                  {renderBoldText(b, selectedTheme)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Layout: Text Left (default) - responsive */}
                      {(!currentSlide.layoutVariant || currentSlide.layoutVariant === 'text_left') && currentSlide.imageUrl && (
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 items-start">
                          <div className="flex flex-col pr-2">
                            <ul className="space-y-1">
                              {currentSlide.bullets?.slice(0, 4).map((b, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  {renderBulletShape(currentSlide.bulletDotShape, i, currentSlide.bulletDotSize, currentSlide.bulletDotColor || currentSlide.accentColor || getThemeAccent(selectedTheme).hex)}
                                  <span 
                                    className={`${getFontSizeClass(currentSlide.bulletStyle?.fontSize)} leading-tight ${currentSlide.bulletStyle?.fontWeight === 'bold' ? 'font-bold' : ''} ${currentSlide.bulletStyle?.fontStyle === 'italic' ? 'italic' : ''}`} 
                                    style={{ color: currentSlide.bulletStyle?.color || '#e2e8f0' }}
                                  >
                                    {renderBoldText(b, selectedTheme)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className={`w-full ${currentSlide.imageSize === 'small' ? 'max-w-[70%]' : currentSlide.imageSize === 'large' ? 'max-w-full' : currentSlide.imageSize === 'full' ? 'max-w-full' : 'max-w-[85%]'} mx-auto aspect-[16/9]`}>
                            {renderSlideImage(currentSlide, { className: 'w-full h-full', enableDrag: true, onPointerDown: onImagePointerDown, onPointerMove: onImagePointerMove, onPointerUp: onImagePointerCancelOrUp, onPointerCancel: onImagePointerCancelOrUp })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Empty content slide (no image, no columns, no bullets) - still render title/subtitle so edits are visible */}
                  {currentSlide.role !== 'cover' && currentSlide.role !== 'thank_you' && !currentSlide.imageUrl && (!currentSlide.columns || currentSlide.columns.length === 0) && (!currentSlide.bullets || currentSlide.bullets.length === 0) && !currentSlide.layoutVariant && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                      <h2
                        className={`${getFontSizeClass(currentSlide.titleStyle?.fontSize, 'title')} ${currentSlide.titleStyle?.fontWeight === 'normal' ? 'font-normal' : 'font-bold'} ${currentSlide.titleStyle?.fontStyle === 'italic' ? 'italic' : ''} ${currentSlide.titleStyle?.textDecoration === 'underline' ? 'underline' : ''} mb-2 leading-tight`}
                        style={{ color: currentSlide.titleStyle?.color || '#ffffff' }}
                      >
                        {currentSlide.title}
                      </h2>
                      {currentSlide.subtitle && (
                        <p className={`${getFontSizeClass(currentSlide.subtitleStyle?.fontSize)} mb-4`} style={{ color: currentSlide.subtitleStyle?.color || '#94a3b8' }}>
                          {currentSlide.subtitle}
                        </p>
                      )}
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${getThemeAccent(selectedTheme).bg}`} />
                        <div className={`w-2 h-2 rounded-full ${getThemeAccent(selectedTheme).bg}`} />
                        <div className={`w-2 h-2 rounded-full ${getThemeAccent(selectedTheme).bg}`} />
                      </div>
                    </div>
                  )}

                  {/* Content slides with bullets only (no image, no columns, not using dynamic layout) - fallback */}
                  {currentSlide.role !== 'cover' && currentSlide.role !== 'thank_you' && !currentSlide.imageUrl && (!currentSlide.columns || currentSlide.columns.length === 0) && currentSlide.bullets && currentSlide.bullets.length > 0 && !currentSlide.layoutVariant && (
                    <div className="flex-1 flex flex-col">
                      {/* Title - with full edit support */}
                      <div className="mb-6">
                        <h2 
                          className={`${getFontSizeClass(currentSlide.titleStyle?.fontSize, 'title')} ${currentSlide.titleStyle?.fontWeight === 'normal' ? 'font-normal' : 'font-bold'} ${currentSlide.titleStyle?.fontStyle === 'italic' ? 'italic' : ''} ${currentSlide.titleStyle?.textDecoration === 'underline' ? 'underline' : ''} mb-2`}
                          style={{ color: currentSlide.titleStyle?.color || '#ffffff' }}
                        >
                          {currentSlide.title}
                        </h2>
                        {currentSlide.subtitle && (
                          <p className={`${getFontSizeClass(currentSlide.subtitleStyle?.fontSize)} mb-3`} style={{ color: currentSlide.subtitleStyle?.color || '#94a3b8' }}>
                            {currentSlide.subtitle}
                          </p>
                        )}
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${getThemeAccent(selectedTheme).bg}`} />
                          <div className={`w-2 h-2 rounded-full ${getThemeAccent(selectedTheme).bg}`} />
                          <div className={`w-2 h-2 rounded-full ${getThemeAccent(selectedTheme).bg}`} />
                        </div>
                      </div>
                      
                      {/* Bullets - with full edit support */}
                      <ul className="space-y-4 flex-1">
                        {currentSlide.bullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${getThemeAccent(selectedTheme).bg}`} />
                            <span 
                              className={`${getFontSizeClass(currentSlide.bulletStyle?.fontSize)} leading-relaxed`}
                              style={{ color: currentSlide.bulletStyle?.color || '#e2e8f0' }}
                            >
                              {renderBoldText(b, selectedTheme)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
              
              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getThemeAccent(selectedTheme).bg}`} />
                  <span className="text-xs text-slate-400 font-medium">
                    {brief?.subject?.substring(0, 25) || 'Wakti AI'}
                  </span>
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  {String(currentSlide?.slideNumber || 1).padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Panel - appears when edit mode is active */}
        {isEditMode && currentSlide && (
          <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300">
              {language === 'ar' ? '✏️ تعديل الشريحة' : '✏️ Edit Slide'}
            </h3>

            {effectiveResearchMode && researchModeType === 'per_slide' && currentSlide.role !== 'cover' && currentSlide.role !== 'thank_you' && (
              <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <label className="text-xs text-slate-500 mb-2 block font-medium">
                  🔎 {language === 'ar' ? 'بحث للعرض (حسب الشريحة)' : 'Presentation Web Search (per slide)'}
                </label>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={slideResearchQuery}
                    onChange={(e) => setSlideResearchQuery(e.target.value)}
                    aria-label={language === 'ar' ? 'طلب البحث' : 'Research query'}
                    title={language === 'ar' ? 'طلب البحث' : 'Research query'}
                    placeholder={language === 'ar' ? 'مثال: إحصائيات حديثة، تعريف، أمثلة...' : 'e.g., latest stats, definition, examples...'}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary/50 outline-none"
                  />
                  <button
                    onClick={handleResearchCurrentSlide}
                    disabled={isSlideResearching}
                    className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSlideResearching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {language === 'ar' ? 'جارٍ البحث...' : 'Searching...'}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        {language === 'ar' ? 'بحث وملء الشريحة' : 'Search & fill this slide'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
            
            {/* Title */}
            <div className="mb-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="text-xs text-slate-500 block">{language === 'ar' ? 'العنوان' : 'Title'}</label>
                <button
                  type="button"
                  onClick={() => handleRegenerateField({ field: 'title' })}
                  disabled={isRegeneratingField.title}
                  className="p-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={language === 'ar' ? 'إعادة الصياغة' : 'Regenerate'}
                  aria-label={language === 'ar' ? 'إعادة صياغة العنوان' : 'Regenerate title'}
                >
                  {isRegeneratingField.title ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <input
                type="text"
                value={currentSlide.title}
                onChange={(e) => updateSlideField('title', e.target.value)}
                aria-label={language === 'ar' ? 'العنوان' : 'Title'}
                title={language === 'ar' ? 'العنوان' : 'Title'}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary/50 outline-none"
              />
              {/* Title Style Controls */}
              <div className="flex gap-2 mt-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400">{language === 'ar' ? 'الحجم:' : 'Size:'}</span>
                  {(['small', 'medium', 'large'] as const).map(size => (
                    <button
                      key={size}
                      onClick={() => updateTitleStyle({ fontSize: size })}
                      className={`px-2 py-1 text-xs rounded ${(currentSlide.titleStyle?.fontSize || 'medium') === size ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600'}`}
                    >
                      {size === 'small' ? 'S' : size === 'medium' ? 'M' : 'L'}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400">{language === 'ar' ? 'الخط:' : 'Style:'}</span>
                  <button
                    onClick={() => updateTitleStyle({ fontWeight: 'normal' })}
                    className={`px-2 py-1 text-xs rounded ${(currentSlide.titleStyle?.fontWeight || 'bold') === 'normal' ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600'}`}
                  >
                    Normal
                  </button>
                  <button
                    onClick={() => updateTitleStyle({ fontWeight: 'bold' })}
                    className={`px-2 py-1 text-xs rounded font-bold ${(currentSlide.titleStyle?.fontWeight || 'bold') === 'bold' ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600'}`}
                  >
                    Bold
                  </button>
                  <button
                    onClick={() => updateTitleStyle({ fontStyle: currentSlide.titleStyle?.fontStyle === 'italic' ? 'normal' : 'italic' })}
                    className={`px-2 py-1 text-xs rounded italic ${currentSlide.titleStyle?.fontStyle === 'italic' ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600'}`}
                  >
                    Italic
                  </button>
                  <button
                    onClick={() => updateTitleStyle({ textDecoration: currentSlide.titleStyle?.textDecoration === 'underline' ? 'none' : 'underline' })}
                    className={`px-2 py-1 text-xs rounded underline ${currentSlide.titleStyle?.textDecoration === 'underline' ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600'}`}
                  >
                    U
                  </button>
                </div>
                <div className="mt-2">
                  <span className="text-xs text-slate-400 block mb-1">{language === 'ar' ? 'اللون:' : 'Color:'}</span>
                  <ColorPickerWithGradient
                    value={currentSlide.titleStyle?.color || '#ffffff'}
                    onChange={(color) => updateTitleStyle({ color })}
                    label="title"
                  />
                </div>
              </div>
            </div>
            
            {/* Subtitle */}
            <div className="mb-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="text-xs text-slate-500 block">{language === 'ar' ? 'العنوان الفرعي' : 'Subtitle'}</label>
                <button
                  type="button"
                  onClick={() => handleRegenerateField({ field: 'subtitle' })}
                  disabled={isRegeneratingField.subtitle}
                  className="p-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={language === 'ar' ? 'إعادة الصياغة' : 'Regenerate'}
                  aria-label={language === 'ar' ? 'إعادة صياغة العنوان الفرعي' : 'Regenerate subtitle'}
                >
                  {isRegeneratingField.subtitle ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <input
                type="text"
                value={currentSlide.subtitle || ''}
                onChange={(e) => updateSlideField('subtitle', e.target.value)}
                aria-label={language === 'ar' ? 'العنوان الفرعي' : 'Subtitle'}
                title={language === 'ar' ? 'العنوان الفرعي' : 'Subtitle'}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary/50 outline-none"
              />
              {/* Subtitle Style Controls */}
              <div className="flex gap-2 mt-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400">{language === 'ar' ? 'الحجم:' : 'Size:'}</span>
                  {(['small', 'medium', 'large'] as const).map(size => (
                    <button
                      key={size}
                      onClick={() => updateSubtitleStyle({ fontSize: size })}
                      className={`px-2 py-1 text-xs rounded ${(currentSlide.subtitleStyle?.fontSize || 'medium') === size ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600'}`}
                    >
                      {size === 'small' ? 'S' : size === 'medium' ? 'M' : 'L'}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400">{language === 'ar' ? 'الخط:' : 'Style:'}</span>
                  <button
                    onClick={() => updateSubtitleStyle({ fontWeight: 'normal' })}
                    className={`px-2 py-1 text-xs rounded ${(currentSlide.subtitleStyle?.fontWeight || 'normal') === 'normal' ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600'}`}
                  >
                    Normal
                  </button>
                  <button
                    onClick={() => updateSubtitleStyle({ fontWeight: 'bold' })}
                    className={`px-2 py-1 text-xs rounded font-bold ${currentSlide.subtitleStyle?.fontWeight === 'bold' ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600'}`}
                  >
                    Bold
                  </button>
                  <button
                    onClick={() => updateSubtitleStyle({ fontStyle: currentSlide.subtitleStyle?.fontStyle === 'italic' ? 'normal' : 'italic' })}
                    className={`px-2 py-1 text-xs rounded italic ${currentSlide.subtitleStyle?.fontStyle === 'italic' ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600'}`}
                  >
                    Italic
                  </button>
                  <button
                    onClick={() => updateSubtitleStyle({ textDecoration: currentSlide.subtitleStyle?.textDecoration === 'underline' ? 'none' : 'underline' })}
                    className={`px-2 py-1 text-xs rounded underline ${currentSlide.subtitleStyle?.textDecoration === 'underline' ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600'}`}
                  >
                    U
                  </button>
                </div>
                <div className="mt-2">
                  <span className="text-xs text-slate-400 block mb-1">{language === 'ar' ? 'اللون:' : 'Color:'}</span>
                  <ColorPickerWithGradient
                    value={currentSlide.subtitleStyle?.color || '#94a3b8'}
                    onChange={(color) => updateSubtitleStyle({ color })}
                    label="subtitle"
                  />
                </div>
              </div>
            </div>
            
            {/* Bullets */}
            {currentSlide.role !== 'cover' && currentSlide.role !== 'thank_you' && (
              <div className="mb-3">
                <label className="text-xs text-slate-500 mb-2 block font-medium">{language === 'ar' ? 'النقاط' : 'Bullet Points'}</label>
                {/* Bullet Style Controls - Row 1: Size & Style */}
                <div className="flex gap-4 mb-2 flex-wrap items-center">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-400 font-medium">{language === 'ar' ? 'الحجم:' : 'Size:'}</span>
                    {(['small', 'medium', 'large'] as const).map(size => (
                      <button
                        key={size}
                        onClick={() => updateBulletStyle({ fontSize: size })}
                        className={`px-2 py-1 text-xs rounded ${(currentSlide.bulletStyle?.fontSize || 'medium') === size ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600'}`}
                      >
                        {size === 'small' ? 'S' : size === 'medium' ? 'M' : 'L'}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-400 font-medium">{language === 'ar' ? 'الخط:' : 'Style:'}</span>
                    <button
                      onClick={() => updateBulletStyle({ fontWeight: 'normal' })}
                      className={`px-2 py-1 text-xs rounded ${(currentSlide.bulletStyle?.fontWeight || 'normal') === 'normal' ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600'}`}
                    >
                      Normal
                    </button>
                    <button
                      onClick={() => updateBulletStyle({ fontWeight: 'bold' })}
                      className={`px-2 py-1 text-xs rounded font-bold ${currentSlide.bulletStyle?.fontWeight === 'bold' ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600'}`}
                    >
                      Bold
                    </button>
                    <button
                      onClick={() => updateBulletStyle({ fontStyle: currentSlide.bulletStyle?.fontStyle === 'italic' ? 'normal' : 'italic' })}
                      className={`px-2 py-1 text-xs rounded italic ${currentSlide.bulletStyle?.fontStyle === 'italic' ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600'}`}
                    >
                      Italic
                    </button>
                  </div>
                </div>
                {/* Bullet Style Controls - Row 2: Color */}
                <div className="mb-3">
                  <span className="text-xs text-slate-400 font-medium block mb-1">{language === 'ar' ? 'اللون:' : 'Color:'}</span>
                  <ColorPickerWithGradient
                    value={currentSlide.bulletStyle?.color || '#e2e8f0'}
                    onChange={(color) => updateBulletStyle({ color })}
                    label="bullets"
                  />
                </div>
                <div className="space-y-2">
                  {(currentSlide.bullets && currentSlide.bullets.length > 0 ? currentSlide.bullets : ['']).map((bullet, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={bullet}
                        onChange={(e) => updateSlideBullet(i, e.target.value)}
                        aria-label={language === 'ar' ? `نقطة ${i + 1}` : `Bullet ${i + 1}`}
                        title={language === 'ar' ? `نقطة ${i + 1}` : `Bullet ${i + 1}`}
                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary/50 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleRegenerateField({ field: 'bullet', bulletIndex: i })}
                        disabled={!!isRegeneratingField.bullets[i]}
                        className="p-2 text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={language === 'ar' ? 'إعادة الصياغة' : 'Regenerate'}
                        aria-label={language === 'ar' ? `إعادة صياغة النقطة ${i + 1}` : `Regenerate bullet ${i + 1}`}
                      >
                        {isRegeneratingField.bullets[i] ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </button>
                      {currentSlide.bullets && currentSlide.bullets.length > 0 && (
                        <button
                          type="button"
                          onClick={() => deleteSlideBullet(i)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title={language === 'ar' ? 'حذف' : 'Delete'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    addSlideBullet();
                  }}
                  className="mt-2 flex items-center gap-1 text-sm text-primary hover:underline cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  {language === 'ar' ? 'إضافة نقطة' : 'Add bullet'}
                </button>
              </div>
            )}

            {/* Layout Options */}
            <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <label className="text-xs text-slate-500 mb-2 block font-medium">
                📐 {language === 'ar' ? 'تخطيط الشريحة' : 'Slide Layout'}
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { key: 'text_left', label: language === 'ar' ? 'نص يسار' : 'Text Left', icon: '◧' },
                  { key: 'image_left', label: language === 'ar' ? 'صورة يسار' : 'Image Left', icon: '◨' },
                  { key: 'image_top', label: language === 'ar' ? 'صورة أعلى' : 'Image Top', icon: '⬒' },
                  { key: 'image_bottom', label: language === 'ar' ? 'صورة أسفل' : 'Image Bottom', icon: '⬓' },
                  { key: 'text_only', label: language === 'ar' ? 'نص فقط' : 'Text Only', icon: '▭' },
                ].map(layout => (
                  <button
                    key={layout.key}
                    onClick={() => setSlides(prev => prev.map((s, i) => 
                      i === selectedSlideIndex ? { ...s, layoutVariant: layout.key as LayoutVariant } : s
                    ))}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 text-xs transition-all ${
                      (currentSlide.layoutVariant || 'text_left') === layout.key 
                        ? 'border-primary bg-primary/10 text-primary' 
                        : 'border-slate-300 dark:border-slate-600 hover:border-primary/50'
                    }`}
                  >
                    <span className="text-lg">{layout.icon}</span>
                    <span className="text-[10px]">{layout.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Image Edit Section */}
            <div className={`mb-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg ${language === 'ar' ? 'text-right' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
              <label className="text-xs text-slate-500 mb-2 block font-medium">
                🖼️ {language === 'ar' ? 'صورة الشريحة' : 'Slide Image'}
              </label>
              <div className="flex flex-col gap-3">
                <div className={`flex items-center gap-3 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                  <div className="w-24 h-16 rounded-lg border border-dashed border-slate-300 dark:border-slate-500 overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] text-slate-400">
                    {currentSlide.imageUrl ? (
                      renderSlideImage(currentSlide, { className: 'w-full h-full' })
                    ) : (
                      <span>{language === 'ar' ? 'لا توجد صورة' : 'No image'}</span>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <input
                      type="file"
                      accept="image/*,image/heic,image/heif,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.bmp,.tiff"
                      aria-label={language === 'ar' ? 'رفع صورة للشريحة' : 'Upload slide image'}
                      title={language === 'ar' ? 'رفع صورة للشريحة' : 'Upload slide image'}
                      className={`text-[11px] file:text-[11px] file:px-3 file:py-1.5 ${language === 'ar' ? 'file:ml-2' : 'file:mr-2'} file:rounded-lg file:border-0 file:bg-primary file:text-white file:cursor-pointer`}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const url = URL.createObjectURL(file);
                        setSlides(prev => prev.map((s, i) =>
                          i === selectedSlideIndex ? { ...s, imageUrl: url, imageFit: (s.imageFit || 'crop'), imageTransform: getDefaultImageTransform(), imageFocusX: 'center', imageFocusY: 'center' } : s
                        ));
                      }}
                    />
                    <div className={`flex items-center gap-2 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                      {/* Regenerate Image with AI - nicer button */}
                      <input
                        type="text"
                        value={imagePromptText}
                        onChange={(e) => setImagePromptText(e.target.value)}
                        placeholder={language === 'ar' ? 'وصف قصير للصورة...' : 'Short image prompt...'}
                        className="flex-1 min-w-[140px] px-2 py-1.5 text-[11px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary/50 outline-none"
                      />
                      <button
                        onClick={handleRegenerateImage}
                        disabled={isRegeneratingImage}
                        className={`px-3 py-1.5 text-[11px] rounded-lg bg-gradient-to-r from-primary/90 to-primary text-white hover:from-primary hover:to-primary/90 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm ${language === 'ar' ? 'flex-row-reverse' : ''}`}
                      >
                        {isRegeneratingImage ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        {isRegeneratingImage 
                          ? (language === 'ar' ? 'جارٍ الإنشاء...' : 'Generating...') 
                          : (language === 'ar' ? 'إنشاء بالذكاء' : 'Regenerate')}
                      </button>
                      {/* Remove Image */}
                      {currentSlide.imageUrl && (
                        <button
                          onClick={() => setSlides(prev => prev.map((s, i) =>
                            i === selectedSlideIndex ? { ...s, imageUrl: undefined, imageTransform: undefined, imageFocusX: undefined, imageFocusY: undefined } : s
                          ))}
                          className={`text-[11px] text-red-500 hover:text-red-600 flex items-center gap-1 ${language === 'ar' ? 'flex-row-reverse' : ''}`}
                        >
                          <Trash2 className="w-3 h-3" />
                          {language === 'ar' ? 'إزالة' : 'Remove'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Image Size */}
                <div className={`flex items-center gap-2 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                  <span className="text-[11px] text-slate-500">{language === 'ar' ? 'حجم الصورة:' : 'Size:'}</span>
                  <div className="flex gap-1">
                    {(['small', 'medium', 'large', 'full'] as const).map(size => (
                      <button
                        key={size}
                        onClick={() => setSlides(prev => prev.map((s, i) => 
                          i === selectedSlideIndex ? { ...s, imageSize: size } : s
                        ))}
                        className={`px-2 py-1 text-[10px] rounded transition-colors ${(currentSlide.imageSize || 'medium') === size ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500'}`}
                      >
                        {size === 'small' ? 'S' : size === 'medium' ? 'M' : size === 'large' ? 'L' : 'Full'}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Image Fit Mode */}
                <div className={`flex items-center gap-2 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                  <span className="text-[11px] text-slate-500">{language === 'ar' ? 'الوضع:' : 'Mode:'}</span>
                  <div className="flex gap-1">
                    {(['crop', 'fit', 'fill'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setSlides(prev => prev.map((s, i) => 
                          i === selectedSlideIndex ? { ...s, imageFit: mode } : s
                        ))}
                        className={`px-2 py-1 text-[10px] rounded transition-colors ${(currentSlide.imageFit || 'crop') === mode ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500'}`}
                      >
                        {mode === 'crop' ? 'Crop' : mode === 'fit' ? 'Fit' : 'Fill'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Crop Controls (Zoom + Focus Point + Reset) */}
                {currentSlide.imageUrl && (
                  <div className="mt-2 p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white/60 dark:bg-slate-800/40">
                    <div className={`flex items-center justify-between gap-2 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                      <span className="text-[11px] text-slate-500">
                        {language === 'ar' ? 'تحكم القص:' : 'Crop controls:'}
                      </span>
                      <button
                        type="button"
                        onClick={resetCurrentSlideImageTransform}
                        className="text-[11px] text-slate-600 dark:text-slate-300 hover:underline"
                      >
                        {language === 'ar' ? 'إعادة ضبط' : 'Reset'}
                      </button>
                    </div>

                    <div className="mt-2">
                      <div className={`flex items-center justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                        <span className="text-[11px] text-slate-500">
                          {language === 'ar' ? 'تكبير:' : 'Zoom:'}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {getCurrentSlideTransform().scale.toFixed(2)}x
                        </span>
                      </div>
                      <div className={`flex items-center gap-2 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                        <button
                          type="button"
                          className="px-2 py-1 text-[10px] rounded bg-slate-200 dark:bg-slate-600"
                          disabled={(currentSlide.imageFit || 'crop') !== 'crop'}
                          onClick={() => {
                            const t = getCurrentSlideTransform();
                            updateCurrentSlideImageTransform({ scale: clamp((t.scale ?? 1) - 0.05, 1, 3) });
                          }}
                        >
                          -
                        </button>
                        <input
                          type="range"
                          min={1}
                          max={3}
                          step={0.01}
                          value={getCurrentSlideTransform().scale}
                          aria-label="Image zoom"
                          title="Image zoom"
                          onChange={(e) => updateCurrentSlideImageTransform({ scale: Number(e.target.value) })}
                          className="w-full"
                          disabled={(currentSlide.imageFit || 'crop') !== 'crop'}
                        />
                        <button
                          type="button"
                          className="px-2 py-1 text-[10px] rounded bg-slate-200 dark:bg-slate-600"
                          disabled={(currentSlide.imageFit || 'crop') !== 'crop'}
                          onClick={() => {
                            const t = getCurrentSlideTransform();
                            updateCurrentSlideImageTransform({ scale: clamp((t.scale ?? 1) + 0.05, 1, 3) });
                          }}
                        >
                          +
                        </button>
                      </div>
                      {(currentSlide.imageFit || 'crop') !== 'crop' && (
                        <div className="text-[10px] text-slate-500 mt-1">
                          {language === 'ar' ? 'التكبير والسحب يعملان فقط في وضع Crop' : 'Zoom/drag only work in Crop mode'}
                        </div>
                      )}
                    </div>

                    <div className="mt-2">
                      <div className={`flex items-center justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                        <span className="text-[11px] text-slate-500">
                          {language === 'ar' ? 'الموضع الأفقي:' : 'Horizontal position:'}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {Math.round((50 + (getCurrentSlideTransform().xPct || 0)) * 10) / 10}%
                        </span>
                      </div>
                      <div className={`flex items-center gap-2 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                        <button
                          type="button"
                          className="px-2 py-1 text-[10px] rounded bg-slate-200 dark:bg-slate-600"
                          disabled={(currentSlide.imageFit || 'crop') !== 'crop'}
                          onClick={() => {
                            const t = getCurrentSlideTransform();
                            updateCurrentSlideImageTransform({ xPct: clamp((t.xPct || 0) - 0.5, -50, 50) });
                          }}
                        >
                          -
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={0.5}
                          value={clamp(50 + (getCurrentSlideTransform().xPct || 0), 0, 100)}
                          aria-label="Horizontal crop position"
                          title="Horizontal crop position"
                          onChange={(e) => updateCurrentSlideImageTransform({ xPct: clamp(Number(e.target.value) - 50, -50, 50) })}
                          className="w-full"
                          disabled={(currentSlide.imageFit || 'crop') !== 'crop'}
                        />
                        <button
                          type="button"
                          className="px-2 py-1 text-[10px] rounded bg-slate-200 dark:bg-slate-600"
                          disabled={(currentSlide.imageFit || 'crop') !== 'crop'}
                          onClick={() => {
                            const t = getCurrentSlideTransform();
                            updateCurrentSlideImageTransform({ xPct: clamp((t.xPct || 0) + 0.5, -50, 50) });
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="mt-2">
                      <div className={`flex items-center justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                        <span className="text-[11px] text-slate-500">
                          {language === 'ar' ? 'الموضع العمودي:' : 'Vertical position:'}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {Math.round((50 + (getCurrentSlideTransform().yPct || 0)) * 10) / 10}%
                        </span>
                      </div>
                      <div className={`flex items-center gap-2 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                        <button
                          type="button"
                          className="px-2 py-1 text-[10px] rounded bg-slate-200 dark:bg-slate-600"
                          disabled={(currentSlide.imageFit || 'crop') !== 'crop'}
                          onClick={() => {
                            const t = getCurrentSlideTransform();
                            updateCurrentSlideImageTransform({ yPct: clamp((t.yPct || 0) - 0.5, -50, 50) });
                          }}
                        >
                          -
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={0.5}
                          value={clamp(50 + (getCurrentSlideTransform().yPct || 0), 0, 100)}
                          aria-label="Vertical crop position"
                          title="Vertical crop position"
                          onChange={(e) => updateCurrentSlideImageTransform({ yPct: clamp(Number(e.target.value) - 50, -50, 50) })}
                          className="w-full"
                          disabled={(currentSlide.imageFit || 'crop') !== 'crop'}
                        />
                        <button
                          type="button"
                          className="px-2 py-1 text-[10px] rounded bg-slate-200 dark:bg-slate-600"
                          disabled={(currentSlide.imageFit || 'crop') !== 'crop'}
                          onClick={() => {
                            const t = getCurrentSlideTransform();
                            updateCurrentSlideImageTransform({ yPct: clamp((t.yPct || 0) + 0.5, -50, 50) });
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[11px] text-slate-500 mb-1">{language === 'ar' ? 'أفقي:' : 'Horizontal:'}</div>
                        <div className="flex gap-1">
                          {(['left', 'center', 'right'] as const).map((fx) => (
                            <button
                              key={fx}
                              type="button"
                              onClick={() => setCurrentSlideFocus(fx, currentSlide.imageFocusY || 'center')}
                              className={`px-2 py-1 text-[10px] rounded transition-colors ${
                                (currentSlide.imageFocusX || 'center') === fx ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600'
                              }`}
                            >
                              {fx === 'left' ? 'L' : fx === 'center' ? 'C' : 'R'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] text-slate-500 mb-1">{language === 'ar' ? 'عمودي:' : 'Vertical:'}</div>
                        <div className="flex gap-1">
                          {(['top', 'center', 'bottom'] as const).map((fy) => (
                            <button
                              key={fy}
                              type="button"
                              onClick={() => setCurrentSlideFocus(currentSlide.imageFocusX || 'center', fy)}
                              className={`px-2 py-1 text-[10px] rounded transition-colors ${
                                (currentSlide.imageFocusY || 'center') === fy ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600'
                              }`}
                            >
                              {fy === 'top' ? 'T' : fy === 'center' ? 'C' : 'B'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 text-[10px] text-slate-500">
                      {language === 'ar'
                        ? 'اسحب الصورة داخل الإطار لتحريكها'
                        : 'Drag the image inside the frame to reposition'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Keywords Styling */}
            <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <label className="text-xs text-slate-500 mb-2 block font-medium">
                ✨ {language === 'ar' ? 'الكلمات المميزة' : 'Keywords (Highlighted Words)'}
              </label>
              {/* Keyword Size & Style */}
              <div className="flex gap-4 mb-2 flex-wrap items-center">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400 font-medium">{language === 'ar' ? 'الحجم:' : 'Size:'}</span>
                  {(['small', 'medium', 'large'] as const).map(size => (
                    <button
                      key={size}
                      onClick={() => applySlideUpdate((s) => ({ ...s, accentFontSize: size }))}
                      className={`px-2 py-1 text-xs rounded ${(currentSlide.accentFontSize || 'medium') === size ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600'}`}
                    >
                      {size === 'small' ? 'S' : size === 'medium' ? 'M' : 'L'}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400 font-medium">{language === 'ar' ? 'الخط:' : 'Style:'}</span>
                  <button
                    onClick={() => applySlideUpdate((s) => ({ ...s, accentFontWeight: 'normal' }))}
                    className={`px-2 py-1 text-xs rounded ${(currentSlide.accentFontWeight || 'bold') === 'normal' ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600'}`}
                  >
                    Normal
                  </button>
                  <button
                    onClick={() => applySlideUpdate((s) => ({ ...s, accentFontWeight: 'bold' }))}
                    className={`px-2 py-1 text-xs rounded font-bold ${(currentSlide.accentFontWeight || 'bold') === 'bold' ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600'}`}
                  >
                    Bold
                  </button>
                  <button
                    onClick={() => applySlideUpdate((s) => ({ ...s, accentFontStyle: currentSlide.accentFontStyle === 'italic' ? 'normal' : 'italic' }))}
                    className={`px-2 py-1 text-xs rounded italic ${currentSlide.accentFontStyle === 'italic' ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600'}`}
                  >
                    Italic
                  </button>
                </div>
              </div>
              {/* Keyword Color - Color Picker */}
              <div className="mt-2">
                <span className="text-xs text-slate-400 font-medium block mb-1">{language === 'ar' ? 'اللون:' : 'Color:'}</span>
                <ColorPickerWithGradient
                  value={currentSlide.accentColor || '#f97316'}
                  onChange={(color) => applySlideUpdate((s) => ({ ...s, accentColor: color }))}
                  label="keywords"
                />
              </div>
            </div>

            {/* Bullet Dots Styling */}
            <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <label className="text-xs text-slate-500 mb-2 block font-medium">
                ● {language === 'ar' ? 'نقاط القائمة' : 'Bullet Dots'}
              </label>
              {/* Bullet Dot Shape */}
              <div className="flex gap-2 mb-2 flex-wrap items-center">
                <span className="text-xs text-slate-400 font-medium">{language === 'ar' ? 'الشكل:' : 'Shape:'}</span>
                {([
                  { key: 'dot', label: '●', title: 'Dot' },
                  { key: 'diamond', label: '◆', title: 'Diamond' },
                  { key: 'arrow', label: '➤', title: 'Arrow' },
                  { key: 'dash', label: '—', title: 'Dash' },
                  { key: 'number', label: '1.', title: 'Numbers' },
                  { key: 'letter', label: 'a.', title: 'Letters' },
                ] as const).map(shape => (
                  <button
                    key={shape.key}
                    onClick={() => applySlideUpdate((s) => ({ ...s, bulletDotShape: shape.key }))}
                    className={`px-2 py-1 text-sm rounded ${(currentSlide.bulletDotShape || 'dot') === shape.key ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600'}`}
                    title={shape.title}
                  >
                    {shape.label}
                  </button>
                ))}
              </div>
              {/* Bullet Dot Size */}
              <div className="flex gap-4 mb-2 flex-wrap items-center">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400 font-medium">{language === 'ar' ? 'الحجم:' : 'Size:'}</span>
                  {(['small', 'medium', 'large'] as const).map(size => (
                    <button
                      key={size}
                      onClick={() => applySlideUpdate((s) => ({ ...s, bulletDotSize: size }))}
                      className={`px-2 py-1 text-xs rounded ${(currentSlide.bulletDotSize || 'small') === size ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600'}`}
                    >
                      {size === 'small' ? 'S' : size === 'medium' ? 'M' : 'L'}
                    </button>
                  ))}
                </div>
              </div>
              {/* Bullet Dot Color - Color Picker */}
              <div className="mt-2">
                <span className="text-xs text-slate-400 font-medium block mb-1">{language === 'ar' ? 'اللون:' : 'Color:'}</span>
                <ColorPickerWithGradient
                  value={currentSlide.bulletDotColor || '#f97316'}
                  onChange={(color) => applySlideUpdate((s) => ({ ...s, bulletDotColor: color }))}
                  label="bulletDots"
                />
              </div>
            </div>

            {/* Slide Background - Color Picker */}
            <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div className="flex items-center justify-between gap-3 mb-2">
                <label className="text-xs text-slate-500 block font-medium">
                  🎨 {language === 'ar' ? 'خلفية الشريحة' : 'Slide Background'}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{language === 'ar' ? 'لكل الشرائح' : 'All slides'}</span>
                  <Switch
                    checked={applyBackgroundToAllSlides}
                    onCheckedChange={(v) => {
                      const next = !!v;
                      if (next && currentSlide?.slideBg) {
                        const bg = currentSlide.slideBg;
                        setSlides(prev => prev.map((s) => ({ ...s, slideBg: bg })));
                      }
                      setApplyBackgroundToAllSlides(next);
                    }}
                  />
                </div>
              </div>
              <ColorPickerWithGradient
                value={currentSlide.slideBg || '#1e293b'}
                onChange={(color) => applySlideBackgroundUpdate((s) => ({ ...s, slideBg: color }))}
                label="background"
              />
            </div>

            {/* Narration Voice - for MP4 export */}
            <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div className="flex items-center justify-between gap-3 mb-2">
                <label className="text-xs text-slate-500 block font-medium">
                  🎤 {language === 'ar' ? 'صوت السرد (للفيديو)' : 'Narration Voice (for Video)'}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{language === 'ar' ? 'لكل الشرائح' : 'All slides'}</span>
                  <Switch
                    checked={applyVoiceToAllSlides}
                    onCheckedChange={(v) => {
                      const next = !!v;
                      if (next && currentSlide?.voiceGender) {
                        const voice = currentSlide.voiceGender;
                        setSlides(prev => prev.map((s) => ({ ...s, voiceGender: voice })));
                      }
                      setApplyVoiceToAllSlides(next);
                    }}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const newGender = 'male';
                    if (applyVoiceToAllSlides) {
                      setSlides(prev => prev.map((s) => ({ ...s, voiceGender: newGender })));
                    } else {
                      setSlides(prev => prev.map((s, i) => i === selectedSlideIndex ? { ...s, voiceGender: newGender } : s));
                    }
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    (currentSlide.voiceGender || 'male') === 'male'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500'
                  }`}
                >
                  👨 {language === 'ar' ? 'ذكر' : 'Male'}
                </button>
                <button
                  onClick={() => {
                    const newGender = 'female';
                    if (applyVoiceToAllSlides) {
                      setSlides(prev => prev.map((s) => ({ ...s, voiceGender: newGender })));
                    } else {
                      setSlides(prev => prev.map((s, i) => i === selectedSlideIndex ? { ...s, voiceGender: newGender } : s));
                    }
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    currentSlide.voiceGender === 'female'
                      ? 'bg-pink-600 text-white shadow-md'
                      : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500'
                  }`}
                >
                  👩 {language === 'ar' ? 'أنثى' : 'Female'}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                {language === 'ar' 
                  ? 'يُستخدم الصوت عند تصدير الفيديو (MP4) فقط. PDF و PowerPoint بدون صوت.'
                  : 'Voice is used for video (MP4) export only. PDF & PowerPoint have no audio.'}
              </p>
            </div>
          </div>
        )}

        {/* Slide navigation - more prominent indicator */}
        <div className="flex items-center justify-center gap-4 mt-4">
          <button
            onClick={() => setSelectedSlideIndex(Math.max(0, selectedSlideIndex - 1))}
            disabled={selectedSlideIndex === 0}
            className="p-2 rounded-full bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label={language === 'ar' ? 'الشريحة السابقة' : 'Previous slide'}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-primary">
              {selectedSlideIndex + 1}/{slides.length}
            </span>
            <span className="text-xs text-slate-500">
              {language === 'ar' ? 'الشريحة' : 'Slide'}
            </span>
          </div>
          <button
            onClick={() => setSelectedSlideIndex(Math.min(slides.length - 1, selectedSlideIndex + 1))}
            disabled={selectedSlideIndex === slides.length - 1}
            className="p-2 rounded-full bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label={language === 'ar' ? 'الشريحة التالية' : 'Next slide'}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Thumbnail strip - Dokie style */}
        <div className="flex gap-2 overflow-x-auto py-3 px-2 bg-slate-100 dark:bg-slate-800 rounded-xl mt-4">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              onClick={() => setSelectedSlideIndex(i)}
              className={`relative w-24 h-16 rounded-lg border-2 flex-shrink-0 overflow-hidden transition-all ${
                selectedSlideIndex === i
                  ? `border-emerald-400 shadow-lg scale-105`
                  : `border-slate-600 hover:${selectedTheme === 'pitch_deck' ? 'border-emerald-400' : selectedTheme === 'creative' ? 'border-orange-400' : selectedTheme === 'professional' ? 'border-indigo-400' : 'border-blue-400'}`
              }`}
            >
              {/* Mini slide preview - theme-aware */}
              <div
                className={`w-full h-full p-1 flex flex-col ${slide.slideBg ? '' : `bg-gradient-to-br ${
                  selectedTheme === 'pitch_deck' ? 'from-slate-900 via-emerald-900/20 to-slate-900' :
                  selectedTheme === 'creative' ? 'from-orange-600 to-pink-700' :
                  selectedTheme === 'professional' ? 'from-slate-800 to-indigo-900' :
                  'from-slate-900 to-slate-800'
                }`}`}
                style={slide.slideBg ? getColorStyle(slide.slideBg, 'background') : undefined}
              >
                {/* Mini title bar */}
                <div className="flex items-center gap-0.5 mb-1">
                  <div className={`w-1 h-1 rounded-full ${getThemeAccent(selectedTheme).bg}`} />
                  <div className={`w-1 h-1 rounded-full ${getThemeAccent(selectedTheme).bg}`} />
                </div>
                {/* Content preview */}
                <div className="flex-1 flex items-center justify-center">
                  {slide.imageUrl ? (
                    renderSlideImage(slide, { className: 'w-full h-full rounded opacity-60' })
                  ) : slide.columns && slide.columns.length > 0 ? (
                    <div className="flex gap-0.5">
                      {[1,2,3].map(n => <div key={n} className="w-2 h-3 bg-slate-700 rounded-sm" />)}
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <div className="w-8 h-0.5 bg-slate-600 rounded" />
                      <div className="w-6 h-0.5 bg-slate-700 rounded" />
                    </div>
                  )}
                </div>
                {/* Slide number */}
                <div className="text-[8px] text-slate-500 text-right">{String(i + 1).padStart(2, '0')}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render My Presentations tab
  // ─────────────────────────────────────────────────────────────────────────

  const renderMyPresentationsTab = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-4">
          <FileText className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-semibold">
          {language === 'ar' ? 'عروضي التقديمية' : 'My Presentations'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {language === 'ar' 
            ? 'جميع العروض التقديمية التي قمت بإنشائها'
            : 'All presentations you have created'}
        </p>
      </div>

      {isLoadingPresentations ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : savedPresentations.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-xl">
          <Presentation className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">
            {language === 'ar' ? 'لا توجد عروض تقديمية بعد' : 'No presentations yet'}
          </p>
          <button
            onClick={() => setActiveTab('create')}
            className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {language === 'ar' ? 'إنشاء عرض جديد' : 'Create New Presentation'}
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {savedPresentations.map((pres) => (
            <div
              key={pres.id}
              className="group relative rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
              onClick={() => loadPresentation(pres.id)}
            >
              {/* Thumbnail or placeholder */}
              <div className="aspect-video rounded-lg bg-muted mb-3 flex items-center justify-center overflow-hidden">
                {pres.thumbnail_url ? (
                  <img src={pres.thumbnail_url} alt={pres.title} className="w-full h-full object-cover" />
                ) : (
                  <Presentation className="w-8 h-8 text-muted-foreground/40" />
                )}
              </div>
              
              {/* Title */}
              <h3 className="font-medium text-sm truncate">{pres.title}</h3>
              
              {/* Meta */}
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span>{new Date(pres.updated_at).toLocaleDateString()}</span>
                <span>•</span>
                <span className="capitalize">{pres.theme.replace('_', ' ')}</span>
              </div>

              {/* Share link - clickable to copy */}
              {pres.share_url && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(pres.share_url!);
                    toast.success(language === 'ar' ? 'تم نسخ الرابط' : 'Link copied');
                  }}
                  className="mt-2 flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:underline"
                  title={pres.share_url}
                >
                  <Share2 className="w-3 h-3" />
                  <span>{language === 'ar' ? 'نسخ رابط المشاركة' : 'Copy share link'}</span>
                </button>
              )}

              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(language === 'ar' ? 'هل تريد حذف هذا العرض؟' : 'Delete this presentation?')) {
                    deletePresentation(pres.id);
                  }
                }}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-background/80 border border-border opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                title={language === 'ar' ? 'حذف' : 'Delete'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <button
          onClick={() => setActiveTab('create')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'create'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {language === 'ar' ? 'إنشاء جديد' : 'Create New'}
          </div>
        </button>
        <button
          onClick={() => {
            setActiveTab('my_presentations');
            loadSavedPresentations();
            migrateLegacyPresentations();
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'my_presentations'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {language === 'ar' ? 'عروضي' : 'My Presentations'}
          </div>
        </button>
      </div>

      {activeTab === 'my_presentations' ? (
        renderMyPresentationsTab()
      ) : (
        <>
          {renderStepIndicator()}

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {currentStep === 'topic' && renderTopicStep()}
          {currentStep === 'brief' && renderBriefStep()}
          {currentStep === 'outline' && renderOutlineStep()}
          {currentStep === 'slides' && renderSlidesStep()}
        </>
      )}
    </div>
  );
};

export default PresentationTab;
