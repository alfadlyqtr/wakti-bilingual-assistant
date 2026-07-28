import React, { memo, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Shuffle, RotateCcw, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';

export interface Flashcard {
  front: string;
  back: string;
}

function StudyFlashcardsImpl({ cards, language }: { cards: Flashcard[]; language: string }) {
  const isArabic = language === 'ar';
  const [order, setOrder] = useState<number[] | null>(null);
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const cardCount = cards.length;
  const activeOrder = useMemo(
    () => (order && order.length === cardCount ? order : Array.from({ length: cardCount }, (_, index) => index)),
    [order, cardCount]
  );

  if (cards.length === 0) return null;

  const safePosition = Math.min(position, activeOrder.length - 1);
  const card = cards[activeOrder[safePosition]];

  const goTo = (next: number) => {
    setPosition(Math.max(0, Math.min(next, activeOrder.length - 1)));
    setRevealed(false);
  };

  const shuffle = () => {
    const next = cards.map((_, index) => index);
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    setOrder(next);
    setPosition(0);
    setRevealed(false);
  };

  const restart = () => {
    setOrder(null);
    setPosition(0);
    setRevealed(false);
  };

  const progress = ((safePosition + 1) / activeOrder.length) * 100;
  const isLast = safePosition >= activeOrder.length - 1;
  const isFirst = safePosition <= 0;

  return (
    <div className="rounded-xl border border-purple-300/45 dark:border-purple-500/30 bg-purple-500/5 dark:bg-purple-500/10 p-4" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-purple-700 dark:text-purple-300" />
          <span className="text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
            {isArabic ? 'بطاقات تعليمية' : 'Flashcards'}
          </span>
        </div>
        <span className="text-xs font-semibold tabular-nums text-purple-700/80 dark:text-purple-300/80">
          {safePosition + 1} / {activeOrder.length}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setRevealed((value) => !value)}
        className="w-full rounded-xl border border-purple-300/50 dark:border-purple-500/30 bg-white/80 dark:bg-slate-900/60 p-4 text-start transition-all hover:border-purple-400/70 active:scale-[0.99]"
      >
        <div className="text-[15px] font-semibold leading-7 text-slate-900 dark:text-slate-100">
          {card.front}
        </div>

        <AnimatePresence initial={false} mode="wait">
          {revealed ? (
            <motion.div
              key="answer"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="mt-3 border-t border-purple-200/70 dark:border-white/10 pt-3 text-[15px] leading-7 text-slate-800 dark:text-slate-200"
            >
              {card.back}
            </motion.div>
          ) : (
            <motion.div
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-purple-700/80 dark:text-purple-300/80"
            >
              <Eye className="h-3.5 w-3.5" />
              {isArabic ? 'اضغط لعرض الإجابة' : 'Tap to show the answer'}
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-purple-200/50 dark:bg-purple-500/20">
        <div
          className="h-full rounded-full bg-purple-500 dark:bg-purple-400 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => goTo(safePosition - 1)}
          disabled={isFirst}
          className="inline-flex items-center gap-1 rounded-full border border-purple-300/50 dark:border-purple-500/30 px-3 py-1.5 text-xs font-medium text-purple-800 dark:text-purple-200 transition-all hover:bg-purple-500/15 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          {isArabic ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          {isArabic ? 'السابق' : 'Prev'}
        </button>

        <button
          type="button"
          onClick={() => setRevealed((value) => !value)}
          className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/15 dark:bg-purple-500/25 px-3 py-1.5 text-xs font-semibold text-purple-800 dark:text-purple-100 transition-all hover:bg-purple-500/25 active:scale-95"
        >
          {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {revealed
            ? (isArabic ? 'إخفاء' : 'Hide')
            : (isArabic ? 'الإجابة' : 'Answer')}
        </button>

        <button
          type="button"
          onClick={() => goTo(safePosition + 1)}
          disabled={isLast}
          className="inline-flex items-center gap-1 rounded-full border border-purple-300/50 dark:border-purple-500/30 px-3 py-1.5 text-xs font-medium text-purple-800 dark:text-purple-200 transition-all hover:bg-purple-500/15 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          {isArabic ? 'التالي' : 'Next'}
          {isArabic ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={shuffle}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-purple-700/90 dark:text-purple-300/90 transition-all hover:bg-purple-500/10 active:scale-95"
        >
          <Shuffle className="h-3 w-3" />
          {isArabic ? 'خلط' : 'Shuffle'}
        </button>
        <button
          type="button"
          onClick={restart}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-purple-700/90 dark:text-purple-300/90 transition-all hover:bg-purple-500/10 active:scale-95"
        >
          <RotateCcw className="h-3 w-3" />
          {isArabic ? 'من البداية' : 'Restart'}
        </button>
      </div>
    </div>
  );
}

export const StudyFlashcards = memo(StudyFlashcardsImpl);
