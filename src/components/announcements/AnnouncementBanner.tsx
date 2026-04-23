import React from 'react';
import { Megaphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';
import type { PendingAnnouncement } from '@/services/AnnouncementRuntime';

interface AnnouncementBannerProps {
  announcement: PendingAnnouncement | null;
  onAction: () => void;
  onDismiss: () => void;
}

export function AnnouncementBanner({ announcement, onAction, onDismiss }: AnnouncementBannerProps) {
  const { language } = useTheme();
  const isAr = language === 'ar';

  if (!announcement) return null;

  const title = (isAr ? announcement.title_ar : announcement.title_en) || announcement.title_en || '';
  const body  = (isAr ? announcement.body_ar  : announcement.body_en)  || announcement.body_en  || '';
  const ctaLabel = announcement.cta_enabled
    ? ((isAr ? announcement.cta_label_ar : announcement.cta_label_en) || (isAr ? 'متابعة' : 'Open'))
    : null;

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="fixed top-0 left-0 right-0 z-[70] px-3 pt-[env(safe-area-inset-top)]"
    >
      <div className="mx-auto max-w-3xl mt-2 rounded-2xl border border-white/10
                      bg-[linear-gradient(135deg,#0c0f14_0%,hsl(250_20%_12%)_100%)]
                      shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur
                      px-3 py-2 flex items-center gap-3 text-white">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl
                        bg-[linear-gradient(135deg,hsl(210,100%,65%),hsl(280,70%,65%))]">
          <Megaphone className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          {title && <div className="text-[13px] font-semibold truncate">{title}</div>}
          {body && <div className="text-[12px] text-white/70 truncate">{body}</div>}
        </div>
        {ctaLabel && (
          <Button
            size="sm"
            onClick={onAction}
            className="h-8 px-3 rounded-xl text-xs bg-white/15 hover:bg-white/20 text-white"
          >
            {ctaLabel}
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          onClick={onDismiss}
          className="h-8 w-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
          aria-label="Close announcement"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
