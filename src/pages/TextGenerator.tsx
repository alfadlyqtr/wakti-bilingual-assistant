import React, { useState } from 'react';
import TextGeneratorPopup from '@/components/wakti-ai-v2/TextGeneratorPopup';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';

export default function TextGenerator() {
  const { language } = useTheme();
  const { user } = useAuth();
  const [showPopup, setShowPopup] = useState(false);
  const [initialTab, setInitialTab] = useState<'compose' | 'reply' | 'generated' | 'diagrams' | 'presentation'>('compose');
  
  // Debug
  console.log('TextGenerator render', { showPopup, initialTab });
  
  return (
    <div className="w-full h-full">
      {!showPopup ? (
        <div className="mx-auto max-w-6xl w-[92vw] md:w-[90vw] lg:w-auto pt-6 md:pt-8 pb-6 px-3 md:px-4">
          <div className="text-center mb-3">
            <h1 className="text-2xl font-semibold">
              {language === 'ar' ? 'مولد النص الذكي' : 'Smart Text Generator'}
            </h1>
          </div>
          {/* Top tabs under title (welcome-first flow) */}
          <div className="mb-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-1 rounded-2xl border border-border/70 bg-white/60 dark:bg-white/5 shadow-sm" role="tablist" aria-label={language === 'ar' ? 'التبويبات' : 'Tabs'}>
              <button
                type="button"
                role="tab"
                onClick={() => { setInitialTab('compose'); setShowPopup(true); }}
                className={`h-12 rounded-xl border text-sm font-medium transition-all
                  bg-gradient-primary text-primary-foreground shadow-lg border-primary ring-1 ring-primary/60
                `}
              >
                {language === 'ar' ? 'تأليف' : 'Compose'}
              </button>
              <button
                type="button"
                role="tab"
                onClick={() => { setInitialTab('reply'); setShowPopup(true); }}
                className={`h-12 rounded-xl border text-sm font-medium transition-all
                  bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white
                `}
              >
                {language === 'ar' ? 'رد' : 'Reply'}
              </button>
              <button
                type="button"
                role="tab"
                onClick={() => { setInitialTab('generated'); setShowPopup(true); }}
                className={`h-12 rounded-xl border text-sm font-medium transition-all
                  bg-muted/90 text-foreground shadow-lg border-muted-foreground/20 ring-1 ring-muted-foreground/20
                `}
              >
                {language === 'ar' ? 'النص المُولد' : 'Generated Text'}
              </button>
              <button
                type="button"
                role="tab"
                onClick={() => { setInitialTab('diagrams'); setShowPopup(true); }}
                className={`h-12 rounded-xl border text-sm font-medium transition-all
                  bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white
                `}
              >
                {language === 'ar' ? 'المخططات' : 'Diagrams'}
              </button>
              <button
                type="button"
                role="tab"
                onClick={() => { setInitialTab('presentation'); setShowPopup(true); }}
                className={`h-12 rounded-xl border text-sm font-medium transition-all
                  bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg hover:shadow-xl hover:from-indigo-400 hover:to-purple-500
                `}
              >
                {language === 'ar' ? 'العروض' : 'Presentations'}
              </button>
            </div>
          </div>
          {/* Welcome panel */}
          <div className="rounded-2xl border border-border/60 bg-white/70 dark:bg-white/5 shadow-xl p-5 md:p-6 mb-5">
            <div className="mb-2">
              <h2 className="text-xl font-semibold">
                {language === 'ar'
                  ? `مرحبًا${user?.user_metadata?.full_name ? `، ${user.user_metadata.full_name}` : ''}!`
                  : `Welcome${user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}!`}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {language === 'ar'
                  ? 'اكتب نصوصًا بسرعة بأسلوبك: أنشئ من الصفر، رد بذكاء، أو حسّن نصًا موجودًا.'
                  : 'Write faster in your style: start from scratch, craft a smart reply, or improve existing text.'}
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-3 mt-3">
              <button
                type="button"
                onClick={() => { setInitialTab('compose'); setShowPopup(true); }}
                aria-label={language === 'ar' ? 'افتح تبويب التأليف' : 'Open Compose tab'}
                className="text-left rounded-xl border border-border/50 bg-white/60 dark:bg-white/5 p-4 hover:bg-white/80 dark:hover:bg-white/10 active:scale-[0.99] transition-colors"
              >
                <div className="text-sm font-medium mb-1">
                  {language === 'ar' ? 'تأليف' : 'Compose'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {language === 'ar'
                    ? 'ابدأ بفكرة قصيرة واختر النوع والنبرة والطول.'
                    : 'Start with a short idea and pick type, tone, and length.'}
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setInitialTab('reply'); setShowPopup(true); }}
                aria-label={language === 'ar' ? 'افتح تبويب الرد' : 'Open Reply tab'}
                className="text-left rounded-xl border border-border/50 bg-white/60 dark:bg-white/5 p-4 hover:bg-white/80 dark:hover:bg-white/10 active:scale-[0.99] transition-colors"
              >
                <div className="text-sm font-medium mb-1">
                  {language === 'ar' ? 'رد' : 'Reply'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {language === 'ar'
                    ? 'الصق الرسالة الأصلية وأضف نقاطًا أساسية لرد واضح ومناسب.'
                    : 'Paste the original message and add key points for a clear, fitting reply.'}
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setInitialTab('generated'); setShowPopup(true); }}
                aria-label={language === 'ar' ? 'افتح تبويب النص المُولد' : 'Open Generated Text tab'}
                className="text-left rounded-xl border border-border/50 bg-white/60 dark:bg-white/5 p-4 hover:bg-white/80 dark:hover:bg-white/10 active:scale-[0.99] transition-colors"
              >
                <div className="text-sm font-medium mb-1">
                  {language === 'ar' ? 'النص المُولد' : 'Generated Text'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {language === 'ar'
                    ? 'حسّن نصًا جاهزًا مع الحفاظ على النية والأسلوب.'
                    : 'Improve an existing draft while keeping the intent and style.'}
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setInitialTab('diagrams'); setShowPopup(true); }}
                aria-label={language === 'ar' ? 'افتح تبويب المخططات' : 'Open Diagrams tab'}
                className="text-left rounded-xl border border-border/50 bg-white/60 dark:bg-white/5 p-4 hover:bg-white/80 dark:hover:bg-white/10 active:scale-[0.99] transition-colors"
              >
                <div className="text-sm font-medium mb-1">
                  {language === 'ar' ? 'المخططات' : 'Diagrams'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {language === 'ar'
                    ? 'حوّل أفكارك إلى مخططات احترافية بضغطة واحدة.'
                    : 'Transform your ideas into professional diagrams instantly.'}
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setInitialTab('presentation'); setShowPopup(true); }}
                aria-label={language === 'ar' ? 'افتح تبويب العروض التقديمية' : 'Open Presentations tab'}
                className="text-left rounded-xl border border-border/50 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 p-4 hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-900/40 dark:hover:to-purple-900/40 active:scale-[0.99] transition-colors ring-1 ring-indigo-200/50 dark:ring-indigo-800/30"
              >
                <div className="text-sm font-medium mb-1 text-indigo-700 dark:text-indigo-300">
                  {language === 'ar' ? 'العروض التقديمية' : 'Presentations'}
                </div>
                <div className="text-xs text-indigo-600/70 dark:text-indigo-400/70">
                  {language === 'ar'
                    ? 'أنشئ عروضًا تقديمية احترافية باستخدام الذكاء الاصطناعي.'
                    : 'Create professional AI-powered presentations in minutes.'}
                </div>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <TextGeneratorPopup
          isOpen={true}
          initialTab={initialTab}
          onClose={() => setShowPopup(false)}
          onTextGenerated={() => { /* no-op in standalone page; user can copy */ }}
        />
      )}
    </div>
  );
}
