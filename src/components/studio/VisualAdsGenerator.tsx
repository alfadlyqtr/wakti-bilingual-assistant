import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Plus, Smartphone, Square, Monitor, Wand2, Globe, Loader2, ArrowLeft, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export interface VisualAdsState {
  brandAsset: {
    image: string | null;
    type: 'logo' | 'product' | 'screenshot' | 'person' | 'other' | null;
    customType?: string | null;
  };
  assets?: {
    image: string;
    type: 'logo' | 'product' | 'screenshot' | 'person' | 'other' | null;
    customType?: string | null;
  }[];
  campaignDNA: {
    platform: '9:16' | '1:1' | '16:9' | null;
    objective: string;
  };
  creativeSoul: {
    mainMessage: string;
    cta: string;
    style: string;
    magicEnhance: boolean;
    prompt: string;
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
const adTopicChips = [
  { id: 'new-launch',    label: '🚀 New Launch',          prompt: 'exciting new product launch' },
  { id: 'limited-offer', label: '⏰ Limited Offer',        prompt: 'limited-time offer, urgency' },
  { id: 'app-download',  label: '📱 App Download',         prompt: 'app download promotion' },
  { id: 'save-time',     label: '⚡ Save Time',            prompt: 'time-saving benefit' },
  { id: 'premium',       label: '✨ Premium Quality',      prompt: 'premium quality and prestige' },
  { id: 'social-proof',  label: '⭐ Customer Love',        prompt: 'social proof and customer trust' },
  { id: 'features',      label: '🎯 Show Features',        prompt: 'product feature showcase' },
  { id: 'sale',          label: '🛍️ Sale / Discount',      prompt: 'sale or discount offer' },
];

// CTA chips
const ctaChips = [
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
const adStyleChips = [
  { id: 'premium-dark',      label: '🌙 Sleek & Dark',       prompt: 'premium dark theme, elegant, high-contrast' },
  { id: 'bright-clean',      label: '☀️ Bright & Clean',     prompt: 'bright clean design, light background, fresh' },
  { id: 'bold-modern',       label: '⚡ Bold & Punchy',       prompt: 'bold modern design, high energy, strong typography' },
  { id: 'lifestyle',         label: '📸 Real & Human',        prompt: 'lifestyle photography feel, authentic and relatable' },
  { id: 'luxury-minimal',    label: '🤍 Luxury Minimal',      prompt: 'luxury minimalist, spacious, refined, premium' },
  { id: 'ugc',               label: '🎥 Natural / UGC',       prompt: 'organic UGC style, native social feed look' },
];

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
    { value: 'other', label: language === 'ar' ? 'أخرى' : 'Other' },
  ] as const;
  
  // State
  const [activeStep, setActiveStep] = useState<number | null>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAssetIndex, setSelectedAssetIndex] = useState(0);
  const [openBriefSection, setOpenBriefSection] = useState<1 | 2 | 3 | 4 | null>(4);
  const [isAmping, setIsAmping] = useState(false);

  const [state, setState] = useState<VisualAdsState>({
    brandAsset: { image: null, type: null },
    campaignDNA: { platform: null, objective: '' },
    creativeSoul: { mainMessage: '', cta: '', style: '', magicEnhance: false, prompt: '' },
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

  // Handle multiple file uploads (up to 3)
  const [uploadedImages, setUploadedImages] = useState<Array<{
    image: string;
    type: 'logo' | 'product' | 'screenshot' | 'person' | 'other' | null;
    customType?: string | null;
  }>>([]);
  const hasAtLeastOneValidAsset = uploadedImages.some((asset) => asset.type !== null && (asset.type !== 'other' || Boolean(asset.customType?.trim())));
  const hasIncompleteAssetTags = uploadedImages.some((asset) => asset.type === null || (asset.type === 'other' && !asset.customType?.trim()));
  
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = 3 - uploadedImages.length;
    const filesToProcess = files.slice(0, remainingSlots);
    
    if (filesToProcess.length === 0) {
      toast.error(language === 'ar' ? 'الحد الأقصى 3 صور' : 'Max 3 images allowed');
      return;
    }

    const newImages: Array<{ image: string; type: 'logo' | 'product' | 'screenshot' | 'person' | 'other' | null; customType?: string | null }> = [];
    let processed = 0;
    
    filesToProcess.forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      
      const reader = new FileReader();
      reader.onload = () => {
        newImages.push({ image: reader.result as string, type: null, customType: null });
        processed++;
        
        if (processed === filesToProcess.length) {
          const allImages = [...uploadedImages, ...newImages].slice(0, 3);
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
            },
            assets: allImages,
          }));
        }
      };
      reader.readAsDataURL(file);
    });
    
    e.target.value = '';
  }, [language, uploadedImages]);

  const handleAssetTypeSelect = useCallback((index: number, type: 'logo' | 'product' | 'screenshot' | 'person' | 'other') => {
    setUploadedImages(prev => {
      const next = prev.map((asset, idx) => (
        idx === index ? { ...asset, type, customType: type === 'other' ? asset.customType || '' : null } : asset
      ));
      const nextUnassignedIndex = next.findIndex((asset) => asset.type === null);
      const nextOtherWithoutLabelIndex = next.findIndex((asset) => asset.type === 'other' && !asset.customType?.trim());
      const currentAsset = next[index] || null;

      setState(prevState => ({
        ...prevState,
        brandAsset: {
          image: currentAsset?.image || next[0]?.image || null,
          type,
          customType: currentAsset?.customType || null,
        },
        assets: next,
      }));

      if (type === 'other' && !currentAsset?.customType?.trim()) {
        setSelectedAssetIndex(index);
        setActiveStep(1);
        setCompletedSteps(prevCompleted => {
          const nextCompleted = new Set(prevCompleted);
          nextCompleted.delete(1);
          return nextCompleted;
        });
      } else if (nextUnassignedIndex !== -1) {
        setSelectedAssetIndex(nextUnassignedIndex);
        setActiveStep(1);
        setCompletedSteps(prevCompleted => {
          const nextCompleted = new Set(prevCompleted);
          nextCompleted.delete(1);
          return nextCompleted;
        });
      } else if (nextOtherWithoutLabelIndex !== -1) {
        setSelectedAssetIndex(nextOtherWithoutLabelIndex);
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

  const handleCustomAssetLabelChange = useCallback((index: number, value: string) => {
    const sanitized = value
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, ' ')
      .trimStart()
      .split(' ')
      .slice(0, 2)
      .join(' ')
      .slice(0, 24);

    setUploadedImages(prev => {
      const next = prev.map((asset, idx) => (
        idx === index ? { ...asset, customType: sanitized } : asset
      ));
      const currentAsset = next[index] || null;

      setState(prevState => ({
        ...prevState,
        brandAsset: {
          image: currentAsset?.image || next[0]?.image || null,
          type: currentAsset?.type || null,
          customType: currentAsset?.customType || null,
        },
        assets: next,
      }));

      const hasUnassignedAssets = next.some((asset) => asset.type === null);
      const hasOtherWithoutLabel = next.some((asset) => asset.type === 'other' && !asset.customType?.trim());

      if (!hasUnassignedAssets && !hasOtherWithoutLabel && next.length > 0) {
        setCompletedSteps(prevCompleted => new Set([...prevCompleted, 1]));
        setActiveStep(1);
      } else {
        setCompletedSteps(prevCompleted => {
          const nextCompleted = new Set(prevCompleted);
          nextCompleted.delete(1);
          return nextCompleted;
        });
        setActiveStep(1);
      }

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
    if (!state.creativeSoul.prompt.trim()) {
      toast.error(language === 'ar' ? 'الرجاء كتابة تفاصيل الإعلان المطلوبة' : 'Please add the required ad details');
      setActiveStep(3);
      setOpenBriefSection(4);
      return;
    }
    if (!state.campaignDNA.platform) {
      toast.error(language === 'ar' ? 'اختر المنصة والمقاس أولاً' : 'Choose the platform and size first');
      setActiveStep(2);
      return;
    }
    if (uploadedImages.some((asset) => asset.type === null)) {
      toast.error(language === 'ar' ? 'اختر نوع كل صورة قبل الإنشاء' : 'Select a type for each image before generating');
      setActiveStep(1);
      return;
    }
    if (uploadedImages.some((asset) => asset.type === 'other' && !asset.customType?.trim())) {
      toast.error(language === 'ar' ? 'عند اختيار أخرى، اكتب وصفاً قصيراً من كلمتين كحد أقصى' : 'When choosing Other, add a short custom label with up to two words');
      setActiveStep(1);
      return;
    }
    await onGenerate(state);
  }, [state, onGenerate, language, uploadedImages]);

  const handleAmp = useCallback(async () => {
    const text = state.creativeSoul.prompt.trim();
    if (!text || isAmping) {
      if (!text) {
        toast.error(language === 'ar' ? 'اكتب فكرة الإعلان أولاً' : 'Write the ad idea first');
      }
      return;
    }

    const selectedTopic = adTopicChips.find((chip) => chip.id === state.creativeSoul.mainMessage);
    const ctaLabel = ctaChips.find((chip) => chip.id === state.creativeSoul.cta)?.label || '';
    const selectedStyle = adStyleChips.find((chip) => chip.id === state.creativeSoul.style);
    const tags = uploadedImages
      .map((asset, index) => {
        if (!asset.type) return null;
        const tagLabel = asset.type === 'other'
          ? (asset.customType?.trim() || 'Other')
          : assetTypeOptions.find((option) => option.value === asset.type)?.label || asset.type;
        return `Image ${index + 1}: ${tagLabel}`;
      })
      .filter((tag): tag is string => Boolean(tag));

    try {
      setIsAmping(true);
      const { data, error } = await supabase.functions.invoke('prompt-amp', {
        body: {
          mode: 'visual-ads',
          text,
          assets_count: uploadedImages.length,
          tag_list: tags,
          topic_label: selectedTopic?.label || '',
          topic_prompt: selectedTopic?.prompt || '',
          cta_text: ctaLabel,
          style_label: selectedStyle?.label || '',
          style_prompt: selectedStyle?.prompt || '',
          platform: state.campaignDNA.platform,
        },
      });

      if (error || !data?.text) {
        console.error('Visual Ads AMP failed:', error || data);
        toast.error(language === 'ar' ? 'فشل تحسين الوصف' : 'Failed to enhance prompt');
        return;
      }

      updateState('creativeSoul', { prompt: String(data.text) });
      toast.success(language === 'ar' ? 'تم تحسين الوصف' : 'Prompt enhanced');
    } catch (err) {
      console.error('Visual Ads AMP exception:', err);
      toast.error(language === 'ar' ? 'فشل تحسين الوصف' : 'Failed to enhance prompt');
    } finally {
      setIsAmping(false);
    }
  }, [state.creativeSoul.prompt, state.creativeSoul.mainMessage, state.creativeSoul.cta, state.creativeSoul.style, uploadedImages, isAmping, language, updateState, assetTypeOptions]);

  // Segmented control component
  const SegmentedControl = <T extends string>({
    options,
    value,
    onChange,
  }: {
    options: { value: T; label: string; emoji: string }[];
    value: T;
    onChange: (val: T) => void;
  }) => (
    <div className="flex rounded-xl bg-white/50 dark:bg-white/5 border border-[#606062]/20 dark:border-[#858384]/30 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-semibold transition-all duration-200 min-h-[44px] ${
            value === opt.value
              ? 'bg-[#060541] text-white dark:bg-[#f2f2f2] dark:text-[#060541] shadow-md'
              : 'text-[#858384] hover:bg-white/50 dark:hover:bg-white/10'
          }`}
        >
          <span>{opt.emoji}</span>
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );

  useEffect(() => {
    if (resultUrl) {
      setActiveStep(null);
    }
  }, [resultUrl]);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 md:px-6">
      {/* Stepper */}
      <div className="space-y-4">
        <StepHeader
          step={1}
          title={language === 'ar' ? 'أصول العلامة' : 'Brand Assets'}
          subtitle={language === 'ar' ? 'ارفع صورة واحدة على الأقل ثم اختر نوعها من القائمة. الصورتان الأخريان اختياريتان.' : 'Upload at least one image, then select its type from the dropdown. The other two images are optional.'}
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
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 3 }).map((_, idx) => {
                    const asset = uploadedImages[idx];

                    if (asset) {
                      return (
                      <div
                        key={idx}
                        className={`rounded-xl border p-2 transition-all duration-200 ${
                          idx === selectedAssetIndex
                            ? 'border-[#060541] dark:border-[#f2f2f2] ring-2 ring-[#060541]/20 dark:ring-[#f2f2f2]/20'
                            : 'border-[#606062]/20 bg-white/20 dark:bg-white/5'
                        }`}
                      >
                        <button
                          onClick={() => {
                            setSelectedAssetIndex(idx);
                            updateState('brandAsset', { image: asset.image, type: asset.type });
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
                              } else if (newImages.every((nextAsset) => nextAsset.type !== null && (nextAsset.type !== 'other' || Boolean(nextAsset.customType?.trim())))) {
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
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs shadow-lg active:scale-90 transition-transform"
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
                            onChange={(e) => handleAssetTypeSelect(idx, e.target.value as 'logo' | 'product' | 'screenshot' | 'person' | 'other')}
                            className={`w-full min-w-0 rounded-lg border bg-white/70 dark:bg-white/10 px-3 py-2 text-xs text-foreground outline-none transition-all focus:ring-2 ${
                              !asset.type
                                ? 'border-orange-400 ring-2 ring-orange-400/25 shadow-[0_0_0_1px_rgba(251,146,60,0.35)]'
                                : 'border-[#606062]/20 dark:border-[#858384]/30 focus:border-orange-400 focus:ring-orange-400/20'
                            }`}
                          >
                            <option value="">{language === 'ar' ? 'اختر النوع' : 'Choose type'}</option>
                            <option value="logo">{language === 'ar' ? 'شعار' : 'Logo'}</option>
                            <option value="product">{language === 'ar' ? 'منتج' : 'Product'}</option>
                            <option value="screenshot">{language === 'ar' ? 'لقطة شاشة' : 'Screenshot'}</option>
                            <option value="person">{language === 'ar' ? 'شخص' : 'Person'}</option>
                            <option value="other">{language === 'ar' ? 'أخرى' : 'Other'}</option>
                          </select>
                          {asset.type === 'other' && (
                            <input
                              value={asset.customType || ''}
                              onChange={(e) => handleCustomAssetLabelChange(idx, e.target.value)}
                              placeholder={language === 'ar' ? 'مثال: عبوة ذهبية' : 'Ex: gold bottle'}
                              maxLength={24}
                              className="w-full rounded-lg border border-[#606062]/20 dark:border-[#858384]/30 bg-white/70 dark:bg-white/10 px-2 py-2 text-xs text-foreground outline-none transition-all focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
                            />
                          )}
                        </div>
                      </div>
                      );
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square rounded-xl border-2 border-dashed border-[#606062]/40 dark:border-[#858384]/30 bg-white/30 dark:bg-white/5 hover:bg-white/50 dark:hover:bg-white/10 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
                        type="button"
                      >
                        <Plus className="w-6 h-6 text-[#858384]" />
                        <span className="text-[10px] text-[#858384]">{language === 'ar' ? 'أضف' : 'Add'}</span>
                      </button>
                    );
                  })}
                </div>
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

            {uploadedImages.length > 0 && (
              <div className="space-y-2">
                {uploadedImages.some((asset) => asset.type === null) && (
                  <p className="text-[11px] text-[#858384]">
                    {language === 'ar'
                      ? 'صورة واحدة مطلوبة على الأقل، واختر نوع كل صورة مضافة من القائمة.'
                      : 'At least one image is required, and each added image needs its own type from the dropdown.'}
                  </p>
                )}
                {uploadedImages.some((asset) => asset.type === 'other') && (
                  <p className="text-[11px] text-[#858384]">
                    {language === 'ar'
                      ? 'إذا اخترت أخرى، اكتب وصفاً قصيراً من كلمتين كحد أقصى.'
                      : 'If you choose Other, add a short custom label with up to two words.'}
                  </p>
                )}
                {hasAtLeastOneValidAsset && (
                  <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 space-y-2">
                    <p className="text-[11px] font-medium text-green-700 dark:text-green-300">
                      {language === 'ar'
                        ? 'الحد الأدنى جاهز. يمكنك المتابعة الآن أو إضافة صورتين إضافيتين اختيارياً.'
                        : 'Minimum requirement complete. You can continue now or add up to 2 more optional images.'}
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
          title={language === 'ar' ? 'ماذا يقول الإعلان؟' : 'Tell us about your ad'}
          subtitle={language === 'ar' ? '١-٣ اختيارية، و٤ مطلوبة' : '1–3 are optional, 4 is required'}
          isActive={activeStep === 3}
          isCompleted={completedSteps.has(3)}
          isGenerating={isGenerating}
          onOpen={() => !isGenerating && setActiveStep(3)}
        />
        <StepContent step={3} activeStep={activeStep}>
          <div className="space-y-2">

            {/* Q1: What's the ad about? */}
            {(() => {
              const selectedTopic = adTopicChips.find(c => c.id === state.creativeSoul.mainMessage);
              const isOpen = openBriefSection === 1;
              return (
                <div className="rounded-xl border border-[#606062]/20 dark:border-[#858384]/20 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenBriefSection(isOpen ? null : 1)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/8 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {language === 'ar' ? '١. عن ماذا يتحدث الإعلان؟' : "1. What's the ad about?"}
                      </span>
                      {selectedTopic && !isOpen && (
                        <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 text-[#060541] text-[10px] font-semibold">
                          {selectedTopic.label}
                        </span>
                      )}
                    </div>
                    <span className={`text-[#858384] text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-2 flex flex-wrap gap-2">
                      {adTopicChips.map((chip) => (
                        <button
                          key={chip.id}
                          onClick={() => {
                            const newVal = state.creativeSoul.mainMessage === chip.id ? '' : chip.id;
                            updateState('creativeSoul', { mainMessage: newVal });
                            setOpenBriefSection(4);
                          }}
                          type="button"
                          className={`px-3 py-2 rounded-xl border text-[12px] font-medium transition-all ${
                            state.creativeSoul.mainMessage === chip.id
                              ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-[#060541] border-orange-300 shadow-[0_4px_14px_rgba(251,146,60,0.35)] scale-[1.03]'
                              : 'bg-white/50 dark:bg-white/5 border-[#606062]/20 dark:border-[#858384]/30 text-foreground hover:bg-white/80 dark:hover:bg-white/10'
                          }`}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Q2: What should people do? */}
            {(() => {
              const selectedCta = ctaChips.find(c => c.id === state.creativeSoul.cta);
              const isOpen = openBriefSection === 2;
              return (
                <div className="rounded-xl border border-[#606062]/20 dark:border-[#858384]/20 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenBriefSection(isOpen ? null : 2)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/8 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {language === 'ar' ? '٢. ماذا تريد أن يفعلوا؟' : '2. What should people do?'}
                      </span>
                      {selectedCta && !isOpen && (
                        <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 text-[#060541] text-[10px] font-semibold">
                          {selectedCta.label}
                        </span>
                      )}
                    </div>
                    <span className={`text-[#858384] text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-2 flex flex-wrap gap-2">
                      {ctaChips.map((chip) => (
                        <button
                          key={chip.id}
                          onClick={() => {
                            const newVal = state.creativeSoul.cta === chip.id ? '' : chip.id;
                            updateState('creativeSoul', { cta: newVal });
                            setOpenBriefSection(4);
                          }}
                          type="button"
                          className={`px-3 py-2 rounded-xl border text-[12px] font-medium transition-all ${
                            state.creativeSoul.cta === chip.id
                              ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-[#060541] border-orange-300 shadow-[0_4px_14px_rgba(251,146,60,0.35)] scale-[1.03]'
                              : 'bg-white/50 dark:bg-white/5 border-[#606062]/20 dark:border-[#858384]/30 text-foreground hover:bg-white/80 dark:hover:bg-white/10'
                          }`}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Q3: Ad look & feel */}
            {(() => {
              const selectedStyle = adStyleChips.find(s => s.id === state.creativeSoul.style);
              const isOpen = openBriefSection === 3;
              return (
                <div className="rounded-xl border border-[#606062]/20 dark:border-[#858384]/20 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenBriefSection(isOpen ? null : 3)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/8 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {language === 'ar' ? '٣. كيف تريد أن يبدو الإعلان؟' : '3. How should the ad look?'}
                      </span>
                      {selectedStyle && !isOpen && (
                        <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 text-[#060541] text-[10px] font-semibold">
                          {selectedStyle.label}
                        </span>
                      )}
                    </div>
                    <span className={`text-[#858384] text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-2 grid grid-cols-2 gap-2">
                      {adStyleChips.map((style) => (
                        <button
                          key={style.id}
                          onClick={() => {
                            const newVal = state.creativeSoul.style === style.id ? '' : style.id;
                            updateState('creativeSoul', { style: newVal });
                            setOpenBriefSection(4);
                          }}
                          type="button"
                          className={`px-3 py-2.5 rounded-xl border text-[12px] font-medium text-left transition-all ${
                            state.creativeSoul.style === style.id
                              ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-[#060541] border-orange-300 shadow-[0_4px_14px_rgba(251,146,60,0.35)] scale-[1.02]'
                              : 'bg-white/50 dark:bg-white/5 border-[#606062]/20 dark:border-[#858384]/30 text-foreground hover:bg-white/80 dark:hover:bg-white/10'
                          }`}
                        >
                          {style.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Q4: Anything specific? (optional freetext) */}
            {(() => {
              const isOpen = openBriefSection === 4;
              const hasText = state.creativeSoul.prompt.trim().length > 0;
              return (
                <div className="rounded-xl border border-[#606062]/20 dark:border-[#858384]/20 overflow-visible">
                  <button
                    type="button"
                    onClick={() => setOpenBriefSection(isOpen ? null : 4)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/8 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {language === 'ar' ? '٤. أي تفاصيل إضافية؟' : '4. Anything specific?'}
                      </span>
                      <span className="text-[10px] font-semibold text-orange-400">
                        {language === 'ar' ? '(مطلوب)' : '(required)'}
                      </span>
                      {hasText && !isOpen && (
                        <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 text-[#060541] text-[10px] font-semibold">
                          ✓
                        </span>
                      )}
                    </div>
                    <span className={`text-[#858384] text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                  </button>
                  {isOpen && (
                    <div className="relative z-10 px-4 pb-4 pt-2" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                      <div className="mb-3 flex justify-end">
                        <button
                          type="button"
                          onClick={handleAmp}
                          disabled={isAmping}
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-2 text-xs font-bold text-white shadow-[0_4px_18px_rgba(249,115,22,0.28)] transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isAmping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                          <span>AMP</span>
                        </button>
                      </div>
                      <textarea
                        value={state.creativeSoul.prompt}
                        onChange={(e) => updateState('creativeSoul', { prompt: e.target.value })}
                        placeholder={language === 'ar'
                          ? 'مثال: ركز على التطبيق، استخدم ألوان العلامة التجارية...'
                          : 'e.g., Focus on the app, use brand colors, add a short caption...'}
                        rows={4}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onFocus={(e) => e.stopPropagation()}
                        autoCorrect="on"
                        autoCapitalize="sentences"
                        spellCheck={true}
                        className="relative z-10 w-full px-4 py-3 rounded-xl bg-[#0f131a] dark:bg-[#0f131a] border border-[#606062]/20 dark:border-[#858384]/30 text-sm text-white resize-none focus:outline-none focus:border-[#060541]/50 dark:focus:border-[#f2f2f2]/50 transition-colors"
                      />
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
