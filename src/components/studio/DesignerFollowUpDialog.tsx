import React from 'react';
import { Ruler, Sparkles, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DesignerFormAnswers, DesignerFormField } from './designerFollowUp';

type DesignerFollowUpDialogProps = {
  open: boolean;
  language: 'en' | 'ar';
  fields: DesignerFormField[];
  answers: DesignerFormAnswers;
  isBusy: boolean;
  requestPreview: string;
  onAnswerChange: (fieldId: string, value: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
  onClose: () => void;
};

export default function DesignerFollowUpDialog({
  open,
  language,
  fields,
  answers,
  isBusy,
  requestPreview,
  onAnswerChange,
  onSubmit,
  onSkip,
  onClose,
}: DesignerFollowUpDialogProps) {
  const isArabic = language === 'ar';
  const groups = Array.from(new Set(fields.map((field) => field.group)));

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent
        dir={isArabic ? 'rtl' : 'ltr'}
        className="max-h-[88vh] max-w-2xl overflow-hidden border-[#d9e7f5] bg-[#fcfefd] p-0 dark:border-sky-300/15 dark:bg-[#0c0f14]"
      >
        <DialogHeader className="space-y-2 border-b border-[#e4eef8] px-5 py-4 text-start dark:border-sky-300/10">
          <DialogTitle className="flex items-center gap-2 text-base font-extrabold text-foreground">
            <Sparkles className="h-4 w-4 text-sky-600 dark:text-sky-300" />
            {isArabic ? 'قبل ما أرسم، أحتاج تفاصيل بسيطة' : 'Before I draw, I need a few details'}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-[#53627a] dark:text-muted-foreground">
            {isArabic
              ? 'هذه الأسئلة مبنية على طلبك، وكل إجابة تجعل المخطط أدق وأبواب الغرف في مكانها الصحيح.'
              : 'These questions come from your own request. Every answer makes the plan sharper and the doors land in the right place.'}
          </DialogDescription>
          {requestPreview && (
            <p className="rounded-lg border border-[#e4eef8] bg-white px-3 py-2 text-[11px] leading-relaxed text-[#53627a] dark:border-sky-300/10 dark:bg-black/25 dark:text-muted-foreground">
              {isArabic ? 'طلبك: ' : 'Your request: '}
              {requestPreview}
            </p>
          )}
        </DialogHeader>

        <div className="max-h-[52vh] space-y-5 overflow-y-auto px-5 py-4">
          {groups.map((group) => (
            <section key={group} className="space-y-3">
              <div className="flex items-center gap-2">
                <Ruler className="h-3.5 w-3.5 text-sky-600 dark:text-sky-300" />
                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-200">{group}</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {fields.filter((field) => field.group === group).map((field) => {
                  const value = answers[field.id] ?? field.defaultValue;
                  return (
                    <label key={field.id} className="block space-y-1.5 text-start">
                      <span className="block text-[11px] font-semibold text-foreground">
                        {field.label}
                        {field.unit ? <span className="ms-1 text-[10px] font-normal text-muted-foreground">({field.unit})</span> : null}
                      </span>

                      {field.kind === 'number' && (
                        <input
                          type="number"
                          inputMode="decimal"
                          min={field.min}
                          max={field.max}
                          value={value}
                          onChange={(event) => onAnswerChange(field.id, event.currentTarget.value)}
                          className="w-full rounded-lg border border-[#d9e7f5] bg-white px-3 py-2 text-xs text-[#31405a] outline-none transition focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20 dark:border-sky-300/15 dark:bg-black/25 dark:text-foreground"
                        />
                      )}

                      {field.kind === 'select' && (
                        <select
                          value={value}
                          onChange={(event) => onAnswerChange(field.id, event.currentTarget.value)}
                          className="w-full rounded-lg border border-[#d9e7f5] bg-white px-3 py-2 text-xs text-[#31405a] outline-none transition focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20 dark:border-sky-300/15 dark:bg-black/25 dark:text-foreground"
                        >
                          {(field.options || []).map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      )}

                      {field.kind === 'toggle' && (
                        <div className="flex gap-2">
                          {[
                            { value: 'yes', label: isArabic ? 'نعم' : 'Yes' },
                            { value: 'no', label: isArabic ? 'لا' : 'No' },
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => onAnswerChange(field.id, option.value)}
                              className={`flex-1 rounded-lg border px-3 py-2 text-[11px] font-bold transition ${
                                value === option.value
                                  ? 'border-sky-500 bg-sky-500 text-white dark:border-sky-400 dark:bg-sky-400 dark:text-[#060541]'
                                  : 'border-[#d9e7f5] bg-white text-[#53627a] hover:border-sky-300 dark:border-sky-300/15 dark:bg-black/25 dark:text-muted-foreground'
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {field.hint && (
                        <span className="block text-[10px] leading-relaxed text-muted-foreground">{field.hint}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e4eef8] px-5 py-4 dark:border-sky-300/10">
          <button
            type="button"
            onClick={onSkip}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#d9e7f5] px-3 py-2 text-[11px] font-bold text-[#53627a] transition hover:border-sky-300 disabled:opacity-50 dark:border-sky-300/15 dark:text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" />
            {isArabic ? 'تخطى واستخدم افتراضاتي' : 'Skip and use my assumptions'}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isBusy}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-400 dark:text-[#060541]"
          >
            <Sparkles className="h-4 w-4" />
            {isBusy
              ? (isArabic ? 'أرسم المخطط...' : 'Drawing the plan...')
              : (isArabic ? 'أنشئ المخطط' : 'Generate the plan')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
