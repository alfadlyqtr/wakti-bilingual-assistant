import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useTextSize } from '@/hooks/useTextSize';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAuth } from '@/contexts/AuthContext';
import { COLOR_BLIND_MODES, type ColorBlindMode } from '@/components/accessibility/ColorBlindFilters';
import { type TextSize } from '@/hooks/useTextSize';

// Returns a user-scoped key so each account has its own onboarding flag
const getOnboardingKey = (userId: string) => `wakti_accessibility_onboarded_${userId}`;
// Max age of free_access_start_at to count as "just came through the hello wall" (10 minutes)
const NEW_USER_WINDOW_MS = 10 * 60 * 1000;

export function AccessibilityOnboarding() {
  const { language, theme } = useTheme();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const { colorBlindMode, setColorBlindMode } = useAccessibility();
  const { textSize, setTextSize } = useTextSize();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<'colors' | 'text'>('colors');

  const isAr = language === 'ar';

  useEffect(() => {
    // Wait until profile is loaded and we have a user
    if (profileLoading || !user?.id || !profile) return;

    const userId = user.id;
    const onboardingKey = getOnboardingKey(userId);

    // Never show again if already completed
    if (localStorage.getItem(onboardingKey)) return;

    // Only show for brand new users who JUST got through the hello wall:
    // free_access_start_at must exist (trial just started) AND be within the last 10 minutes
    const startAt = profile.free_access_start_at;
    if (!startAt) return; // isNewUser — hello wall not yet passed, don't show

    const msSinceStart = Date.now() - Date.parse(startAt);
    if (msSinceStart > NEW_USER_WINDOW_MS) return; // existing user, window expired

    // Small delay so dashboard content loads first — feels less abrupt
    const timer = setTimeout(() => setVisible(true), 900);
    return () => clearTimeout(timer);
  }, [profileLoading, user?.id, profile]);

  const dismiss = () => {
    if (user?.id) localStorage.setItem(getOnboardingKey(user.id), '1');
    setVisible(false);
  };

  const handleColorPick = (mode: ColorBlindMode) => {
    setColorBlindMode(mode);
    // Move to text size step
    setStep('text');
  };

  const handleTextPick = (size: TextSize) => {
    setTextSize(size);
    dismiss();
  };

  const handleSkipColors = () => setStep('text');
  const handleSkipText = () => dismiss();

  const isDark = theme === 'dark';

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
            onClick={dismiss}
          />

          {/* Sheet — slides up from bottom on mobile, centered on desktop */}
          <motion.div
            key="sheet"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className={`fixed bottom-0 left-0 right-0 z-[9999] mx-auto max-w-lg rounded-t-3xl shadow-2xl
              md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:rounded-3xl md:left-1/2 md:-translate-x-1/2 md:w-full
              ${isDark ? 'bg-[#0c0f14] border border-white/10' : 'bg-white border border-black/8'}`}
            style={{ maxHeight: '90dvh', overflowY: 'auto' }}
          >
            {/* Drag handle (mobile) */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className={`w-10 h-1 rounded-full ${isDark ? 'bg-white/20' : 'bg-black/15'}`} />
            </div>

            {/* Close button */}
            <button
              onClick={dismiss}
              aria-label="Close"
              className={`absolute top-4 right-4 p-1.5 rounded-full transition-colors
                ${isDark ? 'text-white/40 hover:text-white/80 hover:bg-white/10' : 'text-black/30 hover:text-black/70 hover:bg-black/8'}`}
            >
              <X className="h-4 w-4" />
            </button>

            <div className="px-5 pt-2 pb-8 md:px-7 md:pt-6">

              <AnimatePresence mode="wait">

                {/* ─── STEP 1: COLOR ─────────────────────────────── */}
                {step === 'colors' && (
                  <motion.div
                    key="colors"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.22 }}
                    className="space-y-5"
                  >
                    {/* Header */}
                    <div className="space-y-1.5 pr-6">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">👀</span>
                        <h2 className={`text-lg font-bold leading-tight ${isDark ? 'text-white' : 'text-[#060541]'}`}>
                          {isAr ? 'هل تعاني من صعوبة في رؤية الألوان؟' : 'Do you have difficulty seeing colors?'}
                        </h2>
                      </div>
                      <p className={`text-sm leading-relaxed ${isDark ? 'text-white/55' : 'text-black/50'}`}>
                        {isAr
                          ? 'واكتي يدعم وضع خاص يُحسّن التباين — يمكنك تغييره دائماً من الإعدادات.'
                          : 'Wakti supports color adjustment modes to improve contrast. You can always change this in Settings.'}
                      </p>
                    </div>

                    {/* Step indicator */}
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-6 rounded-full bg-blue-500" />
                      <div className={`h-1.5 w-6 rounded-full ${isDark ? 'bg-white/20' : 'bg-black/12'}`} />
                    </div>

                    {/* Options */}
                    <div className="space-y-2">
                      {COLOR_BLIND_MODES.map((m) => {
                        const isActive = colorBlindMode === m.value;
                        return (
                          <button
                            key={m.value}
                            onClick={() => handleColorPick(m.value)}
                            className={`w-full flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all active:scale-[0.98]
                              ${isActive
                                ? 'border-blue-500 bg-blue-500/12'
                                : isDark
                                  ? 'border-white/10 bg-white/4 hover:bg-white/8'
                                  : 'border-black/10 bg-black/2 hover:bg-black/5'
                              }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold leading-tight ${isActive ? 'text-blue-500' : isDark ? 'text-white' : 'text-[#060541]'}`}>
                                {isAr ? m.labelAr : m.labelEn}
                              </p>
                              <p className={`text-xs mt-0.5 leading-snug ${isDark ? 'text-white/45' : 'text-black/45'}`}>
                                {isAr ? m.descriptionAr : m.description}
                              </p>
                            </div>
                            <div className={`h-5 w-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all
                              ${isActive ? 'border-blue-500 bg-blue-500' : isDark ? 'border-white/25' : 'border-black/20'}`}>
                              {isActive && (
                                <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Skip */}
                    <button
                      onClick={handleSkipColors}
                      className={`w-full py-3 text-sm font-medium rounded-2xl transition-colors
                        ${isDark ? 'text-white/40 hover:text-white/70 hover:bg-white/6' : 'text-black/35 hover:text-black/60 hover:bg-black/5'}`}
                    >
                      {isAr ? 'تخطي' : 'Skip for now'}
                    </button>
                  </motion.div>
                )}

                {/* ─── STEP 2: TEXT SIZE ──────────────────────────── */}
                {step === 'text' && (
                  <motion.div
                    key="text"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.22 }}
                    className="space-y-5"
                  >
                    {/* Header */}
                    <div className="space-y-1.5 pr-6">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🔤</span>
                        <h2 className={`text-lg font-bold leading-tight ${isDark ? 'text-white' : 'text-[#060541]'}`}>
                          {isAr ? 'ما حجم النص المناسب لك؟' : "What text size feels right?"}
                        </h2>
                      </div>
                      <p className={`text-sm leading-relaxed ${isDark ? 'text-white/55' : 'text-black/50'}`}>
                        {isAr
                          ? 'يؤثر هذا على كل نصوص التطبيق — يمكنك تغييره دائماً من الإعدادات.'
                          : 'This affects all text across the app. You can change it anytime in Settings.'}
                      </p>
                    </div>

                    {/* Step indicator */}
                    <div className="flex items-center gap-1.5">
                      <div className={`h-1.5 w-6 rounded-full ${isDark ? 'bg-white/20' : 'bg-black/12'}`} />
                      <div className="h-1.5 w-6 rounded-full bg-blue-500" />
                    </div>

                    {/* Options */}
                    <div className="space-y-2">
                      {([
                        { value: 'normal' as const,  labelEn: 'Normal',       labelAr: 'عادي',       subtitleEn: 'Default — great for most people',    subtitleAr: 'الافتراضي — مناسب لمعظم الناس',   sample: 'Aa', size: 'text-base'  },
                        { value: 'large'  as const,  labelEn: 'Large',        labelAr: 'كبير',       subtitleEn: 'Easier to read — a little bigger',   subtitleAr: 'أوضح للقراءة — أكبر قليلاً',      sample: 'Aa', size: 'text-xl'    },
                        { value: 'xlarge' as const,  labelEn: 'Extra Large',  labelAr: 'كبير جداً', subtitleEn: 'Maximum comfort — significantly larger', subtitleAr: 'راحة قصوى — أكبر بشكل ملحوظ',  sample: 'Aa', size: 'text-2xl'   },
                      ]).map((opt) => {
                        const isActive = textSize === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => handleTextPick(opt.value)}
                            className={`w-full flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all active:scale-[0.98]
                              ${isActive
                                ? 'border-blue-500 bg-blue-500/12'
                                : isDark
                                  ? 'border-white/10 bg-white/4 hover:bg-white/8'
                                  : 'border-black/10 bg-black/2 hover:bg-black/5'
                              }`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className={`font-bold flex-shrink-0 ${opt.size} ${isActive ? 'text-blue-500' : isDark ? 'text-white/40' : 'text-black/30'}`}>
                                {opt.sample}
                              </span>
                              <div className="min-w-0">
                                <p className={`text-sm font-semibold leading-tight ${isActive ? 'text-blue-500' : isDark ? 'text-white' : 'text-[#060541]'}`}>
                                  {isAr ? opt.labelAr : opt.labelEn}
                                </p>
                                <p className={`text-xs mt-0.5 leading-snug ${isDark ? 'text-white/45' : 'text-black/45'}`}>
                                  {isAr ? opt.subtitleAr : opt.subtitleEn}
                                </p>
                              </div>
                            </div>
                            <div className={`h-5 w-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all
                              ${isActive ? 'border-blue-500 bg-blue-500' : isDark ? 'border-white/25' : 'border-black/20'}`}>
                              {isActive && (
                                <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Skip */}
                    <button
                      onClick={handleSkipText}
                      className={`w-full py-3 text-sm font-medium rounded-2xl transition-colors
                        ${isDark ? 'text-white/40 hover:text-white/70 hover:bg-white/6' : 'text-black/35 hover:text-black/60 hover:bg-black/5'}`}
                    >
                      {isAr ? 'تخطي، سأبقى بالحجم الافتراضي' : "Skip, keep default size"}
                    </button>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
