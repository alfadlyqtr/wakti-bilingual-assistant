import React from 'react';
import { cn } from '@/lib/utils';
import { Zap, Sparkles, Layout, Smartphone, Eye, Target, Palette, MinusCircle } from 'lucide-react';

export interface IntentChip {
  id: string;
  label: string;
  labelAr: string;
  icon: React.ReactNode;
  payload: string; // Technical instruction sent to AI
}

// Pre-defined intent chips for different section types
export const HERO_INTENTS: IntentChip[] = [
  { 
    id: 'conversion', 
    label: 'High Conversion', 
    labelAr: 'تحويل عالي',
    icon: <Target className="h-3.5 w-3.5" />,
    payload: 'Build a conversion-focused hero with a bold headline, clear value proposition, prominent CTA button above the fold, and trust indicators. Use high contrast colors for the CTA.'
  },
  { 
    id: 'minimal', 
    label: 'Minimalist', 
    labelAr: 'بسيط',
    icon: <MinusCircle className="h-3.5 w-3.5" />,
    payload: 'Build a clean, minimalist hero with lots of whitespace, simple typography, subtle animations, and a single focused message. Less is more.'
  },
  { 
    id: 'visual', 
    label: 'Visual Story', 
    labelAr: 'قصة بصرية',
    icon: <Eye className="h-3.5 w-3.5" />,
    payload: 'Build a visually-driven hero with a large background image/video, overlay text, and immersive full-screen design. Focus on emotional impact.'
  },
  { 
    id: 'mobile', 
    label: 'Mobile First', 
    labelAr: 'موبايل أولاً',
    icon: <Smartphone className="h-3.5 w-3.5" />,
    payload: 'Build a mobile-optimized hero with thumb-friendly buttons, readable text sizes, fast-loading assets, and touch-friendly interactions.'
  },
];

export const NAV_INTENTS: IntentChip[] = [
  { 
    id: 'sticky', 
    label: 'Sticky Header', 
    labelAr: 'ثابت',
    icon: <Layout className="h-3.5 w-3.5" />,
    payload: 'Build a sticky navigation that stays fixed at the top on scroll, with a subtle shadow and blur effect. Include logo, nav links, and CTA button.'
  },
  { 
    id: 'transparent', 
    label: 'Transparent', 
    labelAr: 'شفاف',
    icon: <Eye className="h-3.5 w-3.5" />,
    payload: 'Build a transparent navigation that overlays the hero, becoming solid on scroll. Use light text on dark backgrounds.'
  },
  { 
    id: 'hamburger', 
    label: 'Mobile Menu', 
    labelAr: 'قائمة موبايل',
    icon: <Smartphone className="h-3.5 w-3.5" />,
    payload: 'Build a responsive navigation with a hamburger menu on mobile that slides in from the side. Full navigation on desktop.'
  },
];

export const TESTIMONIAL_INTENTS: IntentChip[] = [
  { 
    id: 'carousel', 
    label: 'Carousel', 
    labelAr: 'عرض متحرك',
    icon: <Sparkles className="h-3.5 w-3.5" />,
    payload: 'Build a testimonial carousel/slider with auto-play, navigation arrows, and dots. Show one testimonial at a time with smooth transitions.'
  },
  { 
    id: 'grid', 
    label: 'Card Grid', 
    labelAr: 'شبكة بطاقات',
    icon: <Layout className="h-3.5 w-3.5" />,
    payload: 'Build a testimonial grid with cards showing avatar, name, role, and quote. Use a masonry or equal-height grid layout.'
  },
  { 
    id: 'featured', 
    label: 'Featured Quote', 
    labelAr: 'اقتباس مميز',
    icon: <Target className="h-3.5 w-3.5" />,
    payload: 'Build a single featured testimonial with a large quote, prominent avatar, and company logo. High-impact social proof.'
  },
];

export const PRICING_INTENTS: IntentChip[] = [
  { 
    id: 'cards', 
    label: '3-Tier Cards', 
    labelAr: 'بطاقات ثلاثية',
    icon: <Layout className="h-3.5 w-3.5" />,
    payload: 'Build a 3-tier pricing table with cards (Basic, Pro, Enterprise). Highlight the recommended plan. Include feature lists and CTA buttons.'
  },
  { 
    id: 'toggle', 
    label: 'Monthly/Yearly', 
    labelAr: 'شهري/سنوي',
    icon: <Zap className="h-3.5 w-3.5" />,
    payload: 'Build a pricing section with a toggle switch between monthly and yearly billing. Show savings percentage for yearly plans.'
  },
  { 
    id: 'comparison', 
    label: 'Comparison Table', 
    labelAr: 'جدول مقارنة',
    icon: <Target className="h-3.5 w-3.5" />,
    payload: 'Build a detailed feature comparison table with checkmarks showing which features are included in each plan. Sticky header row.'
  },
];

interface IntentChipsProps {
  sectionType: 'hero' | 'nav' | 'testimonial' | 'pricing' | 'custom';
  customChips?: IntentChip[];
  onSelect: (chip: IntentChip) => void;
  onSkip: () => void;
  isRTL?: boolean;
  originalPrompt: string;
}

export function IntentChips({ 
  sectionType, 
  customChips, 
  onSelect, 
  onSkip, 
  isRTL = false,
  originalPrompt 
}: IntentChipsProps) {
  const getChips = (): IntentChip[] => {
    if (customChips) return customChips;
    switch (sectionType) {
      case 'hero': return HERO_INTENTS;
      case 'nav': return NAV_INTENTS;
      case 'testimonial': return TESTIMONIAL_INTENTS;
      case 'pricing': return PRICING_INTENTS;
      default: return [];
    }
  };

  const chips = getChips();
  
  const getSectionTitle = () => {
    switch (sectionType) {
      case 'hero': return isRTL ? 'اختر نمط البطل' : 'Pick a Hero Style';
      case 'nav': return isRTL ? 'اختر نمط التنقل' : 'Pick a Nav Style';
      case 'testimonial': return isRTL ? 'اختر نمط الشهادات' : 'Pick a Testimonial Style';
      case 'pricing': return isRTL ? 'اختر نمط التسعير' : 'Pick a Pricing Style';
      default: return isRTL ? 'اختر نمطاً' : 'Pick a Style';
    }
  };

  return (
    <div 
      className="w-full p-3 rounded-xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-pink-500/10 border border-indigo-500/20"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/20">
            <Palette className="h-4 w-4 text-indigo-500" />
          </div>
          <span className="text-sm font-semibold text-foreground">
            {getSectionTitle()}
          </span>
        </div>
        <button
          onClick={onSkip}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {isRTL ? 'دع الذكاء يقرر' : 'Let AI decide'}
        </button>
      </div>

      {/* Chips */}
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip.id}
            onClick={() => onSelect(chip)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
              "bg-white/80 dark:bg-white/10 border border-border/50",
              "hover:bg-indigo-500/20 hover:border-indigo-500/50 hover:text-indigo-600 dark:hover:text-indigo-400",
              "transition-all duration-200 active:scale-95"
            )}
          >
            {chip.icon}
            <span>{isRTL ? chip.labelAr : chip.label}</span>
          </button>
        ))}
      </div>

      {/* Context hint */}
      <p className="mt-2 text-[10px] text-muted-foreground">
        {isRTL 
          ? 'اختر نمطاً وسيقوم الذكاء ببنائه بشكل فريد لمشروعك'
          : 'Pick a style and AI will build it uniquely for your project'}
      </p>
    </div>
  );
}
