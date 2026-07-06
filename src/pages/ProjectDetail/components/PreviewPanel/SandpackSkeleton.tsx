import React, { useEffect, useState } from 'react';
import { Code2, Sparkles } from 'lucide-react';

// Real progress step shape shared with ProjectDetail's generationSteps state —
// this is the SAME data the left-side "AI Builder" panel uses, so the two can
// never show different stages again.
export interface ProgressStep {
  label: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
}

interface SandpackSkeletonProps {
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  isRTL?: boolean;
  progressSteps?: ProgressStep[];
}

export function SandpackSkeleton({ 
  isLoading = true, 
  isError = false, 
  errorMessage,
  isRTL = false,
  progressSteps = [],
}: SandpackSkeletonProps) {
  // Show enhanced loading with real progress instead of error
  if (isError || isLoading) {
    return <EnhancedProjectLoader isRTL={isRTL} progressSteps={progressSteps} />;
  }
  
  // Waiting state (no files yet)
  return (
    <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center">
      <div className="relative">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <Code2 className="w-6 h-6 text-white animate-pulse" />
        </div>
      </div>
      <p className="mt-6 text-sm text-gray-400 animate-pulse">
        {isRTL ? 'في انتظار الكود...' : 'Waiting for code...'}
      </p>
    </div>
  );
}

// Cosmetic filler tips shown under the REAL status headline — purely for
// personality while waiting, clearly separated from the real stage text so
// they never get mistaken for actual progress.
const BUILD_TIPS: { en: string; ar: string }[] = [
  { en: 'You can ask me to change any color, layout, or wording right after this first build.', ar: 'يمكنك أن تطلب مني تغيير أي لون أو تخطيط أو نص بعد هذا البناء الأول مباشرة.' },
  { en: 'Upload a logo or personal photo and I\u2019ll use it directly in your design.', ar: 'قم برفع شعارك أو صورتك الشخصية وسأستخدمها مباشرة في تصميمك.' },
  { en: 'Once it\u2019s ready, you can publish your site with a single click.', ar: 'بعد الانتهاء، يمكنك نشر موقعك بضغطة واحدة.' },
  { en: 'You can ask for an entirely new section anytime \u2014 I\u2019ll slot it in cleanly.', ar: 'يمكنك طلب قسم جديد كليًا في أي وقت \u2014 سأضيفه بشكل منظم.' },
  { en: 'Preview your site on desktop, tablet, or mobile anytime with the device switcher.', ar: 'يمكنك معاينة موقعك على سطح المكتب أو التابلت أو الموبايل في أي وقت.' },
];

// Fallback headline shown only if no real progress step is available yet
// (e.g. the very first tick before the backend reports a stage).
const FALLBACK_HEADLINE = { en: 'Building your site...', ar: 'جاري بناء موقعك...' };

function EnhancedProjectLoader({ isRTL = false, progressSteps = [] }: { isRTL?: boolean; progressSteps?: ProgressStep[] }) {
  const [tipIndex, setTipIndex] = useState(0);

  // Rotate the cosmetic tip every 5s — does not touch the real headline/progress
  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % BUILD_TIPS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // REAL headline — the currently active step's label, same data source the
  // left "AI Builder" panel uses. Falls back to the last completed step's
  // label, then to a generic message if no steps exist yet.
  const activeStep = progressSteps.find((s) => s.status === 'loading');
  const lastCompleted = [...progressSteps].reverse().find((s) => s.status === 'completed');
  const headline = activeStep?.label || lastCompleted?.label || (isRTL ? FALLBACK_HEADLINE.ar : FALLBACK_HEADLINE.en);

  // REAL progress bar — derived from actual step completion, not a fake timer.
  // completed = 1 unit, loading = half credit, pending = 0.
  const totalUnits = progressSteps.length || 1;
  const completedUnits = progressSteps.reduce((sum, s) => {
    if (s.status === 'completed') return sum + 1;
    if (s.status === 'loading') return sum + 0.5;
    return sum;
  }, 0);
  const progressPercent = Math.max(6, Math.min(100, Math.round((completedUnits / totalUnits) * 100)));

  const tip = BUILD_TIPS[tipIndex];

  return (
    <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
      <div className="w-full max-w-md mx-auto px-4">
        {/* Progress bar - driven by real step completion, RTL-aware */}
        <div className="w-full h-1 bg-gray-800 rounded-full mb-8 overflow-hidden relative" dir={isRTL ? 'rtl' : 'ltr'}>
          <div 
            className={`absolute inset-y-0 ${isRTL ? 'right-0' : 'left-0'} bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700 ease-out`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Skeleton wireframe — simulates the page materializing instead of a static icon */}
        <div className="relative rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-6 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent animate-shimmer" />
          <div className="h-2.5 w-14 rounded bg-white/10 mb-3" />
          <div className="h-16 w-full rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 mb-3" />
          <div className="h-2 w-3/4 rounded bg-white/10 mb-2" />
          <div className="h-2 w-1/2 rounded bg-white/10 mb-3" />
          <div className="flex gap-2">
            <div className="h-5 w-16 rounded-md bg-indigo-500/30" />
            <div className="h-5 w-16 rounded-md bg-white/10" />
          </div>
        </div>

        {/* REAL current stage — identical text/source to the left AI Builder panel */}
        <h3 className="text-center text-lg font-medium text-white mb-2 transition-all duration-300">
          {headline}
        </h3>

        {/* Cosmetic rotating tip — visually distinct from the real headline above */}
        <p className="text-center text-xs text-gray-500 mb-4 flex items-center justify-center gap-1.5 min-h-[2.5em]">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>{isRTL ? tip.ar : tip.en}</span>
        </p>

        <p className="text-xs text-center text-gray-500 mt-4">
          {isRTL ? 'قد يستغرق هذا حتى 3 دقائق' : 'This may take up to 3 minutes'}
        </p>
      </div>
    </div>
  );
}

/**
 * Skeleton loader for the preview panel during Sandpack initialization
 */
export function SandpackPreviewSkeleton({ isRTL = false }: { isRTL?: boolean }) {
  return (
    <div className="absolute inset-0 bg-slate-950 flex flex-col p-4 animate-pulse">
      {/* Header skeleton */}
      <div className="h-12 bg-zinc-800/50 rounded-lg mb-4" />
      
      {/* Content skeleton */}
      <div className="flex-1 flex gap-4">
        {/* Sidebar skeleton */}
        <div className="w-1/4 space-y-3">
          <div className="h-8 bg-zinc-800/50 rounded" />
          <div className="h-8 bg-zinc-800/50 rounded w-4/5" />
          <div className="h-8 bg-zinc-800/50 rounded w-3/5" />
          <div className="h-8 bg-zinc-800/50 rounded w-4/5" />
        </div>
        
        {/* Main content skeleton */}
        <div className="flex-1 bg-zinc-800/30 rounded-lg p-4">
          <div className="h-6 bg-zinc-700/50 rounded w-1/3 mb-4" />
          <div className="h-4 bg-zinc-700/30 rounded w-full mb-2" />
          <div className="h-4 bg-zinc-700/30 rounded w-5/6 mb-2" />
          <div className="h-4 bg-zinc-700/30 rounded w-4/6 mb-4" />
          
          <div className="h-32 bg-zinc-700/20 rounded mb-4" />
          
          <div className="h-4 bg-zinc-700/30 rounded w-2/3 mb-2" />
          <div className="h-4 bg-zinc-700/30 rounded w-1/2" />
        </div>
      </div>
      
      {/* Status indicator */}
      <div className="mt-4 flex items-center justify-center gap-2">
        <div className="w-3 h-3 bg-indigo-500 rounded-full animate-ping" />
        <span className="text-xs text-zinc-500">
          {isRTL ? 'جارٍ تهيئة المعاينة...' : 'Initializing preview...'}
        </span>
      </div>
    </div>
  );
}
