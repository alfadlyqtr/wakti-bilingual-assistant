import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import TextGeneratorPopup from '@/components/wakti-ai-v2/TextGeneratorPopup';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';

export default function TextGenerator() {
  const { language } = useTheme();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'compose' | 'reply' | 'generated' | 'diagrams' | 'presentation' | 'translate'>('compose');

  useEffect(() => {
    const tabParam = (searchParams.get('tab') || '').toLowerCase();
    if (tabParam === 'compose' || tabParam === 'reply' || tabParam === 'generated' || tabParam === 'diagrams' || tabParam === 'presentation' || tabParam === 'translate') {
      setActiveTab(tabParam as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  return (
    <div className="w-full h-full">
      <div className="mx-auto w-full max-w-none pt-6 md:pt-8 pb-6 px-3 md:px-6 lg:px-8">
        <div className="text-center mb-3">
          <h1 className="text-2xl font-semibold">
            {language === 'ar' ? 'مولد النص الذكي' : 'Smart Text Generator'}
          </h1>
        </div>

        <div className="mb-3">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 p-1 rounded-2xl border border-border/70 bg-white/60 dark:bg-white/5 shadow-sm" role="tablist" aria-label={language === 'ar' ? 'التبويبات' : 'Tabs'}>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'compose' ? 'true' : 'false'}
              onClick={() => setActiveTab('compose')}
              className={`h-12 rounded-xl border text-sm font-medium transition-all
                ${activeTab === 'compose'
                  ? 'bg-gradient-primary text-primary-foreground shadow-lg border-primary ring-1 ring-primary/60'
                  : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white'}
              `}
            >
              {language === 'ar' ? 'تأليف' : 'Compose'}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'reply' ? 'true' : 'false'}
              onClick={() => setActiveTab('reply')}
              className={`h-12 rounded-xl border text-sm font-medium transition-all
                ${activeTab === 'reply'
                  ? 'bg-gradient-primary text-primary-foreground shadow-lg border-primary ring-1 ring-primary/60'
                  : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white'}
              `}
            >
              {language === 'ar' ? 'رد' : 'Reply'}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'generated' ? 'true' : 'false'}
              onClick={() => setActiveTab('generated')}
              className={`h-12 rounded-xl border text-sm font-medium transition-all
                ${activeTab === 'generated'
                  ? 'bg-muted/90 text-foreground shadow-lg border-muted-foreground/20 ring-1 ring-muted-foreground/20'
                  : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white'}
              `}
            >
              {language === 'ar' ? 'النص المُولد' : 'Generated'}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'diagrams' ? 'true' : 'false'}
              onClick={() => setActiveTab('diagrams')}
              className={`h-12 rounded-xl border text-sm font-medium transition-all
                ${activeTab === 'diagrams'
                  ? 'bg-white text-foreground shadow-lg border-foreground/20 ring-1 ring-foreground/20'
                  : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white'}
              `}
            >
              {language === 'ar' ? 'المخططات' : 'Diagrams'}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'presentation' ? 'true' : 'false'}
              onClick={() => setActiveTab('presentation')}
              className={`h-12 rounded-xl border text-sm font-medium transition-all
                ${activeTab === 'presentation'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg hover:shadow-xl hover:from-indigo-400 hover:to-purple-500'
                  : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white'}
              `}
            >
              {language === 'ar' ? 'العروض' : 'Presentations'}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'translate' ? 'true' : 'false'}
              onClick={() => setActiveTab('translate')}
              className={`h-12 rounded-xl border text-sm font-medium transition-all
                ${activeTab === 'translate'
                  ? 'bg-white text-foreground shadow-lg border-foreground/20 ring-1 ring-foreground/20'
                  : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white'}
              `}
            >
              {language === 'ar' ? 'مترجم النص' : 'Text Translator'}
            </button>
          </div>
        </div>

        <TextGeneratorPopup
          isOpen={true}
          renderAsPage={true}
          initialTab={activeTab}
          onClose={() => { /* no-op (page) */ }}
          onTextGenerated={(text) => {
            if (text) setActiveTab('generated');
          }}
        />
      </div>
    </div>
  );
}
