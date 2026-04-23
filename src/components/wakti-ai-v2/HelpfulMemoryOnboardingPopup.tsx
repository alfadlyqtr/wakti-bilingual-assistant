import React from 'react';
import { Brain, Sparkles, Lock, Eye, Zap } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';

interface HelpfulMemoryOnboardingPopupProps {
  open: boolean;
  onQuickSetup: () => void;
  onDismiss: () => void;
}

export function HelpfulMemoryOnboardingPopup({ open, onQuickSetup, onDismiss }: HelpfulMemoryOnboardingPopupProps) {
  const { language } = useTheme();
  const isAr = language === 'ar';

  const copy = {
    title: isAr ? 'تعرف على الذاكرة المفيدة' : 'Meet Helpful Memory',
    subtitle: isAr
      ? 'وقتي يتذكر الأشياء المهمة عنك حتى تكون كل محادثة أكثر فائدة.'
      : 'Wakti remembers what matters about you so every chat feels more helpful.',
    bullets: isAr
      ? [
          { icon: Sparkles, text: 'يتعلم تفضيلاتك، روتينك، ومشاريعك تلقائياً.' },
          { icon: Eye,      text: 'أنت ترى كل شيء محفوظ. تعدّل أو تحذف في أي وقت.' },
          { icon: Lock,     text: 'ذاكرتك خاصة بك. يمكنك إيقاف التقاطها كلياً.' },
        ]
      : [
          { icon: Sparkles, text: 'Learns your preferences, routines, and projects automatically.' },
          { icon: Eye,      text: 'You see everything saved. Edit or delete anytime.' },
          { icon: Lock,     text: 'It stays private. You can pause capturing whenever you want.' },
        ],
    tipTitle: isAr ? 'إعداد سريع في 10 ثوانٍ' : 'Quick Setup in 10 seconds',
    tipBody: isAr
      ? 'أخبرنا أبسط الأشياء (الاسم، المدينة، المهنة) وسنستخدمها فقط عندما تكون مفيدة فعلاً.'
      : 'Tell us the basics (name, city, job) and we only use them when they’re genuinely useful.',
    cta: isAr ? 'إعداد سريع' : 'Quick Setup',
    skip: isAr ? 'لاحقاً' : 'Maybe Later',
    footer: isAr
      ? 'يمكنك فتح Helpful Memory في أي وقت من لوحة المحادثات.'
      : 'You can open Helpful Memory anytime from the chat panel.',
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onDismiss(); }}>
      <DialogContent
        dir={isAr ? 'rtl' : 'ltr'}
        className="sm:max-w-[440px] w-[92vw] p-0 overflow-hidden rounded-3xl border border-white/10
                   bg-[linear-gradient(135deg,#0c0f14_0%,hsl(235_25%_8%)_30%,hsl(250_20%_10%)_70%,#0c0f14_100%)]
                   text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.55),0_0_40px_hsla(210,100%,65%,0.25)]"
      >
        {/* Gradient header */}
        <div className="relative px-5 pt-6 pb-5">
          <div
            className="absolute inset-x-0 top-0 h-24 opacity-70"
            style={{
              background:
                'radial-gradient(60% 100% at 50% 0%, hsla(210,100%,65%,0.35) 0%, hsla(280,70%,65%,0.18) 45%, transparent 80%)',
            }}
          />
          <div className="relative flex items-start gap-3">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl
                            bg-[linear-gradient(135deg,hsl(210,100%,65%)_0%,hsl(280,70%,65%)_100%)]
                            shadow-[0_0_25px_hsla(210,100%,65%,0.55)]">
              <Brain className="h-6 w-6 text-white" />
              <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-amber-300 drop-shadow" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold leading-tight text-white">{copy.title}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-300">{copy.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Bullets */}
        <div className="px-5 pb-1">
          <ul className="space-y-2">
            {copy.bullets.map((b, i) => {
              const Icon = b.icon;
              return (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/10">
                    <Icon className="h-3.5 w-3.5 text-blue-300" />
                  </div>
                  <span className="text-[13px] leading-relaxed text-slate-200">{b.text}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Quick tip box */}
        <div className="mx-5 mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-2.5">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-amber-100">
            <Zap className="h-3.5 w-3.5" />
            {copy.tipTitle}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-amber-50/90">{copy.tipBody}</p>
        </div>

        {/* CTAs */}
        <div className="mt-4 flex gap-2 px-5 pb-4">
          <Button
            type="button"
            onClick={onQuickSetup}
            className="h-11 flex-1 rounded-2xl text-sm font-semibold text-white
                       bg-[linear-gradient(135deg,hsl(210,100%,65%)_0%,hsl(260,80%,65%)_50%,hsl(280,70%,65%)_100%)]
                       shadow-[0_8px_24px_hsla(260,80%,65%,0.45)]
                       hover:brightness-110 active:scale-95 transition"
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            {copy.cta}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onDismiss}
            className="h-11 rounded-2xl border-white/15 bg-transparent px-4 text-sm text-slate-200 hover:bg-white/10 active:scale-95"
          >
            {copy.skip}
          </Button>
        </div>

        <div className="border-t border-white/10 px-5 py-2.5 text-center text-[11px] text-slate-400">
          {copy.footer}
        </div>
      </DialogContent>
    </Dialog>
  );
}
