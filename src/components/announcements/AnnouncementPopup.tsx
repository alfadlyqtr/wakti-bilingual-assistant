import React from 'react';
import { Megaphone, Sparkles } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';
import type { PendingAnnouncement } from '@/services/AnnouncementRuntime';

interface AnnouncementPopupProps {
  announcement: PendingAnnouncement | null;
  open: boolean;
  onAction: () => void;
  onDismiss: () => void;
}

const ACCENT: Record<string, { from: string; to: string; glow: string }> = {
  blue:    { from: 'hsl(210,100%,65%)', to: 'hsl(280,70%,65%)', glow: 'hsla(210,100%,65%,0.45)' },
  purple:  { from: 'hsl(280,70%,65%)',  to: 'hsl(210,100%,65%)', glow: 'hsla(280,70%,65%,0.45)' },
  green:   { from: 'hsl(160,80%,55%)',  to: 'hsl(210,100%,65%)', glow: 'hsla(160,80%,55%,0.45)' },
  orange:  { from: 'hsl(25,95%,60%)',   to: 'hsl(45,100%,60%)',  glow: 'hsla(25,95%,60%,0.45)' },
  pink:    { from: 'hsl(320,75%,70%)',  to: 'hsl(280,70%,65%)',  glow: 'hsla(320,75%,70%,0.45)' },
  amber:   { from: 'hsl(45,100%,60%)',  to: 'hsl(25,95%,60%)',   glow: 'hsla(45,100%,60%,0.45)' },
  default: { from: 'hsl(210,100%,65%)', to: 'hsl(280,70%,65%)',  glow: 'hsla(210,100%,65%,0.45)' },
};

export function AnnouncementPopup({ announcement, open, onAction, onDismiss }: AnnouncementPopupProps) {
  const { language } = useTheme();
  const isAr = language === 'ar';

  if (!announcement) return null;

  const title = (isAr ? announcement.title_ar : announcement.title_en) || announcement.title_en || announcement.title_ar || '';
  const body  = (isAr ? announcement.body_ar  : announcement.body_en)  || announcement.body_en  || announcement.body_ar  || '';
  const ctaLabel = announcement.cta_enabled
    ? ((isAr ? announcement.cta_label_ar : announcement.cta_label_en) || (isAr ? 'متابعة' : 'Continue'))
    : null;
  const skipLabel = isAr ? 'إغلاق' : 'Close';
  const accent = ACCENT[(announcement.color || 'default').toLowerCase()] || ACCENT.default;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onDismiss(); }}>
      <DialogContent
        dir={isAr ? 'rtl' : 'ltr'}
        className="sm:max-w-[440px] w-[92vw] p-0 overflow-hidden rounded-3xl border border-white/10
                   bg-[linear-gradient(135deg,#0c0f14_0%,hsl(235_25%_8%)_30%,hsl(250_20%_10%)_70%,#0c0f14_100%)]
                   text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.55),0_0_40px_hsla(210,100%,65%,0.25)]"
      >
        <div className="relative px-5 pt-6 pb-4">
          <div
            className="absolute inset-x-0 top-0 h-24 opacity-70"
            style={{
              background: `radial-gradient(60% 100% at 50% 0%, ${accent.glow} 0%, transparent 80%)`,
            }}
          />
          <div className="relative flex items-start gap-3">
            <div
              className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-[0_0_25px_var(--glow)]"
              style={{
                background: `linear-gradient(135deg, ${accent.from} 0%, ${accent.to} 100%)`,
                ['--glow' as any]: accent.glow,
              } as React.CSSProperties}
            >
              <Megaphone className="h-6 w-6 text-white" />
              <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-amber-300 drop-shadow" />
            </div>
            <div className="flex-1">
              {title && <h2 className="text-lg font-bold leading-tight text-white break-words">{title}</h2>}
              {body && <p className="mt-1 text-[13px] leading-relaxed text-slate-300 whitespace-pre-line">{body}</p>}
            </div>
          </div>
        </div>

        <div className="mt-2 flex gap-2 px-5 pb-5">
          {ctaLabel && (
            <Button
              type="button"
              onClick={onAction}
              className="h-11 flex-1 rounded-2xl text-sm font-semibold text-white
                         bg-[linear-gradient(135deg,hsl(210,100%,65%)_0%,hsl(260,80%,65%)_50%,hsl(280,70%,65%)_100%)]
                         shadow-[0_8px_24px_hsla(260,80%,65%,0.45)]
                         hover:brightness-110 active:scale-95 transition"
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              {ctaLabel}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={onDismiss}
            className={`h-11 rounded-2xl border-white/15 bg-transparent px-4 text-sm text-slate-200 hover:bg-white/10 active:scale-95 ${ctaLabel ? '' : 'flex-1'}`}
          >
            {skipLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
