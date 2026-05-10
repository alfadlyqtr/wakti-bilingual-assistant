import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import TextGeneratorPopup from '@/components/wakti-ai-v2/TextGeneratorPopup';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { useGmailConnection } from '@/hooks/useGmailConnection';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AppleLogo } from '@/components/calendar/AppleLogo';
import { Mail, ChevronDown, CheckCircle2, XCircle } from 'lucide-react';

export default function TextGenerator() {
  const { language } = useTheme();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'compose' | 'reply' | 'generated' | 'diagrams' | 'presentation' | 'translate' | 'a4'>('compose');
  const { initiateGmailAuth, connection: gmailConnection } = useGmailConnection();

  useEffect(() => {
    const tabParam = (searchParams.get('tab') || '').toLowerCase();
    if (tabParam === 'compose' || tabParam === 'reply' || tabParam === 'generated' || tabParam === 'diagrams' || tabParam === 'presentation' || tabParam === 'translate' || tabParam === 'a4') {
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
          <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5 p-1 rounded-2xl border border-border/70 bg-white/60 dark:bg-white/5 shadow-sm" role="tablist" aria-label={language === 'ar' ? 'التبويبات' : 'Tabs'}>
            {[
              { key: 'compose',      labelEn: 'Compose',         labelAr: 'تأليف',         activeClass: 'bg-gradient-primary text-primary-foreground shadow-lg border-primary ring-1 ring-primary/60' },
              { key: 'reply',        labelEn: 'Reply',           labelAr: 'رد',            activeClass: 'bg-gradient-primary text-primary-foreground shadow-lg border-primary ring-1 ring-primary/60' },
              { key: 'a4',           labelEn: 'A4 Document',     labelAr: 'مستند A4',     activeClass: 'bg-gradient-primary text-primary-foreground shadow-lg border-primary ring-1 ring-primary/60' },
              { key: 'diagrams',     labelEn: 'Diagrams',        labelAr: 'المخططات',      activeClass: 'bg-white text-foreground shadow-lg border-foreground/20 ring-1 ring-foreground/20' },
              { key: 'presentation', labelEn: 'Presentations',   labelAr: 'العروض',        activeClass: 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg' },
              { key: 'translate',    labelEn: 'Text Translator',  labelAr: 'مترجم النص',   activeClass: 'bg-white text-foreground shadow-lg border-foreground/20 ring-1 ring-foreground/20' },
              { key: 'generated',    labelEn: 'Generated',       labelAr: 'النص المُولد',  activeClass: 'bg-muted/90 text-foreground shadow-lg border-muted-foreground/20 ring-1 ring-muted-foreground/20' },
            ].map(({ key, labelEn, labelAr, activeClass }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeTab === key ? 'true' : 'false'}
                onClick={() => setActiveTab(key as any)}
                className={`min-h-[42px] md:h-12 px-2.5 md:px-4 py-2 md:py-0 rounded-xl border text-[11px] md:text-sm font-medium transition-all whitespace-normal leading-tight text-center flex items-center justify-center
                  ${activeTab === key
                    ? activeClass
                    : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white dark:hover:bg-white/10'}
                `}
              >
                {language === 'ar' ? labelAr : labelEn}
              </button>
            ))}
            {/* Email dropdown — not a content tab, triggers OAuth */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  role="tab"
                  aria-selected="false"
                  className="min-h-[42px] md:h-12 px-2.5 md:px-4 py-2 md:py-0 rounded-xl border text-[11px] md:text-sm font-medium transition-all whitespace-normal leading-tight text-center flex items-center justify-center gap-1.5 bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white dark:hover:bg-white/10"
                >
                  {/* Top row: label + chevron */}
                  <span className="flex flex-col items-center gap-0.5 w-full">
                    <span className="flex items-center gap-1">
                      <span>{language === 'ar' ? 'بريد' : 'Email'}</span>
                      {gmailConnection.connected && (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      )}
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </span>
                    {/* Bottom row: G + status  |  Apple + status */}
                    <span className="flex items-center gap-2">
                      <span className="flex items-center gap-0.5">
                        <svg viewBox="0 0 24 24" width={12} height={12} aria-hidden="true" fill="none">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        {gmailConnection.loading ? (
                          <span className="h-2.5 w-2.5 rounded-full border border-current border-t-transparent animate-spin" />
                        ) : gmailConnection.connected ? (
                          <CheckCircle2 className="h-2.5 w-2.5 text-green-500" />
                        ) : (
                          <XCircle className="h-2.5 w-2.5 text-red-400" />
                        )}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <AppleLogo size={12} className="opacity-80" />
                        <XCircle className="h-2.5 w-2.5 text-red-400" />
                      </span>
                    </span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="min-w-[12rem]">
                {gmailConnection.connected && gmailConnection.emailAddress && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground border-b mb-1 truncate">
                    {gmailConnection.emailAddress}
                  </div>
                )}
                <DropdownMenuItem
                  onSelect={(e) => { e.preventDefault(); initiateGmailAuth(); }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden="true" fill="none">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>
                    {gmailConnection.connected
                      ? (language === 'ar' ? 'Gmail متصل' : 'Gmail Connected')
                      : (language === 'ar' ? 'ربط Gmail' : 'Connect Gmail')}
                  </span>
                  {gmailConnection.connected && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 ml-auto" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {/* iCloud — coming soon */}}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <AppleLogo size={14} />
                  <span>iCloud</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
