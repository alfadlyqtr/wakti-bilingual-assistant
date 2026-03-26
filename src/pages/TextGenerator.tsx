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
      <div className="mx-auto w-full max-w-none pt-4 md:pt-8 pb-6 px-3 md:px-6 lg:px-8">
        <div className="text-center mb-3">
          <h1 className="text-xl md:text-2xl font-semibold">
            {language === 'ar' ? 'مولد النص الذكي' : 'Smart Text Generator'}
          </h1>
        </div>

        <div className="mb-3">
          <div className="flex md:grid md:grid-cols-6 gap-1.5 p-1 rounded-2xl border border-border/70 bg-white/60 dark:bg-white/5 shadow-sm overflow-x-auto scrollbar-none" role="tablist" aria-label={language === 'ar' ? 'التبويبات' : 'Tabs'}>
            {[
              { key: 'compose',      labelEn: 'Compose',         labelAr: 'تأليف',         activeClass: 'bg-gradient-primary text-primary-foreground shadow-lg border-primary ring-1 ring-primary/60' },
              { key: 'reply',        labelEn: 'Reply',           labelAr: 'رد',            activeClass: 'bg-gradient-primary text-primary-foreground shadow-lg border-primary ring-1 ring-primary/60' },
              { key: 'generated',    labelEn: 'Generated',       labelAr: 'النص المُولد',  activeClass: 'bg-muted/90 text-foreground shadow-lg border-muted-foreground/20 ring-1 ring-muted-foreground/20' },
              { key: 'diagrams',     labelEn: 'Diagrams',        labelAr: 'المخططات',      activeClass: 'bg-white text-foreground shadow-lg border-foreground/20 ring-1 ring-foreground/20' },
              { key: 'presentation', labelEn: 'Presentations',   labelAr: 'العروض',        activeClass: 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg' },
              { key: 'translate',    labelEn: 'Text Translator',  labelAr: 'مترجم النص',   activeClass: 'bg-white text-foreground shadow-lg border-foreground/20 ring-1 ring-foreground/20' },
            ].map(({ key, labelEn, labelAr, activeClass }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeTab === key}
                onClick={() => setActiveTab(key as any)}
                className={`flex-shrink-0 h-10 md:h-12 px-3 md:px-4 rounded-xl border text-xs md:text-sm font-medium transition-all whitespace-nowrap
                  ${activeTab === key
                    ? activeClass
                    : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white dark:hover:bg-white/10'}
                `}
              >
                {language === 'ar' ? labelAr : labelEn}
              </button>
            ))}
          </div>
        </div>

        <TextGeneratorPopup
          isOpen={true}
          renderAsPage={true}
          initialTab={activeTab}
          onClose={() => { /* no-op (page) */ }}
          onTabChange={(tab) => setActiveTab(tab as any)}
          onTextGenerated={(text) => {
            if (text) setActiveTab('generated');
          }}
        />
      </div>
    </div>
  );
}
