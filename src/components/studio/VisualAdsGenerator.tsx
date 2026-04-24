import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Plus, Smartphone, Square, Monitor, Wand2, Globe, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { SavedImagesPicker } from '@/components/dashboard/SavedImagesPicker';

// Types
export interface VisualAdsState {
  brandAsset: {
    image: string | null;
    type: 'logo' | 'product' | 'screenshot' | 'person' | 'background' | 'icon' | 'prop' | 'mascot' | 'texture' | 'illustration' | null;
    customType?: string | null;
    customTypeDraft?: string | null;
    personMode?: 'exact' | 'reference' | null;
    exactPersonStyle?: 'same-pose' | 'adapted-pose' | 'upper-body' | null;
    referenceStyle?: 'realistic' | 'character' | null;
    logoMode?: 'as-is' | 'transparent' | null;
    screenshotDevice?: 'iphone' | 'samsung' | 'laptop' | 'tablet' | 'monitor-tv' | 'billboard' | null;
  };
  assets: Array<{
    image: string | null;
    type: 'logo' | 'product' | 'screenshot' | 'person' | 'background' | 'icon' | 'prop' | 'mascot' | 'texture' | 'illustration' | null;
    customType?: string | null;
    customTypeDraft?: string | null;
    personMode?: 'exact' | 'reference' | null;
    exactPersonStyle?: 'same-pose' | 'adapted-pose' | 'upper-body' | null;
    referenceStyle?: 'realistic' | 'character' | null;
    logoMode?: 'as-is' | 'transparent' | null;
    screenshotDevice?: 'iphone' | 'samsung' | 'laptop' | 'tablet' | 'monitor-tv' | 'billboard' | null;
  }>;
  campaignDNA: {
    platform: '9:16' | '1:1' | '16:9' | null;
    objective: string;
  };
  creativeSoul: {
    mainMessage: string;
    customMainMessage: string;
    mainMessageVariant: string;
    cta: string;
    customCta: string;
    style: string;
    customStyle: string;
    styleVariant: string;
  };
}

interface VisualAdsGeneratorProps {
  onBack: () => void;
  onGenerate: (state: VisualAdsState) => Promise<void>;
  isGenerating: boolean;
  progress: number;
  resultUrl?: string;
  onSave?: () => void;
  onDownload?: () => void;
  onTryAgain?: () => void;
}

function StepHeader({
  step,
  title,
  subtitle,
  isActive,
  isCompleted,
  isGenerating,
  onOpen,
}: {
  step: number;
  title: string;
  subtitle: string;
  isActive: boolean;
  isCompleted: boolean;
  isGenerating: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      disabled={isGenerating}
      className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all duration-300 min-h-[44px] ${
        isActive
          ? 'bg-gradient-to-r from-[#060541]/10 via-[#1a1a4a]/10 to-[#060541]/10 dark:from-[#f2f2f2]/10 dark:via-[#e0e0e0]/10 dark:to-[#f2f2f2]/10 border-2 border-[#060541]/30 dark:border-[#f2f2f2]/30 shadow-[0_0_20px_rgba(6,5,65,0.15)] dark:shadow-[0_0_20px_rgba(242,242,242,0.1)]'
          : isCompleted
            ? 'bg-green-500/10 border border-green-500/30'
            : 'bg-white/50 dark:bg-white/5 border border-[#606062]/20 dark:border-[#858384]/30 hover:bg-white/70 dark:hover:bg-white/10'
      }`}
    >
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
        isActive
          ? 'bg-[#060541] text-white dark:bg-[#f2f2f2] dark:text-[#060541]'
          : isCompleted
            ? 'bg-green-500 text-white'
            : 'bg-[#606062]/20 text-[#858384]'
      }`}>
        {isCompleted && !isActive ? '✓' : step}
      </div>
      <div className="flex-1 text-left">
        <h3 className={`font-bold text-sm ${isActive ? 'text-[#060541] dark:text-[#f2f2f2]' : 'text-foreground'}`}>
          {title}
        </h3>
        <p className="text-xs text-[#858384]">{subtitle}</p>
      </div>
      <div className={`flex-shrink-0 w-2 h-2 rounded-full transition-all duration-300 ${
        isActive ? 'bg-[#060541] dark:bg-[#f2f2f2] animate-pulse' : 'bg-transparent'
      }`} />
    </button>
  );
}

function StepContent({ step, activeStep, children }: { step: number; activeStep: number; children: React.ReactNode }) {
  const isActive = activeStep === step;
  return (
    <div className={`transition-all duration-300 ease-in-out ${
      isActive ? 'max-h-[2600px] opacity-100 overflow-visible' : 'max-h-0 opacity-0 overflow-hidden'
    }`}>
      <div className="pt-3 pb-4 px-2">
        {children}
      </div>
    </div>
  );
}

// What the ad is about — pick one chip
export const adTopicChips = [
  { id: 'new-launch',    label: '🚀 New Launch',          prompt: 'exciting new product launch' },
  { id: 'limited-offer', label: '⏰ Limited Offer',        prompt: 'limited-time offer, urgency' },
  { id: 'app-download',  label: '📱 App Download',         prompt: 'app download promotion' },
  { id: 'save-time',     label: '⚡ Save Time',            prompt: 'time-saving benefit' },
  { id: 'premium',       label: '✨ Premium Quality',      prompt: 'premium quality and prestige' },
  { id: 'social-proof',  label: '⭐ Customer Love',        prompt: 'social proof and customer trust' },
  { id: 'features',      label: '🎯 Show Features',        prompt: 'product feature showcase' },
  { id: 'sale',          label: '🛍️ Sale / Discount',      prompt: 'sale or discount offer' },
];

export const mainMessageVariantMap: Record<string, Array<{ id: string; labelEn: string; labelAr: string; prompt: string }>> = {
  'new-launch': [
    { id: 'hero-reveal', labelEn: 'Hero Reveal', labelAr: 'كشف البطل', prompt: 'Treat the campaign like a dramatic hero reveal with one big centerpiece moment.' },
    { id: 'future-wave', labelEn: 'Future Wave', labelAr: 'موجة مستقبلية', prompt: 'Make it feel futuristic, visionary, and ahead of its category.' },
    { id: 'founder-proud', labelEn: 'Proud Debut', labelAr: 'إطلاق بفخر', prompt: 'Give it a proud premium debut energy, like a launch everyone has been waiting for.' },
  ],
  'limited-offer': [
    { id: 'vip-window', labelEn: 'VIP Window', labelAr: 'فرصة خاصة', prompt: 'Present the offer like a rare VIP window, exclusive and almost gone.' },
    { id: 'countdown-pressure', labelEn: 'Countdown Pressure', labelAr: 'ضغط العد التنازلي', prompt: 'Use countdown-style urgency and high-stakes timing without looking cheap.' },
    { id: 'clean-urgency', labelEn: 'Clean Urgency', labelAr: 'استعجال أنيق', prompt: 'Keep the urgency strong but polished, premium, and uncluttered.' },
  ],
  'app-download': [
    { id: 'phone-first', labelEn: 'Phone-First Hero', labelAr: 'الهاتف هو البطل', prompt: 'Make the phone and app experience the central hero of the ad.' },
    { id: 'smart-lifestyle', labelEn: 'Smart Lifestyle', labelAr: 'أسلوب حياة ذكي', prompt: 'Make the app feel seamlessly embedded into a smart, aspirational lifestyle.' },
    { id: 'store-ready', labelEn: 'Launch Ready', labelAr: 'جاهز للتحميل', prompt: 'Make it feel app-store-ready, polished, and instantly downloadable.' },
  ],
  'save-time': [
    { id: 'calm-efficiency', labelEn: 'Calm Efficiency', labelAr: 'هدوء وكفاءة', prompt: 'Show peaceful efficiency and mental clarity rather than chaos.' },
    { id: 'instant-relief', labelEn: 'Instant Relief', labelAr: 'راحة فورية', prompt: 'Make the value feel like immediate relief from stress, friction, or wasted time.' },
    { id: 'smooth-routine', labelEn: 'Smooth Routine', labelAr: 'روتين سلس', prompt: 'Show the product making daily routine feel smooth, easy, and beautifully organized.' },
  ],
  'premium': [
    { id: 'crafted-luxury', labelEn: 'Crafted Luxury', labelAr: 'فخامة مصنوعة', prompt: 'Lean into craftsmanship, detail, and elite premium execution.' },
    { id: 'quiet-wealth', labelEn: 'Quiet Wealth', labelAr: 'ثراء هادئ', prompt: 'Make it feel expensive and elevated without shouting.' },
    { id: 'flagship-energy', labelEn: 'Flagship Energy', labelAr: 'طاقة رائدة', prompt: 'Present it like the flagship offering in its entire category.' },
  ],
  'social-proof': [
    { id: 'testimonial-cards', labelEn: 'Testimonial Cards', labelAr: 'بطاقات شهادات', prompt: 'Feature tasteful mini testimonial cards or quote snippets around the hero composition.' },
    { id: 'community-love', labelEn: 'Community Love', labelAr: 'حب المجتمع', prompt: 'Make it feel beloved by a real community, with warmth and genuine public excitement.' },
    { id: 'trust-signals', labelEn: 'Trust Signals', labelAr: 'إشارات ثقة', prompt: 'Emphasize trust badges, subtle rating cues, and premium proof markers.' },
  ],
  'features': [
    { id: 'feature-callouts', labelEn: 'Feature Callouts', labelAr: 'إبراز المزايا', prompt: 'Use clean callouts that spotlight a few key product features with clarity.' },
    { id: 'hero-plus-benefits', labelEn: 'Hero + Benefits', labelAr: 'بطل + فوائد', prompt: 'Balance a strong central hero visual with concise, premium benefit highlights.' },
    { id: 'smart-breakdown', labelEn: 'Smart Breakdown', labelAr: 'تفصيل ذكي', prompt: 'Organize the message like an elegant, intelligent breakdown of capabilities.' },
  ],
  'sale': [
    { id: 'price-drop', labelEn: 'Price Drop Hero', labelAr: 'هبوط السعر', prompt: 'Make the discount feel instantly visible and impossible to miss.' },
    { id: 'vip-deal', labelEn: 'VIP Deal', labelAr: 'عرض خاص', prompt: 'Position the sale like a premium insider deal rather than a bargain-bin promotion.' },
    { id: 'high-energy-flash', labelEn: 'Flash Energy', labelAr: 'طاقة فلاش', prompt: 'Bring energetic flash-sale excitement with bold momentum and urgency.' },
  ],
};

// CTA chips
export const ctaChips = [
  { id: 'download-now',   label: 'Download now' },
  { id: 'get-started',    label: 'Get started' },
  { id: 'shop-now',       label: 'Shop now' },
  { id: 'learn-more',     label: 'Learn more' },
  { id: 'book-now',       label: 'Book now' },
  { id: 'start-free',     label: 'Start free' },
  { id: 'try-today',      label: 'Try it today' },
  { id: 'join-now',       label: 'Join now' },
  { id: 'subscribe',      label: 'Subscribe' },
];

// Ad look & feel
export const adStyleChips = [
  { id: 'premium-dark',      label: '🌙 Sleek & Dark',       prompt: 'premium dark theme, elegant, high-contrast' },
  { id: 'bright-clean',      label: '☀️ Bright & Clean',     prompt: 'bright clean design, light background, fresh' },
  { id: 'bold-modern',       label: '⚡ Bold & Punchy',       prompt: 'bold modern design, high energy, strong typography' },
  { id: 'lifestyle',         label: '📸 Real & Human',        prompt: 'lifestyle photography feel, authentic and relatable' },
  { id: 'luxury-minimal',    label: '🤍 Luxury Minimal',      prompt: 'luxury minimalist, spacious, refined, premium' },
  { id: 'ugc',               label: '🎥 Natural / UGC',       prompt: 'organic UGC style, native social feed look' },
];

export const styleVariantMap: Record<string, Array<{ id: string; labelEn: string; labelAr: string; prompt: string }>> = {
  'premium-dark': [
    { id: 'luxury-noir', labelEn: 'Luxury Noir', labelAr: 'فخامة ليلية', prompt: 'Use noir-like premium drama, refined shadows, and luxury contrast.' },
    { id: 'cinematic-glow', labelEn: 'Cinematic Glow', labelAr: 'توهج سينمائي', prompt: 'Blend darkness with polished glow accents and cinematic mood lighting.' },
    { id: 'elite-tech', labelEn: 'Elite Tech', labelAr: 'تقني فاخر', prompt: 'Keep it dark, sleek, and premium with a high-end tech brand finish.' },
  ],
  'bright-clean': [
    { id: 'airy-minimal', labelEn: 'Airy Minimal', labelAr: 'بساطة هوائية', prompt: 'Use lots of clean space, softness, and fresh premium simplicity.' },
    { id: 'sunlit-premium', labelEn: 'Sunlit Premium', labelAr: 'إضاءة راقية', prompt: 'Use soft bright lighting and crisp premium cleanliness.' },
    { id: 'gallery-clean', labelEn: 'Gallery Clean', labelAr: 'نظافة المعرض', prompt: 'Make it feel polished like a modern design gallery or premium showroom.' },
  ],
  'bold-modern': [
    { id: 'neon-energy', labelEn: 'Neon Energy', labelAr: 'طاقة نيون', prompt: 'Push the boldness through neon accents, motion, and energetic contrast.' },
    { id: 'editorial-hype', labelEn: 'Editorial Hype', labelAr: 'حماس تحريري', prompt: 'Make it feel like a modern magazine cover with aggressive typography and punch.' },
    { id: 'tech-pop', labelEn: 'Tech Pop', labelAr: 'بوب تقني', prompt: 'Blend bold modern energy with playful, premium tech graphics.' },
  ],
  'lifestyle': [
    { id: 'warm-documentary', labelEn: 'Warm Documentary', labelAr: 'وثائقي دافئ', prompt: 'Keep it honest, warm, and grounded like premium documentary photography.' },
    { id: 'golden-hour', labelEn: 'Golden Hour', labelAr: 'ساعة ذهبية', prompt: 'Use warm golden-hour realism and emotional human atmosphere.' },
    { id: 'everyday-premium', labelEn: 'Everyday Premium', labelAr: 'يومي راقٍ', prompt: 'Keep it relatable and human, but still polished and premium.' },
  ],
  'luxury-minimal': [
    { id: 'silent-wealth', labelEn: 'Silent Wealth', labelAr: 'ثراء صامت', prompt: 'Strip it down to quiet premium confidence and elegant restraint.' },
    { id: 'museum-piece', labelEn: 'Museum Piece', labelAr: 'قطعة متحفية', prompt: 'Make the hero subject feel displayed like a precious museum piece.' },
    { id: 'monochrome-premium', labelEn: 'Monochrome Premium', labelAr: 'أحادي فاخر', prompt: 'Use restrained premium tones and minimalist luxury polish.' },
  ],
  'ugc': [
    { id: 'phone-capture', labelEn: 'Phone Capture', labelAr: 'لقطة هاتف', prompt: 'Make it feel like a naturally captured social post with authentic immediacy.' },
    { id: 'creator-post', labelEn: 'Creator Post', labelAr: 'منشور صانع محتوى', prompt: 'Lean into native creator energy, believable framing, and social familiarity.' },
    { id: 'real-feed', labelEn: 'Real Feed', labelAr: 'فيد حقيقي', prompt: 'Keep it real, spontaneous, and at home in a social feed.' },
  ],
};

const InstagramBrandIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const YouTubeBrandIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
    <path d="M21.6 7.2a2.9 2.9 0 0 0-2-2C17.8 4.7 12 4.7 12 4.7s-5.8 0-7.6.5a2.9 2.9 0 0 0-2 2C2 9 2 12 2 12s0 3 .4 4.8a2.9 2.9 0 0 0 2 2c1.8.5 7.6.5 7.6.5s5.8 0 7.6-.5a2.9 2.9 0 0 0 2-2C22 15 22 12 22 12s0-3-.4-4.8Z" />
    <path d="m10 15.5 5-3.5-5-3.5v7Z" fill="#0c0f14" />
  </svg>
);

const TikTokBrandIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
    <path d="M14.5 3c.3 1.7 1.3 3.1 2.9 4 .9.5 1.8.8 2.6.8V11c-1.5 0-3-.4-4.3-1.2v5.4a5.2 5.2 0 1 1-5.2-5.2c.4 0 .8 0 1.2.1v3.1a2.2 2.2 0 1 0 1.8 2.1V3h3Z" />
  </svg>
);

const SnapchatBrandIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
    <path d="M12 3.2c2.6 0 4.8 2 4.8 4.6 0 1 .1 1.7.4 2.4.2.4.5.8.9 1.1.5.4.9.7.9 1.1 0 .5-.5.8-1.3 1-1 .3-1.4.8-1.6 1.2-.2.5-.7.8-1.2.8-.6 0-1 .4-1.3 1-.4.7-.9 1-1.6 1s-1.2-.3-1.6-1c-.3-.6-.7-1-1.3-1-.5 0-1-.3-1.2-.8-.2-.4-.6-.9-1.6-1.2-.8-.2-1.3-.5-1.3-1 0-.4.4-.7.9-1.1.4-.3.7-.7.9-1.1.3-.7.4-1.4.4-2.4C7.2 5.2 9.4 3.2 12 3.2Z" />
  </svg>
);

const platformOptions = [
  {
    value: '9:16' as const,
    icon: Smartphone,
    titleEn: 'Stories / Shorts',
    titleAr: 'القصص / الشورتس',
    shortTitleEn: 'Stories',
    shortTitleAr: 'قصص',
    ratioEn: '9:16 vertical',
    ratioAr: 'عمودي 9:16',
    platforms: [
      {
        name: 'TikTok',
        icon: TikTokBrandIcon,
        badgeClass: 'bg-[#0c0f14] text-white border border-white/10',
      },
      {
        name: 'Snapchat',
        icon: SnapchatBrandIcon,
        badgeClass: 'bg-[#FFFC00] text-[#060541] border border-[#F5E800]',
      },
      {
        name: 'Instagram Reels',
        icon: InstagramBrandIcon,
        badgeClass: 'bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#515BD4] text-white border border-white/10',
      },
      {
        name: 'YouTube Shorts',
        icon: YouTubeBrandIcon,
        badgeClass: 'bg-[#FF0000] text-white border border-[#ff6b6b]/40',
      },
    ],
  },
  {
    value: '1:1' as const,
    icon: Square,
    titleEn: 'Square Post',
    titleAr: 'منشور مربع',
    shortTitleEn: 'Post',
    shortTitleAr: 'منشور',
    ratioEn: '1:1 square',
    ratioAr: 'مربع 1:1',
    platforms: [
      {
        name: 'Instagram Post',
        icon: InstagramBrandIcon,
        badgeClass: 'bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#515BD4] text-white border border-white/10',
      },
      {
        name: 'Website',
        icon: Globe,
        badgeClass: 'bg-[#060541]/85 text-white border border-[#060541]/50',
      },
    ],
  },
  {
    value: '16:9' as const,
    icon: Monitor,
    titleEn: 'Landscape Video',
    titleAr: 'فيديو أفقي',
    shortTitleEn: 'Video',
    shortTitleAr: 'فيديو',
    ratioEn: '16:9 horizontal',
    ratioAr: 'أفقي 16:9',
    platforms: [
      {
        name: 'YouTube',
        icon: YouTubeBrandIcon,
        badgeClass: 'bg-[#FF0000] text-white border border-[#ff6b6b]/40',
      },
      {
        name: 'Website',
        icon: Globe,
        badgeClass: 'bg-[#060541]/85 text-white border border-[#060541]/50',
      },
    ],
  },
];

export default function VisualAdsGenerator({
  onBack,
  onGenerate,
  isGenerating,
  progress,
  resultUrl,
  onDownload,
  onSave,
  onTryAgain,
}: VisualAdsGeneratorProps) {
  const { language } = useTheme();
  const assetTypeOptions = [
    { value: 'logo', label: language === 'ar' ? 'شعار' : 'Logo' },
    { value: 'product', label: language === 'ar' ? 'منتج' : 'Product' },
    { value: 'screenshot', label: language === 'ar' ? 'لقطة شاشة' : 'Screenshot' },
    { value: 'person', label: language === 'ar' ? 'شخص' : 'Person' },
    { value: 'background', label: language === 'ar' ? 'خلفية' : 'Background' },
    { value: 'icon', label: language === 'ar' ? 'أيقونة' : 'Icon' },
    { value: 'prop', label: language === 'ar' ? 'عنصر مساعد' : 'Prop' },
    { value: 'mascot', label: language === 'ar' ? 'تميمة' : 'Mascot' },
    { value: 'texture', label: language === 'ar' ? 'ملمس' : 'Texture' },
    { value: 'illustration', label: language === 'ar' ? 'رسم توضيحي' : 'Illustration' },
  ] as const;
  const MAX_ASSET_IMAGES = 6;
  const INITIAL_VISIBLE_SLOTS = 4;
  
  // State
  const [activeStep, setActiveStep] = useState<number | null>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAssetIndex, setSelectedAssetIndex] = useState(0);
  const [openBriefSection, setOpenBriefSection] = useState<1 | 4 | null>(1);
  const [visibleSlotCount, setVisibleSlotCount] = useState(INITIAL_VISIBLE_SLOTS);

  const [state, setState] = useState<VisualAdsState>({
    brandAsset: { image: null, type: null },
    campaignDNA: { platform: null, objective: '' },
    creativeSoul: { mainMessage: '', customMainMessage: '', mainMessageVariant: '', cta: '', customCta: '', style: '', customStyle: '', styleVariant: '' },
    assets: [],
  });

  // Helper to update nested state
  const updateState = useCallback(<K extends keyof VisualAdsState>(
    section: K,
    updates: Partial<VisualAdsState[K]>
  ) => {
    setState(prev => ({
      ...prev,
      [section]: { ...prev[section], ...updates },
    }));
  }, []);
  const updateCreativeSoul = useCallback((updates: Partial<VisualAdsState['creativeSoul']>) => {
    updateState('creativeSoul', updates);
  }, [updateState]);

  const normalizeWordLimitedValue = useCallback((value: string) => value.replace(/\s+/g, ' ').trim(), []);
  const hasMoreThanThreeWords = useCallback((value: string) => {
    const normalized = normalizeWordLimitedValue(value);
    return normalized.length > 0 && normalized.split(' ').length > 3;
  }, [normalizeWordLimitedValue]);
  const getCustomSelectionLabel = useCallback((value?: string) => {
    const normalized = normalizeWordLimitedValue(value || '');
    return normalized || (language === 'ar' ? 'مخصص' : 'Custom');
  }, [language, normalizeWordLimitedValue]);
  const getSelectedTopicMeta = useCallback(() => {
    if (state.creativeSoul.mainMessage === 'custom') {
      const customValue = normalizeWordLimitedValue(state.creativeSoul.customMainMessage || '');
      return {
        label: customValue,
        prompt: customValue,
      };
    }
    const selectedTopic = adTopicChips.find((chip) => chip.id === state.creativeSoul.mainMessage);
    return {
      label: selectedTopic?.label || '',
      prompt: selectedTopic?.prompt || '',
    };
  }, [state.creativeSoul.mainMessage, state.creativeSoul.customMainMessage, normalizeWordLimitedValue]);
  const getSelectedCtaLabel = useCallback(() => {
    if (state.creativeSoul.cta === 'custom') {
      return normalizeWordLimitedValue(state.creativeSoul.customCta || '');
    }
    return ctaChips.find((chip) => chip.id === state.creativeSoul.cta)?.label || '';
  }, [state.creativeSoul.cta, state.creativeSoul.customCta, normalizeWordLimitedValue]);
  const getSelectedTopicVariantMeta = useCallback(() => {
    if (!state.creativeSoul.mainMessage || state.creativeSoul.mainMessage === 'custom') {
      return { label: '', prompt: '' };
    }
    const selectedVariant = (mainMessageVariantMap[state.creativeSoul.mainMessage] || []).find((variant) => variant.id === state.creativeSoul.mainMessageVariant);
    return {
      label: language === 'ar' ? (selectedVariant?.labelAr || '') : (selectedVariant?.labelEn || ''),
      prompt: selectedVariant?.prompt || '',
    };
  }, [language, state.creativeSoul.mainMessage, state.creativeSoul.mainMessageVariant]);
  const getSelectedStyleMeta = useCallback(() => {
    if (state.creativeSoul.style === 'custom') {
      const customValue = normalizeWordLimitedValue(state.creativeSoul.customStyle || '');
      return {
        label: customValue,
        prompt: customValue,
      };
    }
    const selectedStyle = adStyleChips.find((chip) => chip.id === state.creativeSoul.style);
    return {
      label: selectedStyle?.label || '',
      prompt: selectedStyle?.prompt || '',
    };
  }, [state.creativeSoul.style, state.creativeSoul.customStyle, normalizeWordLimitedValue]);
  const getSelectedStyleVariantMeta = useCallback(() => {
    if (!state.creativeSoul.style || state.creativeSoul.style === 'custom') {
      return { label: '', prompt: '' };
    }
    const selectedVariant = (styleVariantMap[state.creativeSoul.style] || []).find((variant) => variant.id === state.creativeSoul.styleVariant);
    return {
      label: language === 'ar' ? (selectedVariant?.labelAr || '') : (selectedVariant?.labelEn || ''),
      prompt: selectedVariant?.prompt || '',
    };
  }, [language, state.creativeSoul.style, state.creativeSoul.styleVariant]);
  const selectedTopicMeta = getSelectedTopicMeta();
  const selectedCtaLabel = getSelectedCtaLabel();
  const selectedTopicVariantMeta = getSelectedTopicVariantMeta();
  const selectedStyleMeta = getSelectedStyleMeta();
  const selectedStyleVariantMeta = getSelectedStyleVariantMeta();
  const getPersonModeLabel = useCallback((asset: NonNullable<VisualAdsState['assets']>[number]) => {
    if (asset.type !== 'person') return '';
    if (asset.personMode === 'reference') {
      return asset.referenceStyle === 'character'
        ? (language === 'ar' ? 'استخدمه كمرجع ثم حوّله إلى شخصية مصممة.' : 'Use this person as a reference and turn them into a styled character.')
        : (language === 'ar' ? 'استخدمه كمرجع لشخص واقعي قريب من الصورة.' : 'Use this person as a reference for a realistic human subject.') ;
    }
    if (asset.exactPersonStyle === 'same-pose') {
      return language === 'ar'
        ? 'استخدم هذا الشخص الحقيقي نفسه تماماً، وليس نسخة مشابهة أو محسّنة. حافظ على أقرب وضعية وإطار ممكنين للصورة الأصلية. لا تغيّر الوجه أو تعيد تخيّل الملامح أو تستبدله بشخص أجمل أو مختلف. إذا تعارض أي شيء مع الهوية، فحافظ على الشخص أولاً.'
        : 'Use the exact same real individual from the upload, not a similar-looking or upgraded version. Keep the closest possible pose and framing to the original image. Do not reinterpret, beautify, or substitute the face. If anything conflicts with identity, keep the person first.';
    }
    if (asset.exactPersonStyle === 'upper-body') {
      return language === 'ar'
        ? 'استخدم هذا الشخص الحقيقي نفسه تماماً في لقطة واضحة للجزء العلوي من الجسم، بحيث يبقى الوجه كبيراً ومقروءاً وسهل التعرّف عليه. لا تغيّر الملامح ولا تبدّله بشخص آخر. اجعل الإبداع في التكوين والضوء فقط.'
        : 'Use the exact same real individual in a clear upper-body framing so the face stays large, readable, and unmistakable. Do not change the facial identity or swap them for a better-looking substitute. Put the creativity into the composition and lighting only.';
    }
    return language === 'ar'
      ? 'استخدم هذا الشخص الحقيقي نفسه تماماً. حافظ على الوجه، ولون البشرة، وبنية الجسم، والملابس، والهوية العامة. يمكن تعديل الوضعية بحذر فقط إذا بقي الوجه والهوية كما هما. لا تستبدله بشخص آخر، ولا تحسّنه، ولا تعِد تخيّل ملامحه.'
      : 'Use the exact same real individual. Preserve the face, skin tone, body shape, clothing, and overall identity. You may adapt the pose carefully only if the face stays the same. Do not replace, beautify, recast, or drift away from the real person.';
  }, [language]);
  const getScreenshotDeviceLabel = useCallback((device?: NonNullable<VisualAdsState['assets']>[number]['screenshotDevice']) => {
    if (device === 'iphone') return language === 'ar' ? 'آيفون' : 'iPhone';
    if (device === 'samsung') return language === 'ar' ? 'هاتف سامسونج' : 'Samsung phone';
    if (device === 'laptop') return language === 'ar' ? 'لابتوب' : 'Laptop';
    if (device === 'tablet') return language === 'ar' ? 'تابلت' : 'Tablet';
    if (device === 'monitor-tv') return language === 'ar' ? 'شاشة أو تلفاز' : 'Monitor / TV';
    if (device === 'billboard') return language === 'ar' ? 'لوحة إعلانية' : 'Billboard';
    return language === 'ar' ? 'آيفون' : 'iPhone';
  }, [language]);
  const getAssetPromptSummary = useCallback((assetType: NonNullable<VisualAdsState['assets']>[number]['type'], index: number) => {
    if (!assetType) return '';
    if (language === 'ar') {
      if (assetType === 'background') return `الصورة ${index + 1} هي الخلفية الأساسية للمشهد.`;
      if (assetType === 'screenshot') return `الصورة ${index + 1} هي لقطة الشاشة الأساسية وتكون محور البوستر.`;
      if (assetType === 'logo') return `الصورة ${index + 1} هي الشعار ويجب وضعها كعنصر علامة تجارية واضح ونظيف.`;
      if (assetType === 'product') return `الصورة ${index + 1} هي المنتج الرئيسي وتظهر كبطل الإعلان.`;
      if (assetType === 'person') return `الصورة ${index + 1} هي الشخص المراد إظهاره. حافظ على هويته وملامحه بدقة، مع تكييف وضعيته لتناسب المشهد.`;
      if (assetType === 'icon') return `الصورة ${index + 1} تُستخدم كأيقونة داعمة داخل التكوين.`;
      if (assetType === 'prop') return `الصورة ${index + 1} تُستخدم كعنصر مساعد داخل المشهد.`;
      if (assetType === 'mascot') return `الصورة ${index + 1} هي التميمة وتظهر كعنصر بصري بارز.`;
      if (assetType === 'texture') return `الصورة ${index + 1} تُستخدم كملمس أو خامة داخل الخلفية أو العناصر.`;
      if (assetType === 'illustration') return `الصورة ${index + 1} تُستخدم كعنصر رسم توضيحي داخل التصميم.`;
      return `الصورة ${index + 1} تُستخدم داخل التكوين حسب دورها.`;
    }
    if (assetType === 'background') return `Image ${index + 1} is the main scene background.`;
    if (assetType === 'screenshot') return `Image ${index + 1} is the hero screenshot and should be a key focal point.`;
    if (assetType === 'logo') return `Image ${index + 1} is the logo and should appear as a clean brand mark.`;
    if (assetType === 'product') return `Image ${index + 1} is the main product hero.`;
    if (assetType === 'person') return `Image ${index + 1} is the human subject. Preserve their exact face and identity, but adapt their pose naturally to fit the new scene.`;
    if (assetType === 'icon') return `Image ${index + 1} should be used as a supporting icon element.`;
    if (assetType === 'prop') return `Image ${index + 1} should be used as a supporting prop in the scene.`;
    if (assetType === 'mascot') return `Image ${index + 1} is the mascot and should be visually noticeable.`;
    if (assetType === 'texture') return `Image ${index + 1} should be used as a texture layer.`;
    if (assetType === 'illustration') return `Image ${index + 1} should be used as an illustration element in the layout.`;
    return `Image ${index + 1} should be used according to its tagged role.`;
  }, [language]);
  const generationSummary = useMemo(() => {
    const assetLines = (state.assets || [])
      .map((asset, index) => {
        if (!asset.type) return null;
        const tagLabel = assetTypeOptions.find((option) => option.value === asset.type)?.label || asset.type;
        const details: string[] = [];
        if (asset.type === 'person') {
          details.push((asset.personMode || 'exact') === 'exact'
            ? (language === 'ar' ? 'مطابق' : 'Exact')
            : (language === 'ar' ? 'مرجع' : 'Reference'));
          if ((asset.personMode || 'exact') === 'exact') {
            if ((asset.exactPersonStyle || 'same-pose') === 'same-pose') details.push(language === 'ar' ? 'أقرب وضعية' : 'Closest');
            if (asset.exactPersonStyle === 'adapted-pose') details.push(language === 'ar' ? 'وضعية جديدة' : 'New pose');
            if (asset.exactPersonStyle === 'upper-body') details.push(language === 'ar' ? 'علوي' : 'Upper');
          } else if (asset.referenceStyle) {
            details.push(asset.referenceStyle === 'character'
              ? (language === 'ar' ? 'شخصية' : 'Character')
              : (language === 'ar' ? 'واقعي' : 'Realistic'));
          }
        }
        if (asset.type === 'logo') {
          details.push((asset.logoMode || 'transparent') === 'as-is'
            ? (language === 'ar' ? 'كما هو' : 'As-is')
            : (language === 'ar' ? 'شفاف' : 'Transparent'));
        }
        if (asset.type === 'screenshot') {
          details.push(getScreenshotDeviceLabel(asset.screenshotDevice));
        }
        const suffix = details.length ? ` · ${details.join(' · ')}` : '';
        return language === 'ar'
          ? `الصورة ${index + 1}: ${tagLabel}${suffix}`
          : `Image ${index + 1}: ${tagLabel}${suffix}`;
      })
      .filter((line): line is string => Boolean(line));

    const campaignLines = [
      state.campaignDNA.platform
        ? (language === 'ar' ? `المقاس: ${state.campaignDNA.platform}` : `Format: ${state.campaignDNA.platform}`)
        : null,
      selectedTopicMeta.label
        ? (language === 'ar' ? `الرسالة: ${selectedTopicMeta.label}` : `Main message: ${selectedTopicMeta.label}`)
        : null,
      selectedTopicVariantMeta.label
        ? (language === 'ar' ? `تفصيل الرسالة: ${selectedTopicVariantMeta.label}` : `Message detail: ${selectedTopicVariantMeta.label}`)
        : null,
      selectedStyleMeta.label
        ? (language === 'ar' ? `النمط: ${selectedStyleMeta.label}` : `Style: ${selectedStyleMeta.label}`)
        : null,
      selectedStyleVariantMeta.label
        ? (language === 'ar' ? `تفصيل النمط: ${selectedStyleVariantMeta.label}` : `Style detail: ${selectedStyleVariantMeta.label}`)
        : null,
      selectedCtaLabel
        ? (language === 'ar' ? `الدعوة للإجراء: ${selectedCtaLabel}` : `CTA: ${selectedCtaLabel}`)
        : null,
    ].filter((line): line is string => Boolean(line));

    return { assetLines, campaignLines };
  }, [state.assets, state.campaignDNA.platform, assetTypeOptions, language, getScreenshotDeviceLabel, selectedTopicMeta.label, selectedTopicVariantMeta.label, selectedStyleMeta.label, selectedStyleVariantMeta.label, selectedCtaLabel]);
  const customFieldToastShownRef = useRef<Record<'customMainMessage' | 'customCta' | 'customStyle', boolean>>({
    customMainMessage: false,
    customCta: false,
    customStyle: false,
  });
  const handleCustomCreativeSoulChange = useCallback((field: 'customMainMessage' | 'customCta' | 'customStyle', value: string) => {
    if (hasMoreThanThreeWords(value)) {
      if (!customFieldToastShownRef.current[field]) {
        toast.error(language === 'ar' ? 'اكتب من كلمة إلى ٣ كلمات كحد أقصى' : 'Use 1 to 3 words maximum');
        customFieldToastShownRef.current[field] = true;
      }
      return;
    }
    customFieldToastShownRef.current[field] = false;
    updateCreativeSoul({ [field]: value } as Partial<VisualAdsState['creativeSoul']>);
  }, [hasMoreThanThreeWords, language, updateCreativeSoul]);

  // Handle multiple file uploads (up to 6)
  const [uploadedImages, setUploadedImages] = useState<Array<{
    image: string;
    type: 'logo' | 'product' | 'screenshot' | 'person' | 'background' | 'icon' | 'prop' | 'mascot' | 'texture' | 'illustration' | null;
    customType?: string | null;
    customTypeDraft?: string | null;
    personMode?: 'exact' | 'reference' | null;
    exactPersonStyle?: 'same-pose' | 'adapted-pose' | 'upper-body' | null;
    referenceStyle?: 'realistic' | 'character' | null;
    logoMode?: 'as-is' | 'transparent' | null;
    screenshotDevice?: 'iphone' | 'samsung' | 'laptop' | 'tablet' | 'monitor-tv' | 'billboard' | null;
  }>>([]);
  const hasAtLeastOneValidAsset = uploadedImages.some((asset) => Boolean(asset.type));
  const hasIncompleteAssetTags = uploadedImages.some((asset) => !asset.type);
  const canContinueToStep2 = uploadedImages.length > 0 && !hasIncompleteAssetTags;
  const readyAssetIndexes = uploadedImages
    .map((asset, index) => (asset.type ? index : -1))
    .filter((index) => index !== -1);
  const incompleteAssets = uploadedImages
    .map((asset, index) => {
      if (!asset.type) {
        return {
          index,
          message: language === 'ar' ? `الصورة ${index + 1} ما زالت تحتاج اختيار النوع.` : `Image ${index + 1} still needs a tag.`,
        };
      }
      return null;
    })
    .filter((item): item is { index: number; message: string } => Boolean(item));
  const showPartialAssetStatus = readyAssetIndexes.length > 0 && incompleteAssets.length > 0;
  const [showSavedPicker, setShowSavedPicker] = useState(false);

  useEffect(() => {
    setVisibleSlotCount((prev) => {
      const minimumVisible = uploadedImages.length > INITIAL_VISIBLE_SLOTS
        ? uploadedImages.length
        : INITIAL_VISIBLE_SLOTS;
      return Math.min(MAX_ASSET_IMAGES, Math.max(prev, minimumVisible));
    });
  }, [uploadedImages.length, INITIAL_VISIBLE_SLOTS, MAX_ASSET_IMAGES]);

  const handleSavedImageSelect = useCallback((url: string) => {
    if (uploadedImages.length >= MAX_ASSET_IMAGES) {
      toast.error(language === 'ar' ? 'الحد الأقصى 6 صور' : 'Max 6 images allowed');
      return;
    }

    const newImages = [{ image: url, type: null as any, customType: null, customTypeDraft: null, personMode: null, exactPersonStyle: null, referenceStyle: null, logoMode: null, screenshotDevice: null }];
    const allImages = [...uploadedImages, ...newImages].slice(0, MAX_ASSET_IMAGES);
    setUploadedImages(allImages);
    setSelectedAssetIndex(uploadedImages.length);
    setCompletedSteps(prev => {
      const next = new Set(prev);
      next.delete(1);
      return next;
    });
    setActiveStep(1);
    setState(prev => ({
      ...prev,
      brandAsset: {
        image: allImages[uploadedImages.length]?.image || allImages[0]?.image || null,
        type: allImages[uploadedImages.length]?.type || null,
        customType: allImages[uploadedImages.length]?.customType || null,
        customTypeDraft: allImages[uploadedImages.length]?.customTypeDraft || null,
        personMode: allImages[uploadedImages.length]?.personMode || null,
        exactPersonStyle: allImages[uploadedImages.length]?.exactPersonStyle || null,
        referenceStyle: allImages[uploadedImages.length]?.referenceStyle || null,
        logoMode: allImages[uploadedImages.length]?.logoMode || null,
        screenshotDevice: allImages[uploadedImages.length]?.screenshotDevice || null,
      },
      creativeSoul: {
        ...prev.creativeSoul,
      },
      assets: allImages,
    }));
  }, [language, uploadedImages, MAX_ASSET_IMAGES]);
  
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = MAX_ASSET_IMAGES - uploadedImages.length;
    const filesToProcess = files.slice(0, remainingSlots);
    
    if (filesToProcess.length === 0) {
      toast.error(language === 'ar' ? 'الحد الأقصى 6 صور' : 'Max 6 images allowed');
      return;
    }

    const newImages: Array<{ image: string; type: 'logo' | 'product' | 'screenshot' | 'person' | 'background' | 'icon' | 'prop' | 'mascot' | 'texture' | 'illustration' | null; customType?: string | null; customTypeDraft?: string | null; personMode?: 'exact' | 'reference' | null; exactPersonStyle?: 'same-pose' | 'adapted-pose' | 'upper-body' | null; referenceStyle?: 'realistic' | 'character' | null; logoMode?: 'as-is' | 'transparent' | null; screenshotDevice?: 'iphone' | 'samsung' | 'laptop' | 'tablet' | 'monitor-tv' | 'billboard' | null }> = [];
    let processed = 0;
    
    filesToProcess.forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      
      const reader = new FileReader();
      reader.onload = () => {
        newImages.push({ image: reader.result as string, type: null, customType: null, customTypeDraft: null, personMode: null, exactPersonStyle: null, referenceStyle: null, logoMode: null, screenshotDevice: null });
        processed++;
        
        if (processed === filesToProcess.length) {
          const allImages = [...uploadedImages, ...newImages].slice(0, MAX_ASSET_IMAGES);
          setUploadedImages(allImages);
          setSelectedAssetIndex(uploadedImages.length);
          setCompletedSteps(prev => {
            const next = new Set(prev);
            next.delete(1);
            return next;
          });
          setActiveStep(1);
          setState(prev => ({
            ...prev,
            brandAsset: {
              image: allImages[uploadedImages.length]?.image || allImages[0]?.image || null,
              type: allImages[uploadedImages.length]?.type || null,
              customType: allImages[uploadedImages.length]?.customType || null,
              customTypeDraft: allImages[uploadedImages.length]?.customTypeDraft || null,
              personMode: allImages[uploadedImages.length]?.personMode || null,
              exactPersonStyle: allImages[uploadedImages.length]?.exactPersonStyle || null,
              referenceStyle: allImages[uploadedImages.length]?.referenceStyle || null,
              logoMode: allImages[uploadedImages.length]?.logoMode || null,
              screenshotDevice: allImages[uploadedImages.length]?.screenshotDevice || null,
            },
            creativeSoul: {
              ...prev.creativeSoul,
            },
            assets: allImages,
          }));
        }
      };
      reader.readAsDataURL(file);
    });
    
    e.target.value = '';
  }, [language, uploadedImages, MAX_ASSET_IMAGES]);

  const handleAssetTypeSelect = useCallback((index: number, type: 'logo' | 'product' | 'screenshot' | 'person' | 'background' | 'icon' | 'prop' | 'mascot' | 'texture' | 'illustration' | null) => {
    setUploadedImages(prev => {
      const next: typeof prev = prev.map((asset, idx) => (
        idx === index
          ? {
              ...asset,
              type,
              customType: null,
              customTypeDraft: null,
              personMode: type === 'person' ? ((asset.personMode || 'exact') as 'exact' | 'reference') : null,
              exactPersonStyle: type === 'person'
                ? (((asset.personMode || 'exact') === 'exact' ? (asset.exactPersonStyle || 'same-pose') : null) as 'same-pose' | 'adapted-pose' | 'upper-body' | null)
                : null,
              referenceStyle: type === 'person' ? ((asset.referenceStyle || null) as 'realistic' | 'character' | null) : null,
              logoMode: type === 'logo' ? ((asset.logoMode || 'transparent') as 'as-is' | 'transparent') : null,
              screenshotDevice: type === 'screenshot' ? ((asset.screenshotDevice || 'iphone') as 'iphone' | 'samsung' | 'laptop' | 'tablet' | 'monitor-tv' | 'billboard') : null,
            }
          : asset
      ));
      const nextUnassignedIndex = next.findIndex((asset) => !asset.type);
      const currentAsset = next[index] || null;

      setState(prevState => ({
        ...prevState,
        brandAsset: {
          image: currentAsset?.image || next[0]?.image || null,
          type,
          customType: currentAsset?.customType || null,
          customTypeDraft: currentAsset?.customTypeDraft || null,
          personMode: currentAsset?.personMode || null,
          exactPersonStyle: currentAsset?.exactPersonStyle || null,
          referenceStyle: currentAsset?.referenceStyle || null,
          logoMode: currentAsset?.logoMode || null,
          screenshotDevice: currentAsset?.screenshotDevice || null,
        },
        creativeSoul: {
          ...prevState.creativeSoul,
        },
        assets: next,
      }));

      if (nextUnassignedIndex !== -1) {
        setSelectedAssetIndex(nextUnassignedIndex);
        setActiveStep(1);
        setCompletedSteps(prevCompleted => {
          const nextCompleted = new Set(prevCompleted);
          nextCompleted.delete(1);
          return nextCompleted;
        });
      } else {
        setCompletedSteps(prevCompleted => new Set([...prevCompleted, 1]));
        setActiveStep(1);
      }

      return next;
    });
  }, []);

  const handleExactPersonStyleChange = useCallback((index: number, exactPersonStyle: 'same-pose' | 'adapted-pose' | 'upper-body') => {
    setUploadedImages(prev => {
      const next: typeof prev = prev.map((asset, idx) => idx === index ? {
        ...asset,
        personMode: 'exact' as const,
        exactPersonStyle,
        referenceStyle: null,
      } : asset);
      const currentAsset = next[index] || null;
      setState(prevState => ({
        ...prevState,
        brandAsset: {
          image: currentAsset?.image || next[0]?.image || null,
          type: currentAsset?.type || null,
          customType: currentAsset?.customType || null,
          customTypeDraft: currentAsset?.customTypeDraft || null,
          personMode: currentAsset?.personMode || null,
          exactPersonStyle: currentAsset?.exactPersonStyle || null,
          referenceStyle: currentAsset?.referenceStyle || null,
          logoMode: currentAsset?.logoMode || null,
          screenshotDevice: currentAsset?.screenshotDevice || null,
        },
        creativeSoul: {
          ...prevState.creativeSoul,
        },
        assets: next,
      }));
      return next;
    });
  }, []);

  const handleScreenshotDeviceChange = useCallback((index: number, device: 'iphone' | 'samsung' | 'laptop' | 'tablet' | 'monitor-tv' | 'billboard') => {
    setUploadedImages(prev => {
      const next: typeof prev = prev.map((asset, idx) => idx === index ? {
        ...asset,
        screenshotDevice: device,
      } : asset);
      const currentAsset = next[index] || null;
      setState(prevState => ({
        ...prevState,
        brandAsset: {
          image: currentAsset?.image || next[0]?.image || null,
          type: currentAsset?.type || null,
          customType: currentAsset?.customType || null,
          customTypeDraft: currentAsset?.customTypeDraft || null,
          personMode: currentAsset?.personMode || null,
          referenceStyle: currentAsset?.referenceStyle || null,
          logoMode: currentAsset?.logoMode || null,
          screenshotDevice: device,
        },
        creativeSoul: {
          ...prevState.creativeSoul,
        },
        assets: next,
      }));
      return next;
    });
  }, []);

  const handlePersonModeChange = useCallback((index: number, mode: 'exact' | 'reference') => {
    setUploadedImages(prev => {
      const next: typeof prev = prev.map((asset, idx) => idx === index ? {
        ...asset,
        personMode: mode,
        exactPersonStyle: mode === 'exact' ? ((asset.exactPersonStyle || 'same-pose') as 'same-pose' | 'adapted-pose' | 'upper-body') : null,
        referenceStyle: mode === 'reference' ? ((asset.referenceStyle || 'realistic') as 'realistic' | 'character') : null,
      } : asset);
      const currentAsset = next[index] || null;
      setState(prevState => ({
        ...prevState,
        brandAsset: {
          image: currentAsset?.image || next[0]?.image || null,
          type: currentAsset?.type || null,
          customType: currentAsset?.customType || null,
          customTypeDraft: currentAsset?.customTypeDraft || null,
          personMode: currentAsset?.personMode || null,
          exactPersonStyle: currentAsset?.exactPersonStyle || null,
          referenceStyle: currentAsset?.referenceStyle || null,
          logoMode: currentAsset?.logoMode || null,
          screenshotDevice: currentAsset?.screenshotDevice || null,
        },
        creativeSoul: {
          ...prevState.creativeSoul,
        },
        assets: next,
      }));
      return next;
    });
  }, []);

  const handleReferenceStyleChange = useCallback((index: number, style: 'realistic' | 'character') => {
    setUploadedImages(prev => {
      const next: typeof prev = prev.map((asset, idx) => idx === index ? {
        ...asset,
        personMode: 'reference' as const,
        referenceStyle: style,
      } : asset);
      const currentAsset = next[index] || null;
      setState(prevState => ({
        ...prevState,
        brandAsset: {
          image: currentAsset?.image || next[0]?.image || null,
          type: currentAsset?.type || null,
          customType: currentAsset?.customType || null,
          customTypeDraft: currentAsset?.customTypeDraft || null,
          personMode: currentAsset?.personMode || null,
          referenceStyle: currentAsset?.referenceStyle || null,
          logoMode: currentAsset?.logoMode || null,
          screenshotDevice: currentAsset?.screenshotDevice || null,
        },
        creativeSoul: {
          ...prevState.creativeSoul,
        },
        assets: next,
      }));
      return next;
    });
  }, []);

  const handleLogoModeChange = useCallback((index: number, mode: 'as-is' | 'transparent') => {
    setUploadedImages(prev => {
      const next: typeof prev = prev.map((asset, idx) => idx === index ? {
        ...asset,
        logoMode: mode,
      } : asset);
      const currentAsset = next[index] || null;
      setState(prevState => ({
        ...prevState,
        brandAsset: {
          image: currentAsset?.image || next[0]?.image || null,
          type: currentAsset?.type || null,
          customType: currentAsset?.customType || null,
          customTypeDraft: currentAsset?.customTypeDraft || null,
          personMode: currentAsset?.personMode || null,
          referenceStyle: currentAsset?.referenceStyle || null,
          logoMode: mode,
          screenshotDevice: currentAsset?.screenshotDevice || null,
        },
        creativeSoul: {
          ...prevState.creativeSoul,
        },
        assets: next,
      }));
      return next;
    });
  }, []);

  // Handle generate
  const handleGenerate = useCallback(async () => {
    if (!state.brandAsset.image) {
      toast.error(language === 'ar' ? 'الرجاء رفع صورة' : 'Please upload an image');
      setActiveStep(1);
      return;
    }
    if (!state.campaignDNA.platform) {
      toast.error(language === 'ar' ? 'اختر المنصة والمقاس أولاً' : 'Choose the platform and size first');
      setActiveStep(2);
      return;
    }
    if (state.creativeSoul.mainMessage === 'custom' && !normalizeWordLimitedValue(state.creativeSoul.customMainMessage || '')) {
      toast.error(language === 'ar' ? 'اكتب الفكرة المخصصة في القسم الأول' : 'Write your custom ad angle in section 1');
      setActiveStep(3);
      setOpenBriefSection(1);
      return;
    }
    if (state.creativeSoul.cta === 'custom' && !normalizeWordLimitedValue(state.creativeSoul.customCta || '')) {
      toast.error(language === 'ar' ? 'اكتب الدعوة المخصصة لاتخاذ إجراء في القسم الثاني' : 'Write your custom CTA in section 2');
      setActiveStep(3);
      setOpenBriefSection(1);
      return;
    }
    if (state.creativeSoul.style === 'custom' && !normalizeWordLimitedValue(state.creativeSoul.customStyle || '')) {
      toast.error(language === 'ar' ? 'اكتب النمط البصري المخصص في القسم الثالث' : 'Write your custom visual style in section 3');
      setActiveStep(3);
      setOpenBriefSection(1);
      return;
    }
    if (uploadedImages.some((asset) => !asset.type)) {
      toast.error(language === 'ar' ? 'اختر نوع كل صورة قبل الإنشاء' : 'Select a type for each image before generating');
      setActiveStep(1);
      return;
    }
    await onGenerate(state);
  }, [state, onGenerate, language, uploadedImages, normalizeWordLimitedValue]);

  useEffect(() => {
    if (resultUrl) {
      setActiveStep(null);
    }
  }, [resultUrl]);

  const canRevealMoreSlots = visibleSlotCount < MAX_ASSET_IMAGES;
  const visibleEmptySlots = Math.max(0, visibleSlotCount - uploadedImages.length);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 md:px-6">
      {/* Stepper */}
      <div className="space-y-4">
        <StepHeader
          step={1}
          title={language === 'ar' ? 'أصول العلامة' : 'Brand Assets'}
          subtitle={language === 'ar' ? 'ارفع صورة واحدة على الأقل ثم اختر نوعها. يمكنك إضافة حتى 6 صور عند الحاجة.' : 'Upload at least one image, then tag it. You can add up to 6 images when needed.'}
          isActive={activeStep === 1}
          isCompleted={completedSteps.has(1)}
          isGenerating={isGenerating}
          onOpen={() => !isGenerating && setActiveStep(1)}
        />
        <StepContent step={1} activeStep={activeStep}>
          <div className="space-y-4">
            {/* Upload Zone - Smaller with thumbnails */}
            <div className="relative">
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {uploadedImages.map((asset, idx) => {
                    const assetNeedsType = asset.type === null;
                    return (
                      <div
                        key={idx}
                        className={`rounded-xl border p-2 transition-all duration-200 ${
                          assetNeedsType
                            ? 'border-orange-400 ring-2 ring-orange-400/25 shadow-[0_0_0_1px_rgba(251,146,60,0.35)] bg-orange-500/5'
                            : idx === selectedAssetIndex
                              ? 'border-[#060541] dark:border-[#f2f2f2] ring-2 ring-[#060541]/20 dark:ring-[#f2f2f2]/20'
                              : 'border-[#606062]/20 bg-white/20 dark:bg-white/5'
                        }`}
                      >
                        <button
                          onClick={() => {
                            setSelectedAssetIndex(idx);
                            updateState('brandAsset', { image: asset.image, type: asset.type, personMode: asset.personMode || null, exactPersonStyle: asset.exactPersonStyle || null, referenceStyle: asset.referenceStyle || null, logoMode: asset.logoMode || null, screenshotDevice: asset.screenshotDevice || null });
                          }}
                          className="relative aspect-square w-full rounded-xl overflow-hidden bg-black/5 dark:bg-white/5"
                          aria-label={language === 'ar' ? `اختر صورة ${idx + 1}` : `Select image ${idx + 1}`}
                          type="button"
                        >
                          <img
                            src={asset.image}
                            alt={`Asset ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => {
                              const newImages = uploadedImages.filter((_, i) => i !== idx);
                              setUploadedImages(newImages);
                              const nextSelectedIndex = Math.max(0, Math.min(selectedAssetIndex === idx ? idx - 1 : selectedAssetIndex > idx ? selectedAssetIndex - 1 : selectedAssetIndex, newImages.length - 1));
                              setSelectedAssetIndex(nextSelectedIndex < 0 ? 0 : nextSelectedIndex);
                              setState(prev => ({
                                ...prev,
                                brandAsset: {
                                  image: newImages[nextSelectedIndex]?.image || newImages[0]?.image || null,
                                  type: newImages[nextSelectedIndex]?.type || newImages[0]?.type || null,
                                  customType: newImages[nextSelectedIndex]?.customType || newImages[0]?.customType || null,
                                  customTypeDraft: newImages[nextSelectedIndex]?.customTypeDraft || newImages[0]?.customTypeDraft || null,
                                  personMode: newImages[nextSelectedIndex]?.personMode || newImages[0]?.personMode || null,
                                  exactPersonStyle: newImages[nextSelectedIndex]?.exactPersonStyle || newImages[0]?.exactPersonStyle || null,
                                  referenceStyle: newImages[nextSelectedIndex]?.referenceStyle || newImages[0]?.referenceStyle || null,
                                  logoMode: newImages[nextSelectedIndex]?.logoMode || newImages[0]?.logoMode || null,
                                  screenshotDevice: newImages[nextSelectedIndex]?.screenshotDevice || newImages[0]?.screenshotDevice || null,
                                },
                                assets: newImages,
                              }));
                              if (newImages.length === 0) {
                                setCompletedSteps(prev => {
                                  const next = new Set(prev);
                                  next.delete(1);
                                  return next;
                                });
                                setActiveStep(1);
                              } else if (newImages.every((nextAsset) => Boolean(nextAsset.type))) {
                                setCompletedSteps(prev => new Set([...prev, 1]));
                              } else {
                                setCompletedSteps(prev => {
                                  const next = new Set(prev);
                                  next.delete(1);
                                  return next;
                                });
                              }
                            }}
                            aria-label={language === 'ar' ? `إزالة صورة ${idx + 1}` : `Remove image ${idx + 1}`}
                            className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white shadow-lg transition-transform active:scale-90"
                            type="button"
                          >
                            ×
                          </button>
                        </button>
                        <div className="mt-2 space-y-1.5">
                          <label className="block text-[11px] font-semibold text-[#858384]" htmlFor={`asset-type-${idx}`}>
                            {language === 'ar' ? `الصورة ${idx + 1}` : `Image ${idx + 1}`}
                          </label>
                          <p className="text-[11px] font-medium text-foreground/80">
                            {language === 'ar' ? 'هذه الصورة هي:' : 'This image is:'}
                          </p>
                          <select
                            id={`asset-type-${idx}`}
                            value={asset.type || ''}
                            onChange={(e) => handleAssetTypeSelect(idx, (e.target.value || null) as any)}
                            className={`w-full min-w-0 rounded-lg border bg-white/70 px-3 py-2 text-xs text-foreground outline-none transition-all focus:ring-2 dark:bg-white/10 ${
                              assetNeedsType
                                ? 'border-orange-400 ring-2 ring-orange-400/25 shadow-[0_0_0_1px_rgba(251,146,60,0.35)]'
                                : 'border-[#606062]/20 dark:border-[#858384]/30 focus:border-orange-400 focus:ring-orange-400/20'
                            }`}
                          >
                            <option value="">{language === 'ar' ? 'اختر النوع' : 'Choose type'}</option>
                            {assetTypeOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          {asset.type === 'person' && (
                            <div className="mt-1.5 space-y-1">
                              <div className="flex gap-1">
                                {(['exact', 'reference'] as const).map((mode) => (
                                  <button
                                    key={mode}
                                    type="button"
                                    onClick={() => handlePersonModeChange(idx, mode)}
                                    className={`flex-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition-all active:scale-[0.97] ${
                                      (asset.personMode || 'exact') === mode
                                        ? 'bg-orange-400 text-[#060541] border-orange-300'
                                        : 'bg-white/40 dark:bg-white/5 border-[#606062]/20 dark:border-[#858384]/25 text-foreground/70'
                                    }`}
                                  >
                                    {mode === 'exact' ? (language === 'ar' ? 'مطابق' : 'Exact') : (language === 'ar' ? 'مرجع' : 'Reference')}
                                  </button>
                                ))}
                              </div>
                              {(asset.personMode || 'exact') === 'exact' && (
                                <div className="flex gap-1">
                                  {([['same-pose', language === 'ar' ? 'أقرب وضعية' : 'Closest'], ['adapted-pose', language === 'ar' ? 'وضعية جديدة' : 'New pose'], ['upper-body', language === 'ar' ? 'علوي' : 'Upper']] as const).map(([style, label]) => (
                                    <button
                                      key={style}
                                      type="button"
                                      onClick={() => handleExactPersonStyleChange(idx, style as 'same-pose' | 'adapted-pose' | 'upper-body')}
                                      className={`flex-1 rounded-md border px-1 py-1 text-[9px] font-semibold transition-all active:scale-[0.97] ${
                                        (asset.exactPersonStyle || 'same-pose') === style
                                          ? 'bg-amber-400 text-[#060541] border-amber-300'
                                          : 'bg-white/40 dark:bg-white/5 border-[#606062]/20 dark:border-[#858384]/25 text-foreground/60'
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {asset.personMode === 'reference' && (
                                <div className="flex gap-1">
                                  {([['realistic', language === 'ar' ? 'واقعي' : 'Realistic'], ['character', language === 'ar' ? 'شخصية' : 'Character']] as const).map(([style, label]) => (
                                    <button
                                      key={style}
                                      type="button"
                                      onClick={() => handleReferenceStyleChange(idx, style as 'realistic' | 'character')}
                                      className={`flex-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition-all active:scale-[0.97] ${
                                        (asset.referenceStyle || 'realistic') === style
                                          ? 'bg-amber-400 text-[#060541] border-amber-300'
                                          : 'bg-white/40 dark:bg-white/5 border-[#606062]/20 dark:border-[#858384]/25 text-foreground/60'
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {asset.type === 'logo' && (
                            <div className="mt-1.5 flex gap-1">
                              {([['transparent', language === 'ar' ? 'شفاف' : 'Transparent'], ['as-is', language === 'ar' ? 'كما هو' : 'As-is']] as const).map(([mode, label]) => (
                                <button
                                  key={mode}
                                  type="button"
                                  onClick={() => handleLogoModeChange(idx, mode as 'transparent' | 'as-is')}
                                  className={`flex-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition-all active:scale-[0.97] ${
                                    (asset.logoMode || 'transparent') === mode
                                      ? 'bg-orange-400 text-[#060541] border-orange-300'
                                      : 'bg-white/40 dark:bg-white/5 border-[#606062]/20 dark:border-[#858384]/25 text-foreground/70'
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          )}
                          {asset.type === 'screenshot' && (
                            <div className="mt-2 rounded-xl border border-[#606062]/20 bg-white/40 dark:border-[#858384]/20 dark:bg-white/[0.04] overflow-hidden">
                              <div className="px-3 pt-2.5 pb-1.5">
                                <p className="text-[11px] font-semibold text-foreground/90">{language === 'ar' ? 'نوع الجهاز' : 'Device type'}</p>
                              </div>
                              <div className="px-2 pb-2">
                                <select
                                  aria-label={language === 'ar' ? `نوع الجهاز للصورة ${idx + 1}` : `Device type for image ${idx + 1}`}
                                  title={language === 'ar' ? `نوع الجهاز للصورة ${idx + 1}` : `Device type for image ${idx + 1}`}
                                  value={asset.screenshotDevice || 'iphone'}
                                  onChange={(e) => handleScreenshotDeviceChange(idx, e.target.value as 'iphone' | 'samsung' | 'laptop' | 'tablet' | 'monitor-tv' | 'billboard')}
                                  className="w-full min-w-0 rounded-lg border border-[#606062]/20 bg-white/70 px-3 py-2 text-xs text-foreground outline-none transition-all focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 dark:border-[#858384]/30 dark:bg-white/10"
                                >
                                  <option value="iphone">{language === 'ar' ? 'آيفون' : 'iPhone'}</option>
                                  <option value="samsung">{language === 'ar' ? 'هاتف سامسونج' : 'Samsung phone'}</option>
                                  <option value="laptop">{language === 'ar' ? 'لابتوب' : 'Laptop'}</option>
                                  <option value="tablet">{language === 'ar' ? 'تابلت' : 'Tablet'}</option>
                                  <option value="monitor-tv">{language === 'ar' ? 'شاشة أو تلفاز' : 'Monitor / TV'}</option>
                                  <option value="billboard">{language === 'ar' ? 'لوحة إعلانية' : 'Billboard'}</option>
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {Array.from({ length: visibleEmptySlots }).map((_, emptyIndex) => {
                    const idx = uploadedImages.length + emptyIndex;
                    return (
                      <div className="flex flex-col gap-2" key={`empty-slot-${idx}`}>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-square rounded-xl border-2 border-dashed border-[#606062]/40 bg-white/30 transition-all active:scale-95 hover:bg-white/50 dark:border-[#858384]/30 dark:bg-white/5 dark:hover:bg-white/10"
                          type="button"
                        >
                          <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center">
                            <Plus className="h-6 w-6 text-[#858384]" />
                            <span className="text-[10px] text-[#858384]">{language === 'ar' ? `مكان للصورة ${idx + 1}` : `Image slot ${idx + 1}`}</span>
                          </div>
                        </button>
                        <button
                          onClick={() => setShowSavedPicker(true)}
                          className="w-full rounded-lg bg-black/5 py-1.5 text-[10px] font-medium text-[#858384] transition-all hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 flex items-center justify-center gap-1"
                          type="button"
                        >
                          <ImageIcon className="w-3 h-3" />
                          <span>{language === 'ar' ? 'اختر من المحفوظ' : 'Pick from Saved'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
                {canRevealMoreSlots && (
                  <button
                    onClick={() => setVisibleSlotCount(MAX_ASSET_IMAGES)}
                    className="rounded-xl border border-dashed border-orange-400/50 bg-orange-500/10 px-4 py-2.5 text-sm font-medium text-orange-600 transition-all duration-200 hover:bg-orange-500/15 active:scale-95 dark:text-orange-300"
                    type="button"
                  >
                    {language === 'ar' ? 'إضافة المزيد من الصور' : 'Add more images'}
                  </button>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                multiple
                hidden
              />
            </div>

            {showSavedPicker && (
              <SavedImagesPicker
                onSelect={(url) => {
                  if (url) handleSavedImageSelect(url);
                  setShowSavedPicker(false);
                }}
                onClose={() => setShowSavedPicker(false)}
              />
            )}

            {uploadedImages.length > 0 && (
              <div className="space-y-2">
                {uploadedImages.some((asset) => !asset.type) && (
                  <p className="text-[11px] text-[#858384]">
                    {language === 'ar'
                      ? 'صورة واحدة مطلوبة على الأقل، واختر نوع كل صورة مضافة من القائمة. يمكنك إضافة حتى 6 صور.'
                      : 'At least one image is required, and each added image needs its own type from the dropdown. You can add up to 6 images.'}
                  </p>
                )}
                {showPartialAssetStatus && (
                  <div className="rounded-xl border border-orange-400/30 bg-orange-500/10 p-3 space-y-2.5">
                    <div className="space-y-1.5">
                      {readyAssetIndexes.map((index) => (
                        <p key={`ready-${index}`} className="text-[11px] font-medium text-green-700 dark:text-green-300">
                          {language === 'ar' ? `✓ الصورة ${index + 1} جاهزة.` : `✓ Image ${index + 1} is ready.`}
                        </p>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      {incompleteAssets.map((item) => (
                        <p key={`missing-${item.index}`} className="text-[11px] font-medium text-orange-700 dark:text-orange-300">
                          {language === 'ar' ? `◌ ${item.message}` : `◌ ${item.message}`}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                {canContinueToStep2 && (
                  <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 space-y-2">
                    <p className="text-[11px] font-medium text-green-700 dark:text-green-300">
                      {language === 'ar'
                        ? (uploadedImages.length === 1
                            ? 'الصورة المضافة جاهزة الآن. يمكنك المتابعة إلى الخطوة ٢ أو إضافة المزيد من الصور.'
                            : 'جميع الصور المضافة جاهزة الآن. يمكنك المتابعة إلى الخطوة ٢ أو إضافة المزيد من الصور.')
                        : (uploadedImages.length === 1
                            ? 'Your uploaded image is ready. You can continue to Step 2 or add more images.'
                            : 'All uploaded images are ready. You can continue to Step 2 or add more images.')}
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveStep(2)}
                      className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition-all duration-200 active:scale-95"
                    >
                      {language === 'ar' ? 'المتابعة إلى الخطوة ٢' : 'Continue to Step 2'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </StepContent>
      </div>

      {/* Step 2: Platform & Format */}
      <div className="space-y-1">
        <StepHeader
          step={2}
          title={language === 'ar' ? 'اختر تنسيق الإعلان' : 'Choose your format'}
          subtitle={language === 'ar' ? 'اختر الشكل المناسب للمكان الذي سيظهر فيه الإعلان' : 'Pick the shape that matches where this ad will be used'}
          isActive={activeStep === 2}
          isCompleted={completedSteps.has(2)}
          isGenerating={isGenerating}
          onOpen={() => {
            if (isGenerating) return;
            if (!hasAtLeastOneValidAsset) {
              toast.error(language === 'ar' ? 'أضف صورة واحدة صحيحة على الأقل أولاً' : 'Add at least one valid tagged image first');
              setActiveStep(1);
              return;
            }
            if (hasIncompleteAssetTags) {
              toast.error(language === 'ar' ? 'اختر نوع كل صورة أولاً' : 'Choose a type for each uploaded image first');
              setActiveStep(1);
              return;
            }
            setActiveStep(2);
          }}
        />
        <StepContent step={2} activeStep={activeStep}>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {platformOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    updateState('campaignDNA', { platform: opt.value });
                    setCompletedSteps(prev => new Set([...prev, 2]));
                    setActiveStep(3);
                  }}
                  className={`flex flex-col items-start justify-start gap-1.5 rounded-xl border px-2 py-2.5 text-left transition-all duration-200 min-h-[118px] sm:min-h-[120px] sm:px-2.5 sm:py-3 sm:gap-2 ${
                    state.campaignDNA.platform === opt.value
                      ? 'bg-gradient-to-b from-[#1a1d24] to-[#11141b] text-[#f2f2f2] border-2 border-orange-400 ring-2 ring-orange-400/35 shadow-[0_0_0_1px_rgba(251,146,60,0.45),0_10px_28px_rgba(251,146,60,0.18)] scale-[1.02]'
                      : 'bg-white/50 dark:bg-white/5 border-[#606062]/20 dark:border-[#858384]/30 hover:bg-white/70 dark:hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-start gap-1.5 sm:gap-2">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border sm:h-9 sm:w-9 sm:rounded-xl ${
                      state.campaignDNA.platform === opt.value
                        ? 'border-orange-300/60 bg-white/10 text-white'
                        : 'border-[#606062]/20 dark:border-[#858384]/30 bg-white/60 dark:bg-white/5 text-foreground'
                    }`}>
                      <opt.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[11px] font-semibold leading-tight sm:text-[13px]">
                        <span className="sm:hidden">{language === 'ar' ? opt.shortTitleAr : opt.shortTitleEn}</span>
                        <span className="hidden sm:inline">{language === 'ar' ? opt.titleAr : opt.titleEn}</span>
                      </p>
                      <p className={`text-[9px] sm:text-[11px] ${state.campaignDNA.platform === opt.value ? 'text-white/70' : 'text-[#858384]'}`}>
                        {language === 'ar' ? opt.ratioAr : opt.ratioEn}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {opt.platforms.map((platform) => (
                      <span
                        key={platform.name}
                        className={`inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-1 text-[8px] font-medium leading-none sm:px-1.5 sm:text-[9px] ${platform.badgeClass}`}
                      >
                        <platform.icon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        <span className="truncate">{platform.name.replace('Instagram ', '').replace('YouTube ', '')}</span>
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#858384] text-center">
              {language === 'ar' ? 'اختر تنسيقاً واحداً للمتابعة إلى الخطوة التالية' : 'Choose one format to continue to the next step'}
            </p>
          </div>
        </StepContent>
      </div>

      {/* Step 3: Ad Brief */}
      <div className="space-y-1">
        <StepHeader
          step={3}
          title={language === 'ar' ? 'صف البوستر' : 'Describe your poster'}
          subtitle={language === 'ar' ? 'نحن نبني البرومبت من الصور والاختيارات والملاحظات' : 'We build the prompt from your assets, choices, and notes'}
          isActive={activeStep === 3}
          isCompleted={completedSteps.has(3)}
          isGenerating={isGenerating}
          onOpen={() => !isGenerating && setActiveStep(3)}
        />
        <StepContent step={3} activeStep={activeStep}>
          <div className="space-y-2">

            {/* Quick settings */}
            {(() => {
              const selectedTopic = state.creativeSoul.mainMessage === 'custom'
                ? getCustomSelectionLabel(state.creativeSoul.customMainMessage)
                : adTopicChips.find(c => c.id === state.creativeSoul.mainMessage)?.label;
              const selectedTopicVariant = selectedTopicVariantMeta.label;
              const selectedCta = state.creativeSoul.cta === 'custom'
                ? getCustomSelectionLabel(state.creativeSoul.customCta)
                : ctaChips.find(c => c.id === state.creativeSoul.cta)?.label;
              const selectedStyle = state.creativeSoul.style === 'custom'
                ? getCustomSelectionLabel(state.creativeSoul.customStyle)
                : adStyleChips.find(s => s.id === state.creativeSoul.style)?.label;
              const selectedStyleVariant = selectedStyleVariantMeta.label;
              const isOpen = openBriefSection === 1;
              const selectedQuickSettings = [selectedTopic, selectedTopicVariant, selectedCta, selectedStyle, selectedStyleVariant].filter(Boolean);
              return (
                <div className="rounded-xl border border-[#606062]/20 dark:border-[#858384]/20 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenBriefSection(isOpen ? null : 1)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/8 transition-colors"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-foreground block">
                          {language === 'ar' ? '١. الإعدادات السريعة' : '1. Quick settings'}
                        </span>
                        <span className="text-[11px] text-[#858384] block">
                          {language === 'ar' ? 'اختياري - الرسالة الرئيسية، الدعوة لاتخاذ إجراء، والنمط البصري' : 'Optional - main message, call to action, and visual style'}
                        </span>
                      </div>
                      {!isOpen && selectedQuickSettings.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {selectedQuickSettings.slice(0, 2).map((item) => (
                            <span key={item} className="px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 text-[#060541] text-[10px] font-semibold">
                              {item}
                            </span>
                          ))}
                          {selectedQuickSettings.length > 2 && (
                            <span className="px-2 py-0.5 rounded-full bg-white/10 text-white text-[10px] font-semibold">
                              +{selectedQuickSettings.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <span className={`text-[#858384] text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-2 space-y-3">
                      <p className="text-[11px] text-[#858384]">
                        {language === 'ar' ? 'هذه الإعدادات تعطي الذكاء الاصطناعي توجيهاً إضافياً، ويمكنك تجاهلها إذا كان الوصف الأساسي كافياً.' : 'These helpers give the AI extra direction. You can skip them if your main brief already says enough.'}
                      </p>

                      <div className="space-y-3 rounded-xl border border-[#606062]/15 bg-white/20 p-3 dark:border-[#858384]/20 dark:bg-white/[0.03]">
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-semibold text-foreground">{language === 'ar' ? 'الرسالة الرئيسية' : 'Main message'}</p>
                            <p className="text-[11px] text-[#858384]">{language === 'ar' ? 'اختياري - اختر اتجاه الإعلان أو تخطَّ ذلك' : 'Optional - choose the ad direction or skip it'}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {adTopicChips.map((chip) => (
                              <button
                                key={chip.id}
                                onClick={() => {
                                  const newVal = state.creativeSoul.mainMessage === chip.id ? '' : chip.id;
                                  updateCreativeSoul({ mainMessage: newVal, customMainMessage: newVal ? '' : state.creativeSoul.customMainMessage, mainMessageVariant: newVal ? '' : state.creativeSoul.mainMessageVariant });
                                }}
                                type="button"
                                className={`px-2.5 py-2 rounded-lg border text-[11px] font-medium transition-all text-left leading-tight ${
                                  state.creativeSoul.mainMessage === chip.id
                                    ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-[#060541] border-orange-300 shadow-[0_4px_14px_rgba(251,146,60,0.35)]'
                                    : 'bg-white/50 dark:bg-white/5 border-[#606062]/20 dark:border-[#858384]/30 text-foreground hover:bg-white/80 dark:hover:bg-white/10'
                                }`}
                              >
                                {chip.label}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => updateCreativeSoul({ mainMessage: state.creativeSoul.mainMessage === 'custom' ? '' : 'custom', mainMessageVariant: '' })}
                              className={`px-2.5 py-2 rounded-lg border text-[11px] font-medium transition-all text-left leading-tight ${
                                state.creativeSoul.mainMessage === 'custom'
                                  ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-[#060541] border-orange-300 shadow-[0_4px_14px_rgba(251,146,60,0.35)]'
                                  : 'bg-white/50 dark:bg-white/5 border-[#606062]/20 dark:border-[#858384]/30 text-foreground hover:bg-white/80 dark:hover:bg-white/10'
                              }`}
                            >
                              {language === 'ar' ? '✍️ مخصص' : '✍️ Custom'}
                            </button>
                          </div>
                          {!!mainMessageVariantMap[state.creativeSoul.mainMessage]?.length && state.creativeSoul.mainMessage !== 'custom' && (
                            <div className="space-y-1 rounded-xl border border-[#606062]/15 bg-white/30 p-2 dark:border-[#858384]/20 dark:bg-white/[0.03]">
                              <p className="text-[11px] font-medium text-foreground/90">{language === 'ar' ? 'تفصيل الرسالة' : 'Main message detail'}</p>
                              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                                {mainMessageVariantMap[state.creativeSoul.mainMessage].map((variant) => (
                                  <button
                                    key={variant.id}
                                    type="button"
                                    onClick={() => updateCreativeSoul({ mainMessageVariant: state.creativeSoul.mainMessageVariant === variant.id ? '' : variant.id })}
                                    className={`px-2.5 py-2 rounded-lg border text-[10px] font-medium text-left leading-tight transition-all ${
                                      state.creativeSoul.mainMessageVariant === variant.id
                                        ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-[#060541] border-orange-300 shadow-[0_4px_14px_rgba(251,146,60,0.28)]'
                                        : 'bg-white/50 dark:bg-white/5 border-[#606062]/20 dark:border-[#858384]/30 text-foreground hover:bg-white/80 dark:hover:bg-white/10'
                                    }`}
                                  >
                                    {language === 'ar' ? variant.labelAr : variant.labelEn}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {state.creativeSoul.mainMessage === 'custom' && (
                            <div className="space-y-1.5">
                              <input
                                type="text"
                                value={state.creativeSoul.customMainMessage || ''}
                                onChange={(e) => handleCustomCreativeSoulChange('customMainMessage', e.target.value)}
                                placeholder={language === 'ar' ? 'مثال: إطلاق رمضاني' : 'e.g. Summer launch'}
                                className="w-full rounded-xl bg-[#0f131a] border border-[#606062]/20 dark:border-[#858384]/30 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-400/60"
                              />
                              <p className="text-[11px] text-[#858384]">
                                {language === 'ar' ? 'اكتب من كلمة إلى ٣ كلمات كحد أقصى.' : 'Write 1 to 3 words maximum.'}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-semibold text-foreground">{language === 'ar' ? 'الدعوة لاتخاذ إجراء' : 'Call to action'}</p>
                            <p className="text-[11px] text-[#858384]">{language === 'ar' ? 'اختياري - ماذا تريد من المشاهد أن يفعل؟' : 'Optional - what should the viewer do?'}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {ctaChips.map((chip) => (
                              <button
                                key={chip.id}
                                onClick={() => {
                                  const newVal = state.creativeSoul.cta === chip.id ? '' : chip.id;
                                  updateCreativeSoul({ cta: newVal, customCta: newVal ? '' : state.creativeSoul.customCta });
                                }}
                                type="button"
                                className={`px-2.5 py-2 rounded-lg border text-[11px] font-medium transition-all text-left leading-tight ${
                                  state.creativeSoul.cta === chip.id
                                    ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-[#060541] border-orange-300 shadow-[0_4px_14px_rgba(251,146,60,0.35)]'
                                    : 'bg-white/50 dark:bg-white/5 border-[#606062]/20 dark:border-[#858384]/30 text-foreground hover:bg-white/80 dark:hover:bg-white/10'
                                }`}
                              >
                                {chip.label}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => updateCreativeSoul({ cta: state.creativeSoul.cta === 'custom' ? '' : 'custom' })}
                              className={`px-2.5 py-2 rounded-lg border text-[11px] font-medium transition-all text-left leading-tight ${
                                state.creativeSoul.cta === 'custom'
                                  ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-[#060541] border-orange-300 shadow-[0_4px_14px_rgba(251,146,60,0.35)]'
                                  : 'bg-white/50 dark:bg-white/5 border-[#606062]/20 dark:border-[#858384]/30 text-foreground hover:bg-white/80 dark:hover:bg-white/10'
                              }`}
                            >
                              {language === 'ar' ? '✍️ مخصص' : '✍️ Custom'}
                            </button>
                          </div>
                          {state.creativeSoul.cta === 'custom' && (
                            <div className="space-y-1.5">
                              <input
                                type="text"
                                value={state.creativeSoul.customCta || ''}
                                onChange={(e) => handleCustomCreativeSoulChange('customCta', e.target.value)}
                                placeholder={language === 'ar' ? 'مثال: حمّل الآن' : 'e.g. Join today'}
                                className="w-full rounded-xl bg-[#0f131a] border border-[#606062]/20 dark:border-[#858384]/30 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-400/60"
                              />
                              <p className="text-[11px] text-[#858384]">
                                {language === 'ar' ? 'اكتب من كلمة إلى ٣ كلمات كحد أقصى.' : 'Write 1 to 3 words maximum.'}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-semibold text-foreground">{language === 'ar' ? 'النمط البصري' : 'Visual style'}</p>
                            <p className="text-[11px] text-[#858384]">{language === 'ar' ? 'اختياري - اختر مزاجاً بصرياً أو اترك الذكاء الاصطناعي يقرر' : 'Optional - choose a mood or let AI decide'}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {adStyleChips.map((style) => (
                              <button
                                key={style.id}
                                onClick={() => {
                                  const newVal = state.creativeSoul.style === style.id ? '' : style.id;
                                  updateCreativeSoul({ style: newVal, customStyle: newVal ? '' : state.creativeSoul.customStyle, styleVariant: newVal ? '' : state.creativeSoul.styleVariant });
                                }}
                                type="button"
                                className={`px-2.5 py-2 rounded-lg border text-[11px] font-medium text-left leading-tight transition-all ${
                                  state.creativeSoul.style === style.id
                                    ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-[#060541] border-orange-300 shadow-[0_4px_14px_rgba(251,146,60,0.35)]'
                                    : 'bg-white/50 dark:bg-white/5 border-[#606062]/20 dark:border-[#858384]/30 text-foreground hover:bg-white/80 dark:hover:bg-white/10'
                                }`}
                              >
                                {style.label}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => updateCreativeSoul({ style: state.creativeSoul.style === 'custom' ? '' : 'custom', styleVariant: '' })}
                              className={`px-2.5 py-2 rounded-lg border text-[11px] font-medium text-left leading-tight transition-all ${
                                state.creativeSoul.style === 'custom'
                                  ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-[#060541] border-orange-300 shadow-[0_4px_14px_rgba(251,146,60,0.35)]'
                                  : 'bg-white/50 dark:bg-white/5 border-[#606062]/20 dark:border-[#858384]/30 text-foreground hover:bg-white/80 dark:hover:bg-white/10'
                              }`}
                            >
                              {language === 'ar' ? '✍️ مخصص' : '✍️ Custom'}
                            </button>
                          </div>
                          {!!styleVariantMap[state.creativeSoul.style]?.length && state.creativeSoul.style !== 'custom' && (
                            <div className="space-y-1 rounded-xl border border-[#606062]/15 bg-white/30 p-2 dark:border-[#858384]/20 dark:bg-white/[0.03]">
                              <p className="text-[11px] font-medium text-foreground/90">{language === 'ar' ? 'تفصيل النمط' : 'Visual style detail'}</p>
                              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                                {styleVariantMap[state.creativeSoul.style].map((variant) => (
                                  <button
                                    key={variant.id}
                                    type="button"
                                    onClick={() => updateCreativeSoul({ styleVariant: state.creativeSoul.styleVariant === variant.id ? '' : variant.id })}
                                    className={`px-2.5 py-2 rounded-lg border text-[10px] font-medium text-left leading-tight transition-all ${
                                      state.creativeSoul.styleVariant === variant.id
                                        ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-[#060541] border-orange-300 shadow-[0_4px_14px_rgba(251,146,60,0.28)]'
                                        : 'bg-white/50 dark:bg-white/5 border-[#606062]/20 dark:border-[#858384]/30 text-foreground hover:bg-white/80 dark:hover:bg-white/10'
                                    }`}
                                  >
                                    {language === 'ar' ? variant.labelAr : variant.labelEn}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {state.creativeSoul.style === 'custom' && (
                            <div className="space-y-1.5">
                              <input
                                type="text"
                                value={state.creativeSoul.customStyle || ''}
                                onChange={(e) => handleCustomCreativeSoulChange('customStyle', e.target.value)}
                                placeholder={language === 'ar' ? 'مثال: مرح ونظيف' : 'e.g. Bold luxury'}
                                className="w-full rounded-xl bg-[#0f131a] border border-[#606062]/20 dark:border-[#858384]/30 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-400/60"
                              />
                              <p className="text-[11px] text-[#858384]">
                                {language === 'ar' ? 'اكتب من كلمة إلى ٣ كلمات كحد أقصى.' : 'Write 1 to 3 words maximum.'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Main brief */}
            {(() => {
              const isOpen = openBriefSection === 4;
              const hasSummary = generationSummary.assetLines.length > 0 || generationSummary.campaignLines.length > 0;
              return (
                <div className="rounded-xl border border-[#606062]/20 dark:border-[#858384]/20 overflow-visible">
                  <button
                    type="button"
                    onClick={() => setOpenBriefSection(isOpen ? null : 4)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/8 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {language === 'ar' ? '٢. ملخص الإنشاء' : '2. Generation summary'}
                      </span>
                      {hasSummary && !isOpen && (
                        <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 text-[#060541] text-[10px] font-semibold">
                          ✓
                        </span>
                      )}
                    </div>
                    <span className={`text-[#858384] text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                  </button>
                  {isOpen && (
                    <div className="relative z-10 px-4 pb-4 pt-2" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                      <div className="space-y-3">
                        <p className="text-[11px] text-[#858384]">
                          {language === 'ar'
                            ? 'سنستخدم هذا الملخص لبناء برومبت منظم تلقائياً. لا حاجة لكتابة أو تعديل البرومبت يدوياً.'
                            : 'We will use this summary to build a structured prompt automatically. No manual prompt writing is needed.'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[#606062]/15 bg-white/25 p-3 space-y-3 dark:border-[#858384]/20 dark:bg-white/[0.03]">
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold text-foreground/90">{language === 'ar' ? 'الأصول' : 'Assets'}</p>
                          {generationSummary.assetLines.length > 0 ? (
                            <div className="space-y-1.5">
                              {generationSummary.assetLines.map((line) => (
                                <p key={line} className="text-[11px] text-[#858384]">{line}</p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-[#858384]">{language === 'ar' ? 'لم يتم تحديد أصول بعد.' : 'No tagged assets yet.'}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold text-foreground/90">{language === 'ar' ? 'الإعدادات' : 'Settings'}</p>
                          {generationSummary.campaignLines.length > 0 ? (
                            <div className="space-y-1.5">
                              {generationSummary.campaignLines.map((line) => (
                                <p key={line} className="text-[11px] text-[#858384]">{line}</p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-[#858384]">{language === 'ar' ? 'لم يتم اختيار إعدادات إضافية بعد.' : 'No extra settings selected yet.'}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Generate Button */}
            <div className="pt-2">
              {isGenerating ? (
                <div className="space-y-3">
                  <div className="h-12 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center gap-2">
                    <Wand2 className="w-5 h-5 text-orange-500 dark:text-orange-400 animate-pulse" />
                    <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                      {language === 'ar' ? 'جارِ صناعة الإعلان...' : 'Crafting your Ad...'}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#606062]/20 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300 rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-center text-xs text-[#858384]">{progress}%</p>
                </div>
              ) : (
                <button
                  onClick={handleGenerate}
                  className="relative w-full py-4 rounded-xl font-bold text-sm text-white overflow-hidden group active:scale-95 transition-transform duration-200"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-amber-500" />
                  {/* Bloom glow effect */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-orange-500/40 blur-xl" />
                  <div className="absolute inset-0 shadow-[0_0_30px_rgba(249,115,22,0.4)]" />
                  {/* Content */}
                  <span className="relative flex items-center justify-center gap-2">
                    <span>🚀</span>
                    <span>{language === 'ar' ? 'توليد الإعلان البصري' : 'Generate Visual Ad'}</span>
                  </span>
                </button>
              )}
            </div>
          </div>
        </StepContent>
      </div>

      {/* Result Preview — shown below the collapsed steps */}
      {resultUrl && (
        <div className="mt-6 rounded-2xl border border-border/50 bg-card overflow-hidden shadow-xl p-4 space-y-4">
          <img src={resultUrl} alt="Generated Ad" className="w-full rounded-xl object-contain" />
          <div className="flex flex-wrap gap-3 justify-center">
            {onSave && (
              <button
                onClick={onSave}
                className="inline-flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted/80"
              >
                <span>💾</span>
                <span>{language === 'ar' ? 'حفظ' : 'Save'}</span>
              </button>
            )}
            {onDownload && (
              <button
                onClick={onDownload}
                className="inline-flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted/80"
              >
                <span>📥</span>
                <span>{language === 'ar' ? 'تنزيل' : 'Download'}</span>
              </button>
            )}
            {onTryAgain && (
              <button
                onClick={() => { setActiveStep(1); onTryAgain!(); }}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:brightness-110 active:scale-95"
              >
                <span>🔄</span>
                <span>{language === 'ar' ? 'حاول مرة أخرى' : 'Try Again'}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
