import React, { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen, Calculator, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface StudyModeMessageProps {
  answer: string;
  steps?: string[];
  inputInterpretation?: string;
  explanation?: string;
  summaryBox?: string;
  language: string;
}

export function StudyModeMessage({
  answer,
  steps = [],
  inputInterpretation,
  explanation,
  summaryBox,
  language
}: StudyModeMessageProps) {
  const [showSteps, setShowSteps] = useState(false);
  const isArabic = language === 'ar';

  return (
    <div className="space-y-3 my-2">
      {/* Answer Card */}
      <div className="rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 border border-purple-200/60 dark:border-purple-700/40 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Calculator className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide">
            {isArabic ? 'الإجابة' : 'Answer'}
          </span>
        </div>
        <div className="text-lg font-medium text-purple-900 dark:text-purple-100 font-mono">
          {answer}
        </div>
        {summaryBox && (
          <div className="mt-3 pt-3 border-t border-purple-200/60 dark:border-purple-700/40">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-300">
              {isArabic ? 'ملخص إضافي' : 'Summary Box'}
            </div>
            <div className="mt-1 text-sm text-purple-900/90 dark:text-purple-100/90">
              {summaryBox}
            </div>
          </div>
        )}
        {inputInterpretation && inputInterpretation !== answer && (
          <div className="mt-2 text-xs text-purple-600/70 dark:text-purple-400/70">
            {isArabic ? 'تفسير السؤال: ' : 'Interpreted as: '}
            <span className="font-mono">{inputInterpretation}</span>
          </div>
        )}
      </div>

      {/* Explanation (if provided separately from the streamed content) */}
      {explanation && (
        <div className="rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/40 dark:border-blue-700/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
              {isArabic ? 'الشرح' : 'Explanation'}
            </span>
          </div>
          <div className="text-sm text-blue-900/80 dark:text-blue-100/80">
            {explanation}
          </div>
        </div>
      )}

      {/* Steps (Collapsible) */}
      {steps.length > 0 && (
        <div className="rounded-xl bg-green-50/50 dark:bg-green-900/10 border border-green-200/40 dark:border-green-700/30 overflow-hidden">
          <button
            onClick={() => setShowSteps(!showSteps)}
            className="w-full flex items-center justify-between p-3 hover:bg-green-100/50 dark:hover:bg-green-800/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">
                {isArabic ? `عرض الخطوات (${steps.length})` : `Show Steps (${steps.length})`}
              </span>
            </div>
            {showSteps ? (
              <ChevronUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-green-600 dark:text-green-400" />
            )}
          </button>
          
          <AnimatePresence>
            {showSteps && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-2">
                  {steps.map((step, index) => (
                    <div
                      key={index}
                      className="flex gap-3 text-sm text-green-900/80 dark:text-green-100/80"
                    >
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-200/60 dark:bg-green-700/40 flex items-center justify-center text-xs font-bold text-green-700 dark:text-green-300">
                        {index + 1}
                      </span>
                      <span className="font-mono text-xs leading-relaxed pt-1">{step}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

    </div>
  );
}
