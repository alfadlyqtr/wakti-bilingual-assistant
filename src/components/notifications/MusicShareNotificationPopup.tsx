import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Music2, X, Download, CheckCircle2 } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { MusicTrackShare } from '@/services/musicShareService';

interface MusicShareNotificationPopupProps {
  isOpen: boolean;
  share: MusicTrackShare | null;
  onClose: () => void;
  onAccept: () => void;
  onDecline: () => void;
  isSubmitting?: boolean;
}

export function MusicShareNotificationPopup({
  isOpen,
  share,
  onClose,
  onAccept,
  onDecline,
  isSubmitting = false,
}: MusicShareNotificationPopupProps) {
  const { language } = useTheme();
  const isAr = language === 'ar';

  const senderName = useMemo(() => {
    if (!share) return '';
    return share.sender_snapshot?.display_name || share.sender_snapshot?.username || (isAr ? 'أحد جهات اتصالك' : 'One of your contacts');
  }, [isAr, share]);

  const trackTitle = share?.track_snapshot?.title || (isAr ? 'مقطع موسيقي' : 'Music track');
  const coverUrl = share?.track_snapshot?.cover_url || null;

  return (
    <AnimatePresence>
      {isOpen && share && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ scale: 0.86, opacity: 0, y: 36 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 24 }}
            transition={{ type: 'spring', duration: 0.55 }}
            className="relative z-10 w-full max-w-md"
          >
            <Card className="overflow-hidden border border-fuchsia-400/20 bg-[linear-gradient(135deg,#0c0f14_0%,rgba(35,19,52,0.98)_45%,rgba(20,31,54,0.98)_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.55),0_0_40px_rgba(168,85,247,0.18)] text-white">
              <CardContent className="p-0">
                <div className="relative overflow-hidden px-5 pt-5 pb-4">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(217,70,239,0.22),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.18),transparent_35%)]" />
                  <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-3 top-3 z-10 rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label={isAr ? 'إغلاق' : 'Close'}
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="relative z-10 flex items-start gap-4">
                    <div className="h-20 w-20 overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                      {coverUrl ? (
                        <img src={coverUrl} alt={trackTitle} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-fuchsia-500/20 to-sky-500/20">
                          <Music2 className="h-8 w-8 text-fuchsia-200" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pt-1">
                      <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-fuchsia-400/25 bg-fuchsia-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-fuchsia-200">
                        <Download className="h-3 w-3" />
                        {isAr ? 'مشاركة موسيقى' : 'Music Share'}
                      </div>
                      <h2 className="truncate text-lg font-extrabold leading-tight text-white">
                        {senderName}
                      </h2>
                      <p className="mt-1 text-sm text-white/80">
                        {isAr ? 'يريد مشاركة هذا المقطع معك' : 'wants to share this track with you'}
                      </p>
                      <p className="mt-3 truncate text-base font-semibold text-sky-100">
                        {trackTitle}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="border-t border-white/10 bg-black/10 px-5 py-4">
                  <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed text-white/80">
                    {isAr
                      ? 'إذا قبلت، سيتم حفظ هذا المقطع في مقاطعك المحفوظة تلقائياً.'
                      : 'If you accept, this track will be saved to your music library automatically.'}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={onDecline}
                      disabled={isSubmitting}
                      variant="outline"
                      className="flex-1 border border-red-500/70 bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-400"
                    >
                      {isAr ? 'رفض' : 'Decline'}
                    </Button>
                    <Button
                      type="button"
                      onClick={onAccept}
                      disabled={isSubmitting}
                      variant="outline"
                      className="flex-1 border border-emerald-500/70 bg-transparent text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 hover:border-emerald-400"
                    >
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                      {isAr ? 'قبول وحفظ' : 'Accept & Save'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
