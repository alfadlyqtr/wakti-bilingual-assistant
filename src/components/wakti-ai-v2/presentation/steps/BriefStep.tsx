import React from 'react';
import { ChevronLeft, ImageIcon, Layout, Loader2 } from 'lucide-react';
import { AUDIENCES, OBJECTIVES, SCENARIOS, THEMES, TONES } from '../config';
import type { Brief, ThemeKey } from '../types';

const selectArrowStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  backgroundSize: '16px',
} as const;

interface BriefStepProps {
  language: 'en' | 'ar';
  brief: Brief | null;
  setBrief: React.Dispatch<React.SetStateAction<Brief | null>>;
  slideCount: number;
  selectedTheme: ThemeKey;
  setSelectedTheme: React.Dispatch<React.SetStateAction<ThemeKey>>;
  onBack: () => void;
  handleGenerateOutline: () => void;
  isLoading: boolean;
}

const BriefStep: React.FC<BriefStepProps> = ({
  language,
  brief,
  setBrief,
  slideCount,
  selectedTheme,
  setSelectedTheme,
  onBack,
  handleGenerateOutline,
  isLoading,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
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

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              🎯 {language === 'ar' ? 'الهدف' : 'Objective'}
            </label>
            <select
              className="w-full border-2 rounded-xl px-4 py-2.5 bg-background cursor-pointer hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
              style={selectArrowStyle}
              value={brief.objective || ''}
              onChange={(e) => setBrief({ ...brief, objective: e.target.value })}
              aria-label={language === 'ar' ? 'الهدف' : 'Objective'}
            >
              <option value="">{language === 'ar' ? 'اختر الهدف' : 'Select objective'}</option>
              {OBJECTIVES.map((o) => (
                <option key={o.key} value={o.key}>{o.label[language]}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              👥 {language === 'ar' ? 'الجمهور' : 'Audience'}
            </label>
            <select
              className="w-full border-2 rounded-xl px-4 py-2.5 bg-background cursor-pointer hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
              style={selectArrowStyle}
              value={brief.audience || ''}
              onChange={(e) => setBrief({ ...brief, audience: e.target.value })}
              aria-label={language === 'ar' ? 'الجمهور' : 'Audience'}
            >
              <option value="">{language === 'ar' ? 'اختر الجمهور' : 'Select audience'}</option>
              {AUDIENCES.map((a) => (
                <option key={a.key} value={a.key}>{a.label[language]}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              📍 {language === 'ar' ? 'السيناريو' : 'Scenario'}
            </label>
            <select
              className="w-full border-2 rounded-xl px-4 py-2.5 bg-background cursor-pointer hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
              style={selectArrowStyle}
              value={brief.scenario || ''}
              onChange={(e) => setBrief({ ...brief, scenario: e.target.value })}
              aria-label={language === 'ar' ? 'السيناريو' : 'Scenario'}
            >
              <option value="">{language === 'ar' ? 'اختر السيناريو' : 'Select scenario'}</option>
              {SCENARIOS.map((s) => (
                <option key={s.key} value={s.key}>{s.label[language]}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              🎭 {language === 'ar' ? 'النبرة' : 'Tone'}
            </label>
            <select
              className="w-full border-2 rounded-xl px-4 py-2.5 bg-background cursor-pointer hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
              style={selectArrowStyle}
              value={brief.tone || ''}
              onChange={(e) => setBrief({ ...brief, tone: e.target.value })}
              aria-label={language === 'ar' ? 'النبرة' : 'Tone'}
            >
              <option value="">{language === 'ar' ? 'اختر النبرة' : 'Select tone'}</option>
              {TONES.map((t) => (
                <option key={t.key} value={t.key}>{t.label[language]}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {language === 'ar' ? 'عدد الشرائح' : 'Number of Slides'}
            </label>
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs bg-background">
              <span className="font-semibold">
                {slideCount} {language === 'ar' ? 'شريحة' : 'slides'}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {language === 'ar' ? 'يمكنك تغيير العدد من الخطوة السابقة' : 'Change this in the previous step'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="text-sm font-medium mb-3 block">
          {language === 'ar' ? 'اختر نمط العرض' : 'Choose Presentation Style'}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {THEMES.map((theme) => (
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
              <div className={`aspect-video rounded-xl bg-gradient-to-br ${theme.bgGradient} p-2 mb-3 overflow-hidden relative`}>
                <div className={`absolute inset-1.5 ${theme.cardBg} rounded-lg ${theme.cardShadow} flex flex-col`}>
                  <div className={`h-2 ${theme.headerBg} rounded-t-lg`} />
                  <div className="flex-1 p-1.5 flex flex-col justify-center gap-1">
                    <div className={`h-1 w-3/4 rounded ${theme.accent}`} />
                    <div className={`h-0.5 w-full rounded ${theme.bulletColor} opacity-40`} />
                    <div className={`h-0.5 w-4/5 rounded ${theme.bulletColor} opacity-30`} />
                    <div className={`h-0.5 w-3/5 rounded ${theme.bulletColor} opacity-20`} />
                  </div>
                </div>
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
};

export default BriefStep;
