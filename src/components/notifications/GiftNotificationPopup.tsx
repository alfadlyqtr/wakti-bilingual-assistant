import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Mic, Music2, Sparkles, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useTheme } from '@/providers/ThemeProvider';

interface GiftNotificationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  giftType: 'voice_credits' | 'translation_credits' | 'voice_characters_monthly' | 'music_generations';
  amount: number;
  sender: string;
  title?: string;
  body?: string;
}

export function GiftNotificationPopup({ 
  isOpen, 
  onClose, 
  giftType, 
  amount, 
  sender,
  title,
  body,
}: GiftNotificationPopupProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const { language } = useTheme();
  const isAr = language === 'ar';

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      // Auto close after 8 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  const isMusicGift = giftType === 'music_generations';
  const giftLabel = isAr
    ? (isMusicGift
      ? 'مرة إنشاء موسيقى'
      : giftType === 'translation_credits'
        ? 'رصيد الترجمة'
        : 'أحرف صوتية')
    : (isMusicGift
      ? 'music generations'
      : giftType === 'translation_credits'
        ? 'translation credits'
        : 'voice characters');

  const headerText = title || (isAr ? 'هدية صغيرة من وقتي' : 'A little gift from Wakti');
  const messageText = body || (isAr
    ? `وصلك ${amount.toLocaleString()} ${giftLabel} مجاناً. مع تحيات فريق وقتي. استمتع.`
    : `You received ${amount.toLocaleString()} ${giftLabel}. Compliments of the Wakti team. Enjoy.`);

  const Icon = isMusicGift ? Music2 : Mic;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4" onClick={onClose}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Gift Card */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ type: "spring", duration: 0.6 }}
            className="relative z-10 w-full max-w-md"
            onClick={onClose}
          >
            <Card className="overflow-hidden border border-fuchsia-400/20 bg-[linear-gradient(135deg,#0c0f14_0%,rgba(35,19,52,0.98)_45%,rgba(20,31,54,0.98)_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.55),0_0_40px_rgba(168,85,247,0.18)] text-white">
              <CardContent className="p-0 text-center text-white relative overflow-hidden">
                {/* Close Button */}
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute top-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label={isAr ? 'إغلاق' : 'Close'}
                >
                  <X className="h-4 w-4" />
                </button>

                {/* Confetti Effect */}
                {showConfetti && (
                  <div className="absolute inset-0 pointer-events-none">
                    {[...Array(20)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ 
                          x: Math.random() * 100 + '%',
                          y: '-10%',
                          opacity: 1,
                          scale: Math.random() * 0.5 + 0.5
                        }}
                        animate={{ 
                          y: '110%',
                          opacity: 0,
                          rotate: Math.random() * 360
                        }}
                        transition={{ 
                          duration: Math.random() * 2 + 2,
                          delay: Math.random() * 0.5
                        }}
                        className="absolute"
                      >
                        <Sparkles className="h-3 w-3 text-yellow-300" />
                      </motion.div>
                    ))}
                  </div>
                )}

                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(217,70,239,0.22),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.18),transparent_35%)]" />

                <div className="relative z-10 px-5 pt-5 pb-4">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.2, type: "spring", duration: 0.8 }}
                    className="mb-4 flex items-start gap-4"
                  >
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
                        <Gift className="h-7 w-7 text-fuchsia-100" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 pt-1 text-left">
                      <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-fuchsia-400/25 bg-fuchsia-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-fuchsia-200">
                        <Icon className="h-3 w-3" />
                        {isAr ? 'هدية من وقتي' : 'Gift from Wakti'}
                      </div>
                      <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-2xl font-extrabold leading-tight text-white"
                      >
                        {headerText}
                      </motion.h2>
                      <p className="mt-2 text-sm text-white/70">
                        {sender}
                      </p>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left"
                  >
                    <p className="text-base font-semibold text-white">
                      {isAr ? 'وصلتك هدية جديدة' : 'You received a new gift'}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-white/80">
                      {messageText}
                    </p>
                    <p className="mt-3 text-sm font-semibold text-sky-100">
                      {amount.toLocaleString()} {giftLabel}
                    </p>
                  </motion.div>

                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mt-4 text-center text-xs text-white/60"
                  >
                    {isAr ? 'اضغط في أي مكان للإغلاق' : 'Tap anywhere to close'}
                  </motion.p>
                </div>

                {/* Decorative Elements */}
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                  <div className="absolute top-4 left-4 w-2 h-2 bg-white/30 rounded-full animate-pulse"></div>
                  <div className="absolute top-8 right-6 w-1 h-1 bg-white/40 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                  <div className="absolute bottom-6 left-8 w-3 h-3 bg-white/20 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
                  <div className="absolute bottom-4 right-4 w-2 h-2 bg-white/35 rounded-full animate-pulse" style={{ animationDelay: '1.5s' }}></div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
