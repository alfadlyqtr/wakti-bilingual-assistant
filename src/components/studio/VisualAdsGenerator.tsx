import React, { useState, useRef, useCallback } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Plus, Smartphone, Square, Monitor, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

// Types
export interface VisualAdsState {
  brandAsset: {
    image: string | null;
    type: 'logo' | 'product' | 'screenshot';
  };
  campaignDNA: {
    platform: '9:16' | '1:1' | '16:9';
    objective: string;
  };
  creativeSoul: {
    cta: string;
    style: string;
    magicEnhance: boolean;
  };
}

interface VisualAdsGeneratorProps {
  onBack: () => void;
  onGenerate: (state: VisualAdsState) => Promise<void>;
  isGenerating: boolean;
  progress: number;
}

// Style options with emojis
const styleOptions = [
  { id: '3d-glossy', label: '3D Glossy', emoji: '💎' },
  { id: 'cyberpunk', label: 'Cyberpunk', emoji: '🌃' },
  { id: 'soft-pastel', label: 'Soft Pastel', emoji: '🌸' },
  { id: 'vector', label: 'Vector', emoji: '🎯' },
];

// Campaign objectives
const campaignObjectives = [
  { id: 'hype-hook', label: 'The Hype Hook', icon: '🔥' },
  { id: 'minimalist-pro', label: 'Minimalist Pro', icon: '✨' },
  { id: 'lifestyle', label: 'Lifestyle', icon: '☕' },
  { id: 'feature-focus', label: 'Feature Focus', icon: '💡' },
  { id: 'sales-fomo', label: 'Sales/FOMO', icon: '🚨' },
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

  const [state, setState] = useState<VisualAdsState>({
    brandAsset: { image: null, type: 'product' },
    campaignDNA: { platform: '9:16', objective: '' },
    creativeSoul: { cta: '', style: '3d-glossy', magicEnhance: false },
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
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = 3 - uploadedImages.length;
    const filesToProcess = files.slice(0, remainingSlots);
    
    if (filesToProcess.length === 0) {
      toast.error(language === 'ar' ? 'الحد الأقصى 3 صور' : 'Max 3 images allowed');
      return;
    }

    const newImages: string[] = [];
    let processed = 0;
    
    filesToProcess.forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      
      const reader = new FileReader();
      reader.onload = () => {
        newImages.push(reader.result as string);
        processed++;
        
        if (processed === filesToProcess.length) {
          const allImages = [...uploadedImages, ...newImages].slice(0, 3);
          setUploadedImages(allImages);
          updateState('brandAsset', { image: allImages[0] || null });
          
          // Auto-collapse Step 1 if we have images
          if (allImages.length > 0) {
            setCompletedSteps(prev => new Set([...prev, 1]));
            setActiveStep(2);
          }
        }
      };
      reader.readAsDataURL(file);
    });
    
    e.target.value = '';
  }, [language, uploadedImages, updateState]);

  // Handle generate
  const handleGenerate = useCallback(async () => {
    if (!state.brandAsset.image) {
      toast.error(language === 'ar' ? 'الرجاء رفع صورة' : 'Please upload an image');
      setActiveStep(1);
      return;
    }
    if (!state.campaignDNA.objective) {
      toast.error(language === 'ar' ? 'الرجاء اختيار الهدف' : 'Please select an objective');
      setActiveStep(2);
      return;
    }
    await onGenerate(state);
  }, [state, onGenerate, language]);

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
        isActive ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
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
          title={language === 'ar' ? 'أصل العلامة' : 'Brand Asset'}
          subtitle={language === 'ar' ? 'الهوية البصرية' : 'The Identity'}
        />
        <StepContent step={1}>
          <div className="space-y-4">
            {/* Upload Zone - Smaller with thumbnails */}
            <div className="relative">
              {uploadedImages.length > 0 ? (
                <div className="space-y-3">
                  {/* Thumbnails grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {uploadedImages.map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-black/5 dark:bg-white/5 border border-[#606062]/20">
                        <img
                          src={img}
                          alt={`Asset ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => {
                            const newImages = uploadedImages.filter((_, i) => i !== idx);
                            setUploadedImages(newImages);
                            updateState('brandAsset', { image: newImages[0] || null });
                            if (newImages.length === 0) {
                              setCompletedSteps(prev => {
                                const next = new Set(prev);
                                next.delete(1);
                                return next;
                              });
                            }
                          }}
                          aria-label={language === 'ar' ? `إزالة صورة ${idx + 1}` : `Remove image ${idx + 1}`}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs shadow-lg active:scale-90 transition-transform"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {/* Add more button if less than 3 */}
                    {uploadedImages.length < 3 && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square rounded-xl border-2 border-dashed border-[#606062]/40 dark:border-[#858384]/30 bg-white/30 dark:bg-white/5 hover:bg-white/50 dark:hover:bg-white/10 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
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
            {uploadedImages.length > 0 && (
              <SegmentedControl
                options={[
                  { value: 'logo' as const, label: language === 'ar' ? 'شعار' : 'Logo', emoji: '🏷️' },
                  { value: 'product' as const, label: language === 'ar' ? 'منتج' : 'Product', emoji: '📦' },
                  { value: 'screenshot' as const, label: language === 'ar' ? 'لقطة' : 'Screenshot', emoji: '📱' },
                ]}
                value={state.brandAsset.type}
                onChange={(type) => updateState('brandAsset', { type })}
              />
            )}
          </div>
        </StepContent>
      </div>

      {/* Step 2: Campaign DNA */}
      <div className="space-y-1">
        <StepHeader
          step={2}
          title={language === 'ar' ? 'حمض الحملة' : 'Campaign DNA'}
          subtitle={language === 'ar' ? 'الاستراتيجية' : 'The Strategy'}
        />
        <StepContent step={2}>
          <div className="space-y-5">
            {/* Platform Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#858384] uppercase tracking-wider">
                {language === 'ar' ? 'المنصة (نسبة العرض)' : 'Platform (Aspect Ratio)'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: '9:16' as const, icon: Smartphone, label: '9:16' },
                  { value: '1:1' as const, icon: Square, label: '1:1' },
                  { value: '16:9' as const, icon: Monitor, label: '16:9' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateState('campaignDNA', { platform: opt.value })}
                    className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl border transition-all duration-200 min-h-[44px] ${
                      state.campaignDNA.platform === opt.value
                        ? 'bg-[#060541] text-white dark:bg-[#f2f2f2] dark:text-[#060541] border-transparent shadow-md'
                        : 'bg-white/50 dark:bg-white/5 border-[#606062]/20 dark:border-[#858384]/30 hover:bg-white/70 dark:hover:bg-white/10'
                    }`}
                  >
                    <opt.icon className="w-5 h-5" />
                    <span className="text-xs font-semibold">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Objective Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#858384] uppercase tracking-wider">
                {language === 'ar' ? 'الهدف' : 'Objective'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {campaignObjectives.map((obj) => (
                  <button
                    key={obj.id}
                    onClick={() => {
                      updateState('campaignDNA', { objective: obj.id });
                      // Auto-collapse and go to Step 3
                      setCompletedSteps(prev => new Set([...prev, 2]));
                      setActiveStep(3);
                    }}
                    className={`flex items-center gap-2 p-3 rounded-xl border transition-all duration-200 min-h-[44px] ${
                      state.campaignDNA.objective === obj.id
                        ? 'bg-[#060541]/10 dark:bg-[#f2f2f2]/10 border-[#060541]/40 dark:border-[#f2f2f2]/40'
                        : 'bg-white/50 dark:bg-white/5 border-[#606062]/20 dark:border-[#858384]/30 hover:bg-white/70 dark:hover:bg-white/10'
                    }`}
                  >
                    <span className="text-lg">{obj.icon}</span>
                    <span className="text-xs font-medium">{obj.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Confirm Button */}
            <button
              onClick={() => {
                if (!state.campaignDNA.objective) {
                  toast.error(language === 'ar' ? 'الرجاء اختيار الهدف' : 'Please select an objective');
                  return;
                }
                setCompletedSteps(prev => new Set([...prev, 2]));
                setActiveStep(3);
              }}
              className="w-full py-3 rounded-xl bg-[#060541] text-white dark:bg-[#f2f2f2] dark:text-[#060541] font-semibold text-sm shadow-lg active:scale-95 transition-all duration-200"
            >
              {language === 'ar' ? 'تأكيد الاستراتيجية' : 'Confirm Strategy'}
            </button>
          </div>
        </StepContent>
      </div>

      {/* Step 3: Creative Soul */}
      <div className="space-y-1">
        <StepHeader
          step={3}
          title={language === 'ar' ? 'الروح الإبداعية' : 'Creative Soul'}
          subtitle={language === 'ar' ? 'اللمسة الأخيرة' : 'The Final Touch'}
        />
        <StepContent step={3}>
          <div className="space-y-5">
            {/* CTA Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#858384] uppercase tracking-wider">
                {language === 'ar' ? 'دعوة للعمل' : 'Call to Action'}
              </label>
              <input
                type="text"
                value={state.creativeSoul.cta}
                onChange={(e) => updateState('creativeSoul', { cta: e.target.value })}
                placeholder={language === 'ar' ? 'مثال: حمل التطبيق' : 'e.g., Download on App Store'}
                className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-white/5 border border-[#606062]/20 dark:border-[#858384]/30 text-sm focus:outline-none focus:border-[#060541]/50 dark:focus:border-[#f2f2f2]/50 transition-colors"
              />
            </div>

            {/* Style Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#858384] uppercase tracking-wider">
                {language === 'ar' ? 'النمط البصري' : 'Visual Style'}
              </label>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {styleOptions.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => updateState('creativeSoul', { style: style.id })}
                    className={`flex-shrink-0 flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200 min-w-[80px] ${
                      state.creativeSoul.style === style.id
                        ? 'bg-[#060541]/10 dark:bg-[#f2f2f2]/10 border-[#060541]/40 dark:border-[#f2f2f2]/40'
                        : 'bg-white/50 dark:bg-white/5 border-[#606062]/20 dark:border-[#858384]/30 hover:bg-white/70 dark:hover:bg-white/10'
                    }`}
                  >
                    <span className="text-2xl">{style.emoji}</span>
                    <span className="text-[10px] font-medium text-center whitespace-nowrap">{style.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Magic Enhance Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-[#060541]/10 via-[#1a1a4a]/10 to-[#060541]/10 dark:from-[#060541]/5 dark:via-[#1a1a4a]/5 dark:to-[#060541]/5 border border-[#060541]/30 dark:border-[#f2f2f2]/30">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#060541] dark:text-[#f2f2f2]" />
                <span className="text-sm font-medium">
                  {language === 'ar' ? '✨ تحسين سحري' : '✨ Magic Enhance'}
                </span>
              </div>
              <button
                onClick={() => updateState('creativeSoul', { magicEnhance: !state.creativeSoul.magicEnhance })}
                aria-label={state.creativeSoul.magicEnhance ? (language === 'ar' ? 'تعطيل التحسين' : 'Disable enhance') : (language === 'ar' ? 'تفعيل التحسين' : 'Enable enhance')}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                  state.creativeSoul.magicEnhance
                    ? 'bg-gradient-to-r from-[#060541] to-[#1a1a4a]'
                    : 'bg-[#606062]/30'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                    state.creativeSoul.magicEnhance ? 'left-[26px]' : 'left-[2px]'
                  }`}
                />
              </button>
            </div>

            {/* Generate Button */}
            <div className="pt-2">
              {isGenerating ? (
                <div className="space-y-3">
                  <div className="h-12 rounded-xl bg-gradient-to-r from-[#060541]/20 to-[#1a1a4a]/20 border border-[#060541]/30 flex items-center justify-center gap-2">
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
                  {/* Gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#060541] via-[#1a1a4a] to-[#060541]" />
                  {/* Bloom glow effect */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-[#060541]/50 via-[#1a1a4a]/50 to-[#060541]/50 blur-xl" />
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
