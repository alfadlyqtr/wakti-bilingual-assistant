import { CalendarClock, ChevronRight, ListTodo, Sparkles } from 'lucide-react';
import { WaktiAgentIntent } from '@/utils/waktiAgent';

interface WaktiAgentCardProps {
  language: string;
  summary: string;
  onOpen: (intent: WaktiAgentIntent) => void;
}

export function WaktiAgentCard({ language, summary, onOpen }: WaktiAgentCardProps) {
  return (
    <div className="rounded-[1.6rem] border border-white/15 bg-[linear-gradient(135deg,rgba(12,15,20,0.9)_0%,rgba(16,24,40,0.92)_45%,rgba(10,15,30,0.95)_100%)] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.38),0_0_24px_rgba(56,189,248,0.12)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-100">
            <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
            {language === 'ar' ? 'وكيل وكتي' : 'Wakti Agent'}
          </div>
          <p className="text-sm font-semibold leading-6 text-white/95">{summary}</p>
        </div>
        <button
          type="button"
          onClick={() => onOpen('ask')}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white transition-transform active:scale-95"
          aria-label={language === 'ar' ? 'افتح وكتي' : 'Open Wakti Agent'}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => onOpen('plan-day')}
          className="rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-3 py-2.5 text-left text-xs font-semibold text-cyan-50 transition-all active:scale-[0.98]"
        >
          <span className="mb-1 flex items-center gap-1.5 text-cyan-200">
            <ListTodo className="h-3.5 w-3.5" />
            {language === 'ar' ? 'اليوم' : 'Today'}
          </span>
          <span>{language === 'ar' ? 'خطط ليومي' : 'Plan my day'}</span>
        </button>

        <button
          type="button"
          onClick={() => onOpen('ask')}
          className="rounded-2xl border border-amber-300/25 bg-amber-300/10 px-3 py-2.5 text-left text-xs font-semibold text-amber-50 transition-all active:scale-[0.98]"
        >
          <span className="mb-1 flex items-center gap-1.5 text-amber-200">
            <Sparkles className="h-3.5 w-3.5" />
            {language === 'ar' ? 'اسأل' : 'Ask'}
          </span>
          <span>{language === 'ar' ? 'اسأل وكتي' : 'Ask Wakti'}</span>
        </button>

        <button
          type="button"
          onClick={() => onOpen('continue')}
          className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-3 py-2.5 text-left text-xs font-semibold text-emerald-50 transition-all active:scale-[0.98]"
        >
          <span className="mb-1 flex items-center gap-1.5 text-emerald-200">
            <ChevronRight className="h-3.5 w-3.5" />
            {language === 'ar' ? 'تابع' : 'Continue'}
          </span>
          <span>{language === 'ar' ? 'تابع آخر شيء' : 'Continue last thing'}</span>
        </button>

        <button
          type="button"
          onClick={() => onOpen('prepare-event')}
          className="rounded-2xl border border-sky-300/25 bg-sky-300/10 px-3 py-2.5 text-left text-xs font-semibold text-sky-50 transition-all active:scale-[0.98]"
        >
          <span className="mb-1 flex items-center gap-1.5 text-sky-200">
            <CalendarClock className="h-3.5 w-3.5" />
            {language === 'ar' ? 'حدث' : 'Event'}
          </span>
          <span>{language === 'ar' ? 'جهّز الحدث' : 'Prepare event'}</span>
        </button>
      </div>
    </div>
  );
}
