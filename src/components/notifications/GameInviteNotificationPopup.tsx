import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Gamepad2, Shield, X, XCircle } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { GameInviteRecord } from '@/services/gameInviteService';

interface GameInviteNotificationPopupProps {
  isOpen: boolean;
  invite: GameInviteRecord | null;
  onClose: () => void;
  onAccept: () => void;
  onDecline: () => void;
  isSubmitting?: boolean;
}

export function GameInviteNotificationPopup({
  isOpen,
  invite,
  onClose,
  onAccept,
  onDecline,
  isSubmitting = false,
}: GameInviteNotificationPopupProps) {
  const { language } = useTheme();
  const isAr = language === 'ar';

  const senderName = useMemo(() => {
    if (!invite) return '';
    return invite.sender_snapshot?.display_name || invite.sender_snapshot?.username || (isAr ? 'أحد جهات اتصالك' : 'One of your contacts');
  }, [invite, isAr]);

  const gameTitle = invite?.game_type === 'chess'
    ? (isAr ? 'الشطرنج' : 'Chess')
    : (isAr ? 'إكس-أو' : 'Tic-Tac-Toe');

  const AccentIcon = invite?.game_type === 'chess' ? Shield : Gamepad2;

  return (
    <AnimatePresence>
      {isOpen && invite && (
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
            <Card className="overflow-hidden border border-sky-400/20 bg-[linear-gradient(135deg,#0c0f14_0%,rgba(17,30,52,0.98)_45%,rgba(8,38,51,0.98)_100%)] text-white shadow-[0_20px_60px_rgba(0,0,0,0.55),0_0_40px_rgba(37,99,235,0.16)]">
              <CardContent className="p-0">
                <div className="relative overflow-hidden px-5 pb-4 pt-5">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.24),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.20),transparent_35%)]" />
                  <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-3 top-3 z-10 rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label={isAr ? 'إغلاق' : 'Close'}
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="relative z-10 flex items-start gap-4">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-blue-600/25 to-cyan-500/20 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                      <AccentIcon className="h-9 w-9 text-sky-100" />
                    </div>
                    <div className="min-w-0 flex-1 pt-1">
                      <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-sky-400/25 bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200">
                        <Gamepad2 className="h-3 w-3" />
                        {isAr ? 'دعوة لعبة' : 'Game Invite'}
                      </div>
                      <h2 className="truncate text-lg font-extrabold leading-tight text-white">
                        {senderName}
                      </h2>
                      <p className="mt-1 text-sm text-white/80">
                        {isAr ? 'يدعوك للعب معًا' : 'invited you to play'}
                      </p>
                      <p className="mt-3 truncate text-base font-semibold text-sky-100">
                        {gameTitle}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="border-t border-white/10 bg-black/10 px-5 py-4">
                  <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed text-white/80">
                    {isAr
                      ? 'إذا قبلت، سندخلك مباشرة إلى شاشة اللعبة مع صديقك.'
                      : 'If you accept, you will be taken straight into the game screen with your friend.'}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={onDecline}
                      disabled={isSubmitting}
                      variant="outline"
                      className="flex-1 border border-red-500/70 bg-transparent text-red-400 hover:border-red-400 hover:bg-red-500/10 hover:text-red-300"
                    >
                      <XCircle className="mr-1 h-4 w-4" />
                      {isAr ? 'رفض' : 'Decline'}
                    </Button>
                    <Button
                      type="button"
                      onClick={onAccept}
                      disabled={isSubmitting}
                      variant="outline"
                      className="flex-1 border border-emerald-500/70 bg-transparent text-emerald-400 hover:border-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                    >
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                      {isAr ? 'قبول واللعب' : 'Accept & Play'}
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
