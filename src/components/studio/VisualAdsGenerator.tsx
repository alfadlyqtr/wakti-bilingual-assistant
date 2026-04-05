import React, { useState, useRef, useCallback } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Plus, Smartphone, Square, Monitor, Wand2, Globe, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export interface VisualAdsState {
  brandAsset: {
    image: string | null;
    type: 'logo' | 'product' | 'screenshot' | null;
  };
  assets?: {
    image: string;
    type: 'logo' | 'product' | 'screenshot' | null;
  }[];
  campaignDNA: {
    platform: '9:16' | '1:1' | '16:9';
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
    label: '9:16',
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
        name: 'Instagram',
        icon: InstagramBrandIcon,
        badgeClass: 'bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#515BD4] text-white border border-white/10',
      },
    ],
  },
  {
    value: '1:1' as const,
    icon: Square,
    label: '1:1',
    platforms: [
      {
        name: 'Instagram',
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
    label: '16:9',
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
}: VisualAdsGeneratorProps) {
  const { language } = useTheme();
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAssetIndex, setSelectedAssetIndex] = useState(0);
  const [openBriefSection, setOpenBriefSection] = useState<1 | 2 | 3 | 4 | null>(4);
  const [isAmping, setIsAmping] = useState(false);

  const [state, setState] = useState<VisualAdsState>({
    brandAsset: { image: null, type: null },
    campaignDNA: { platform: '9:16', objective: '' },
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
    type: 'logo' | 'product' | 'screenshot' | null;
  }>>([]);
  
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = 3 - uploadedImages.length;
    const filesToProcess = files.slice(0, remainingSlots);
    
    if (filesToProcess.length === 0) {
      toast.error(language === 'ar' ? 'الحد الأقصى 3 صور' : 'Max 3 images allowed');
      return;
    }

    const newImages: Array<{ image: string; type: 'logo' | 'product' | 'screenshot' | null }> = [];
    let processed = 0;
    
    filesToProcess.forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      
      const reader = new FileReader();
      reader.onload = () => {
        newImages.push({ image: reader.result as string, type: null });
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
            },
            assets: allImages,
          }));
        }
      };
      reader.readAsDataURL(file);
    });
    
    e.target.value = '';
  }, [language, uploadedImages]);

  const handleAssetTypeSelect = useCallback((type: 'logo' | 'product' | 'screenshot') => {
    setUploadedImages(prev => {
      const next = prev.map((asset, idx) => (
        idx === selectedAssetIndex ? { ...asset, type } : asset
      ));
      const nextUnassignedIndex = next.findIndex((asset) => asset.type === null);
      const currentAsset = next[selectedAssetIndex] || null;

      setState(prevState => ({
        ...prevState,
        brandAsset: {
          image: currentAsset?.image || next[0]?.image || null,
          type,
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
        setActiveStep(2);
      }

      return next;
    });
  }, [selectedAssetIndex]);

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
    await onGenerate(state);
  }, [state, onGenerate, language]);

  const handleAmp = useCallback(async () => {
    const text = state.creativeSoul.prompt.trim();
    if (!text || isAmping) {
      if (!text) {
        toast.error(language === 'ar' ? 'اكتب فكرة الإعلان أولاً' : 'Write the ad idea first');
      }
      return;
    }

    const ctaLabel = ctaChips.find((chip) => chip.id === state.creativeSoul.cta)?.label || '';
    const tags = uploadedImages
      .map((asset) => asset.type)
      .filter((tag): tag is 'logo' | 'product' | 'screenshot' => Boolean(tag))
      .map((tag) => tag === 'logo' ? 'Logo' : tag === 'product' ? 'Brand' : 'Screenshot');

    try {
      setIsAmping(true);
      const { data, error } = await supabase.functions.invoke('prompt-amp', {
        body: {
          mode: 'visual-ads',
          text,
          assets_count: uploadedImages.length,
          tag_list: tags,
          cta_text: ctaLabel,
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
  }, [state.creativeSoul.prompt, state.creativeSoul.cta, uploadedImages, isAmping, language, updateState]);

  // Step header component
  const StepHeader = ({ step, title, subtitle }: { step: number; title: string; subtitle: string }) => {
    const isActive = activeStep === step;
    const isCompleted = completedSteps.has(step);
    
    return (
      <button
        onClick={() => !isGenerating && setActiveStep(step as 1 | 2 | 3)}
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
  };

  // Collapsible content wrapper
  const StepContent = ({ step, children }: { step: number; children: React.ReactNode }) => {
    const isActive = activeStep === step;
    return (
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
        isActive ? 'max-h-[1800px] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="pt-3 pb-4 px-2">
          {children}
        </div>
      </div>
    );
  };

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

  return (
    <div className="space-y-4">
      {/* Header - no back button */}
      <div>
        <h1 className="text-xl font-bold text-[#060541] dark:text-[#f2f2f2]">
          {language === 'ar' ? 'إعلانات بصرية' : 'Visual Ads'}
        </h1>
        <p className="text-xs text-[#858384]">
          {language === 'ar' ? '3 خطوات لإعلان مذهل' : '3 steps to stunning ads'}
        </p>
      </div>

      {/* Step 1: Brand Asset */}
      <div className="space-y-1">
        <StepHeader
          step={1}
          title={language === 'ar' ? 'أصول العلامة' : 'Brand Assets'}
          subtitle={language === 'ar' ? 'ما الذي يجب أن يظهر في الإعلان؟' : 'What should appear in the ad?'}
        />
        <StepContent step={1}>
          <div className="space-y-4">
            {/* Upload Zone - Smaller with thumbnails */}
            <div className="relative">
              {uploadedImages.length > 0 ? (
                <div className="space-y-3">
                  {/* Thumbnails grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {uploadedImages.map((asset, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedAssetIndex(idx);
                          updateState('brandAsset', { image: asset.image, type: asset.type });
                        }}
                        className={`relative aspect-square rounded-xl overflow-hidden bg-black/5 dark:bg-white/5 border transition-all duration-200 ${
                          idx === selectedAssetIndex
                            ? 'border-[#060541] dark:border-[#f2f2f2] ring-2 ring-[#060541]/20 dark:ring-[#f2f2f2]/20'
                            : 'border-[#606062]/20'
                        }`}
                        aria-label={language === 'ar' ? `اختر صورة ${idx + 1}` : `Select image ${idx + 1}`}
                        type="button"
                      >
                        <img
                          src={asset.image}
                          alt={`Asset ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {asset.type && (
                          <span className="absolute left-1 bottom-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                            {asset.type === 'logo'
                              ? (language === 'ar' ? 'شعار' : 'Logo')
                              : asset.type === 'product'
                                ? (language === 'ar' ? 'منتج' : 'Product')
                                : (language === 'ar' ? 'لقطة' : 'Screenshot')}
                          </span>
                        )}
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
                            } else if (newImages.every((asset) => asset.type !== null)) {
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
                    ))}
                    {/* Add more button if less than 3 */}
                    {uploadedImages.length < 3 && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square rounded-xl border-2 border-dashed border-[#606062]/40 dark:border-[#858384]/30 bg-white/30 dark:bg-white/5 hover:bg-white/50 dark:hover:bg-white/10 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
                        type="button"
                      >
                        <Plus className="w-6 h-6 text-[#858384]" />
                        <span className="text-[10px] text-[#858384]">{language === 'ar' ? 'أضف' : 'Add'}</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-6 border-2 border-dashed border-[#606062]/40 dark:border-[#858384]/30 rounded-xl flex flex-col items-center justify-center gap-2 bg-white/30 dark:bg-white/5 hover:bg-white/50 dark:hover:bg-white/10 active:scale-[0.98] transition-all duration-200"
                >
                  <div className="w-12 h-12 rounded-full bg-[#060541]/10 dark:bg-[#f2f2f2]/10 flex items-center justify-center">
                    <Plus className="w-6 h-6 text-[#060541] dark:text-[#f2f2f2]" />
                  </div>
                  <span className="text-sm font-medium text-[#858384]">
                    {language === 'ar' ? 'انقر لرفع الصور (حتى 3)' : 'Tap to upload (up to 3)'}
                  </span>
                </button>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                multiple
                hidden
              />
            </div>

            {/* Asset Type Selector - only show if images uploaded */}
            {uploadedImages.length > 0 && uploadedImages[selectedAssetIndex] && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#858384]">
                  {language === 'ar'
                    ? `اختر نوع الصورة ${selectedAssetIndex + 1}`
                    : `Choose what image ${selectedAssetIndex + 1} is`}
                </p>
                <SegmentedControl
                  options={[
                    { value: 'logo' as const, label: language === 'ar' ? 'شعار' : 'Logo', emoji: '🏷️' },
                    { value: 'product' as const, label: language === 'ar' ? 'منتج' : 'Product', emoji: '📦' },
                    { value: 'screenshot' as const, label: language === 'ar' ? 'لقطة' : 'Screenshot', emoji: '📱' },
                  ]}
                  value={(uploadedImages[selectedAssetIndex].type || 'product') as 'logo' | 'product' | 'screenshot'}
                  onChange={handleAssetTypeSelect}
                />
                {uploadedImages.some((asset) => asset.type === null) && (
                  <p className="text-[11px] text-[#858384]">
                    {language === 'ar'
                      ? 'كل صورة تحتاج نوعها الخاص قبل الانتقال للخطوة التالية.'
                      : 'Each image needs its own type before moving to the next step.'}
                  </p>
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
          title={language === 'ar' ? 'أين سيُنشر الإعلان؟' : 'Where will this run?'}
          subtitle={language === 'ar' ? 'اختر المنصة والمقاس المناسب' : 'Pick the platform & size'}
        />
        <StepContent step={2}>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {platformOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    updateState('campaignDNA', { platform: opt.value });
                    setCompletedSteps(prev => new Set([...prev, 2]));
                    setActiveStep(3);
                  }}
                  className={`flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-xl border transition-all duration-200 min-h-[88px] ${
                    state.campaignDNA.platform === opt.value
                      ? 'bg-gradient-to-b from-[#1a1d24] to-[#11141b] text-[#f2f2f2] border-2 border-orange-400 ring-2 ring-orange-400/35 shadow-[0_0_0_1px_rgba(251,146,60,0.45),0_10px_28px_rgba(251,146,60,0.18)] scale-[1.02]'
                      : 'bg-white/50 dark:bg-white/5 border-[#606062]/20 dark:border-[#858384]/30 hover:bg-white/70 dark:hover:bg-white/10'
                  }`}
                >
                  <opt.icon className="w-5 h-5" />
                  <span className="text-xs font-semibold">{opt.label}</span>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {opt.platforms.map((platform) => (
                      <span
                        key={platform.name}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium ${platform.badgeClass}`}
                      >
                        <platform.icon className="w-3.5 h-3.5" />
                        <span>{platform.name}</span>
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#858384] text-center">
              {language === 'ar' ? 'اختر واحدة للانتقال تلقائياً إلى الخطوة التالية' : 'Select one to move to the next step'}
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
        />
        <StepContent step={3}>
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
                <div className="rounded-xl border border-[#606062]/20 dark:border-[#858384]/20 overflow-hidden">
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
                          className="inline-flex items-center gap-2 rounded-xl bg-[#060541] px-3 py-2 text-xs font-semibold text-white shadow-[0_4px_18px_rgba(6,5,65,0.28)] transition-all hover:bg-[#0b0a63] disabled:cursor-not-allowed disabled:opacity-60"
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
                        rows={3}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onFocus={(e) => e.stopPropagation()}
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
                  <div className="h-12 rounded-xl bg-[#060541]/10 border border-[#060541]/30 flex items-center justify-center gap-2">
                    <Wand2 className="w-5 h-5 text-[#060541] dark:text-[#f2f2f2] animate-pulse" />
                    <span className="text-sm font-semibold text-[#060541] dark:text-[#f2f2f2]">
                      {language === 'ar' ? 'جارِ صناعة الإعلان...' : 'Crafting your Ad...'}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#606062]/20 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#060541] via-[#1a1a4a] to-[#060541] transition-all duration-300 rounded-full"
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
                  <div className="absolute inset-0 bg-[#060541]" />
                  {/* Bloom glow effect */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[#060541]/40 blur-xl" />
                  <div className="absolute inset-0 shadow-[0_0_30px_rgba(6,5,65,0.5)]" />
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
    </div>
  );
}
