import React from 'react';
import { FileQuestion, Globe, Image as ImageLucide, Lightbulb, Loader2, Presentation, Sparkles, Type, Wand2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { INPUT_MODES } from '../config';
import type { InputMode, InputModeFlags } from '../types';

type ResearchModeType = 'global' | 'per_slide';

interface TopicStepProps {
  language: 'en' | 'ar';
  presentationName: string;
  setPresentationName: React.Dispatch<React.SetStateAction<string>>;
  topic: string;
  setTopic: React.Dispatch<React.SetStateAction<string>>;
  presentationLanguage: 'en' | 'ar';
  setPresentationLanguage: React.Dispatch<React.SetStateAction<'en' | 'ar'>>;
  inputMode: InputMode;
  setInputMode: React.Dispatch<React.SetStateAction<InputMode>>;
  researchMode: boolean;
  setResearchMode: React.Dispatch<React.SetStateAction<boolean>>;
  researchModeType: ResearchModeType;
  setResearchModeType: React.Dispatch<React.SetStateAction<ResearchModeType>>;
  aiGenerateImagesByMode: InputModeFlags;
  setAiGenerateImagesByMode: React.Dispatch<React.SetStateAction<InputModeFlags>>;
  slideCount: number;
  setSlideCount: React.Dispatch<React.SetStateAction<number>>;
  handleGenerateBrief: () => void;
  isLoading: boolean;
}

const TopicStep: React.FC<TopicStepProps> = ({
  language,
  presentationName,
  setPresentationName,
  topic,
  setTopic,
  presentationLanguage,
  setPresentationLanguage,
  inputMode,
  setInputMode,
  researchMode,
  setResearchMode,
  researchModeType,
  setResearchModeType,
  aiGenerateImagesByMode,
  setAiGenerateImagesByMode,
  slideCount,
  setSlideCount,
  handleGenerateBrief,
  isLoading,
}) => {
  return (
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
            : "Describe your topic and we'll create a professional presentation for you"}
        </p>
      </div>

      <div className="space-y-4 mt-2">
        <div>
          <label className="text-sm font-medium mb-2 block">
            {language === 'ar' ? 'اسم العرض التقديمي' : 'Presentation Name'}
          </label>
          <input
            type="text"
            className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            placeholder={language === 'ar' ? 'مثال: عرض تطبيق الإنتاجية' : 'e.g., Productivity App Pitch'}
            value={presentationName}
            onChange={(e) => setPresentationName(e.target.value)}
          />
        </div>

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

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <label className="text-sm font-semibold">
              {language === 'ar' ? 'لغة العرض التقديمي' : 'Presentation Language'}
            </label>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPresentationLanguage('en')}
              className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                presentationLanguage === 'en'
                  ? 'border-primary bg-primary/10 text-primary shadow-colored'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/40'
              }`}
            >
              🇬🇧 English
            </button>
            <button
              type="button"
              onClick={() => setPresentationLanguage('ar')}
              className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                presentationLanguage === 'ar'
                  ? 'border-primary bg-primary/10 text-primary shadow-colored'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/40'
              }`}
            >
              🇸🇦 العربية
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {language === 'ar'
              ? 'اختر اللغة التي سيتم إنشاء محتوى العرض التقديمي بها'
              : 'Choose the language for your presentation content'}
          </p>
        </div>

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
              const isModeActive = isSelected;
              const ModeIcon = mode.key === 'verbatim' ? Type : mode.key === 'polish' ? Wand2 : mode.key === 'topic_only' ? Lightbulb : FileQuestion;

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

                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${
                      isSelected ? 'bg-primary/15 text-primary shadow-soft' : 'bg-muted/70 text-muted-foreground'
                    }`}>
                      <ModeIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-semibold text-sm ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                        {mode.label[language]}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {mode.description[language]}
                      </p>
                    </div>
                    <span
                      className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold border shadow-sm ${
                        isSelected
                          ? 'border-primary/60 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent text-primary'
                          : 'border-border/60 bg-muted/50 text-muted-foreground'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-primary' : 'bg-muted-foreground/60'}`} />
                      {isSelected ? (language === 'ar' ? 'محدد' : 'Selected') : (language === 'ar' ? 'اختر' : 'Select')}
                    </span>
                  </div>

                  <div className={`border-t my-3 ${isSelected ? 'border-primary/15' : 'border-border/40'}`} />

                  <div
                    className={`flex items-center justify-between gap-2 p-2.5 rounded-xl transition-colors border ${
                      isSelected
                        ? 'bg-background/60 border-primary/15 hover:bg-background/75'
                        : 'bg-muted/40 border-border/40'
                    } ${isModeActive ? '' : 'opacity-60 cursor-not-allowed'}`}
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
                      disabled={!isModeActive}
                      onCheckedChange={() => {
                        if (!isModeActive) return;
                        setAiGenerateImagesByMode((prev) => ({
                          ...prev,
                          [mode.key]: !prev[mode.key],
                        }));
                      }}
                      className="scale-75"
                    />
                  </div>

                  {mode.key === 'topic_only' && (
                    <div
                      className={`mt-2 flex items-center justify-between gap-2 p-2.5 rounded-xl transition-colors border ${
                        isSelected
                          ? 'bg-background/60 border-primary/15 hover:bg-background/75'
                          : 'bg-muted/40 border-border/40'
                      } ${isModeActive ? '' : 'opacity-60 cursor-not-allowed'}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2">
                        <Globe className={`w-3.5 h-3.5 ${researchMode ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-xs font-medium">
                          {language === 'ar' ? 'بحث الويب' : 'Web Research'}
                        </span>
                      </div>
                      <Switch
                        checked={researchMode}
                        disabled={!isModeActive}
                        onCheckedChange={(checked) => {
                          if (!isModeActive) return;
                          setResearchMode(checked);
                          if (!checked) setResearchModeType('global');
                        }}
                        className="scale-75"
                      />
                    </div>
                  )}

                  {mode.key === 'topic_only' && researchMode && (
                    <div className={`mt-2 p-2.5 rounded-xl bg-gradient-to-br from-primary/10 via-background/70 to-background border border-primary/20 shadow-soft ${isModeActive ? '' : 'opacity-60 pointer-events-none'}`}>
                      <div className="flex items-center gap-3 text-xs">
                        <label className="flex items-center gap-1.5 cursor-pointer" onClick={(e) => e.stopPropagation()}>
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
                        <label className="flex items-center gap-1.5 cursor-pointer" onClick={(e) => e.stopPropagation()}>
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
                          {language === 'ar' ? 'سيتم إنشاء الغلاف والشريحة التالية وشكراً فقط' : 'Only Cover + next slide + Thank You generated'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

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
};

export default TopicStep;
