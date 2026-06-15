import React, { useState, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
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

const SUPERSCRIPT_MAP: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
  'n': 'ⁿ',
  'i': 'ⁱ'
};

function toSuperscript(value: string): string {
  const compact = value.trim();
  if (!compact) return '';
  let out = '';
  for (const char of compact) {
    const mapped = SUPERSCRIPT_MAP[char];
    if (!mapped) return `^(${compact})`;
    out += mapped;
  }
  return out;
}

function cleanupStudyMathText(value: string): string {
  if (!value) return '';

  let next = value.replace(/\r\n/g, '\n');

  next = next
    .replace(/\\\[([\s\S]*?)\\\]/g, '$1')
    .replace(/\\\(([\s\S]*?)\\\)/g, '$1')
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/\$([^\n$]+)\$/g, '$1');

  for (let i = 0; i < 8; i += 1) {
    const previous = next;
    next = next
      .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '($1)/($2)')
      .replace(/\\sqrt\s*\{([^{}]+)\}/g, '√($1)');
    if (previous === next) break;
  }

  next = next
    .replace(/\\cdot/g, '×')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\mp/g, '∓')
    .replace(/\\neq/g, '≠')
    .replace(/\\geq?/g, '≥')
    .replace(/\\leq?/g, '≤')
    .replace(/\\approx/g, '≈')
    .replace(/\\implies/g, '⇒')
    .replace(/\\Rightarrow/g, '⇒')
    .replace(/\\rightarrow/g, '→')
    .replace(/\\to/g, '→')
    .replace(/\\left/g, '')
    .replace(/\\right/g, '')
    .replace(/\\log/g, 'log')
    .replace(/\\ln/g, 'ln')
    .replace(/\\sin/g, 'sin')
    .replace(/\\cos/g, 'cos')
    .replace(/\\tan/g, 'tan')
    .replace(/\\theta/g, 'θ')
    .replace(/\\pi/g, 'π')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\qquad/g, '  ')
    .replace(/\\quad/g, ' ')
    .replace(/\\,/g, ' ')
    .replace(/\\;/g, ' ')
    .replace(/\\:/g, ' ')
    .replace(/\\!/g, '');

  next = next
    .replace(/\^\{([^{}]+)\}/g, (_, exponent: string) => toSuperscript(cleanupStudyMathText(exponent).replace(/\s+/g, '')))
    .replace(/\^([A-Za-z0-9+\-]+)/g, (_, exponent: string) => toSuperscript(exponent))
    .replace(/_\{([^{}]+)\}/g, '_($1)')
    .replace(/\{([^{}]+)\}/g, '$1')
    .replace(/\\([A-Za-z]+)/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ');

  return next.trim();
}

function StudyModeMessageImpl({
  answer,
  steps = [],
  inputInterpretation,
  explanation,
  summaryBox,
  language
}: StudyModeMessageProps) {
  const [showSteps, setShowSteps] = useState(false);
  const isArabic = language === 'ar';
  const answerText = typeof answer === 'string' ? cleanupStudyMathText(answer.trim()) : '';
  const explanationText = typeof explanation === 'string' ? cleanupStudyMathText(explanation.trim()) : '';
  const interpretationText = typeof inputInterpretation === 'string' ? cleanupStudyMathText(inputInterpretation.trim()) : '';
  const cleanedSteps = steps.map((step) => cleanupStudyMathText(step)).filter(Boolean);
  const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();
  const answerKey = normalizeText(answerText);
  const explanationKey = normalizeText(explanationText);
  const interpretationKey = normalizeText(interpretationText);
  const showAnswer = !!answerText && (!explanationKey || (answerKey !== explanationKey && !explanationKey.startsWith(answerKey)));
  const showInterpretation = !!interpretationText && interpretationKey !== answerKey && interpretationKey !== explanationKey;

  return (
    <div className="space-y-3 my-2">
      <div className="overflow-hidden rounded-2xl border border-purple-300/40 dark:border-purple-500/35 bg-gradient-to-br from-purple-50/90 via-white to-indigo-50/70 dark:from-slate-900/95 dark:via-slate-900 dark:to-indigo-950/90 shadow-sm">
        <div className="flex items-center gap-2 border-b border-purple-200/60 dark:border-white/10 px-4 py-3">
          <BookOpen className="h-4 w-4 text-purple-700 dark:text-purple-300" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-700 dark:text-purple-300">
            {isArabic ? 'وضع الدراسة' : 'Study Breakdown'}
          </span>
        </div>

        <div className="space-y-4 p-4">
          {showAnswer && (
            <div className="rounded-xl border border-purple-300/45 dark:border-purple-500/30 bg-purple-500/8 dark:bg-purple-500/10 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Calculator className="h-4 w-4 text-purple-700 dark:text-purple-300" />
                <span className="text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
                  {isArabic ? 'الإجابة المباشرة' : 'Direct Answer'}
                </span>
              </div>
              <div className="text-base font-semibold leading-8 text-slate-900 dark:text-slate-100">
                {answerText}
              </div>
            </div>
          )}

          {explanationText && (
            <div className="rounded-xl border border-blue-300/40 dark:border-blue-500/25 bg-blue-500/5 dark:bg-blue-500/10 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                <span className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                  {isArabic ? 'الشرح الكامل' : 'Full Explanation'}
                </span>
              </div>
              <div className="study-mode-markdown text-slate-800 dark:text-slate-100">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={{
                    p: ({ node, ...props }) => (
                      <p className="my-3 text-[15px] leading-7 text-slate-800 dark:text-slate-100 first:mt-0 last:mb-0" {...props} />
                    ),
                    h1: ({ node, ...props }) => (
                      <h1 className="mt-5 mb-3 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 first:mt-0" {...props} />
                    ),
                    h2: ({ node, ...props }) => (
                      <h2 className="mt-5 mb-3 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50 first:mt-0" {...props} />
                    ),
                    h3: ({ node, ...props }) => (
                      <h3 className="mt-4 mb-2 text-base font-semibold text-slate-900 dark:text-slate-50 first:mt-0" {...props} />
                    ),
                    ul: ({ node, ...props }) => (
                      <ul className="my-3 list-disc space-y-1.5 pl-5 marker:text-blue-600 dark:marker:text-blue-300" {...props} />
                    ),
                    ol: ({ node, ...props }) => (
                      <ol className="my-3 list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-blue-600 dark:marker:text-blue-300" {...props} />
                    ),
                    li: ({ node, ...props }) => (
                      <li className="text-[15px] leading-7 text-slate-800 dark:text-slate-100" {...props} />
                    ),
                    blockquote: ({ node, ...props }) => (
                      <blockquote className="my-4 rounded-r-xl border-l-4 border-blue-400/60 bg-blue-500/10 px-4 py-3 italic text-slate-700 dark:text-slate-200" {...props} />
                    ),
                    table: ({ node, ...props }) => (
                      <div className="my-4 overflow-x-auto rounded-xl border border-slate-300/50 dark:border-white/10 bg-white/70 dark:bg-black/20 shadow-sm">
                        <table className="w-full min-w-[420px] border-separate border-spacing-0 text-sm" {...props} />
                      </div>
                    ),
                    th: ({ node, ...props }) => (
                      <th className="border-b border-slate-300/60 dark:border-white/10 bg-slate-100/80 dark:bg-white/5 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300" {...props} />
                    ),
                    tr: ({ node, ...props }) => (
                      <tr className="odd:bg-transparent even:bg-slate-100/50 dark:even:bg-white/5" {...props} />
                    ),
                    td: ({ node, ...props }) => (
                      <td className="border-b border-slate-200/70 dark:border-white/10 px-3 py-2 align-top" {...props} />
                    ),
                    code: (rawProps) => {
                      const { className, children, ...props } = rawProps as any;
                      const isInline = !String(children).includes('\n');
                      if (isInline) {
                        return <code className="rounded-md bg-slate-200/70 dark:bg-white/10 px-1.5 py-0.5 font-medium text-[0.92em]" {...props}>{children}</code>;
                      }
                      return (
                        <pre className="my-4 overflow-x-auto rounded-xl border border-slate-300/60 dark:border-white/10 bg-slate-950/95 p-4 text-[13px] text-slate-100 shadow-sm">
                          <code className={className} {...props}>{children}</code>
                        </pre>
                      );
                    },
                    img: ({ node, ...props }) => (
                      <img className="my-4 h-auto max-w-full rounded-xl border border-slate-300/60 dark:border-white/10 shadow-sm" {...props} />
                    ),
                    a: ({ node, ...props }) => (
                      <a className="font-medium text-blue-700 underline underline-offset-2 dark:text-blue-300" target="_blank" rel="noopener noreferrer" {...props} />
                    ),
                  }}
                >
                  {explanationText}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {summaryBox && (
            <div className="rounded-xl border border-amber-300/40 dark:border-amber-500/25 bg-amber-500/5 dark:bg-amber-500/10 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  {isArabic ? 'بطاقة سريعة' : 'Quick Facts'}
                </span>
              </div>
              <div
                className="wolfram-elite-card overflow-hidden rounded-lg text-sm text-slate-800 dark:text-slate-100 [&_table]:w-full [&_table]:border-collapse [&_td]:py-1 [&_td]:pr-3 [&_td]:text-xs [&_td]:align-top [&_img]:max-w-full [&_img]:rounded [&_a]:text-amber-700 dark:[&_a]:text-amber-300 [&_a]:no-underline"
                dangerouslySetInnerHTML={{ __html: summaryBox }}
              />
            </div>
          )}

          {showInterpretation && (
            <div className="rounded-xl border border-slate-300/60 dark:border-white/10 bg-slate-100/70 dark:bg-white/5 px-4 py-3 text-xs text-slate-700 dark:text-slate-300">
              <span className="font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-200">
                {isArabic ? 'تفسير السؤال' : 'Interpreted as'}
              </span>
              <span className="ml-2 font-medium">{interpretationText}</span>
            </div>
          )}

          {cleanedSteps.length > 0 && (
            <div className="rounded-xl bg-green-50/50 dark:bg-green-900/10 border border-green-200/40 dark:border-green-700/30 overflow-hidden">
          <button
            onClick={() => setShowSteps(!showSteps)}
            className="w-full flex items-center justify-between p-3 hover:bg-green-100/50 dark:hover:bg-green-800/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">
                {isArabic ? `خطوات الحل (${cleanedSteps.length})` : `Study Steps (${cleanedSteps.length})`}
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
                  {cleanedSteps.map((step, index) => (
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
      </div>

    </div>
  );
}

// Item #8 Batch B1: memoize so parent streaming re-renders don't re-render this subtree
// when its primitive/stable-ref props (answer, steps, language) haven't changed.
export const StudyModeMessage = memo(StudyModeMessageImpl);
