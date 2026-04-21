import React from 'react';
import { ChevronLeft, ImageIcon, Loader2 } from 'lucide-react';
import type { SlideOutline } from '../types';

interface OutlineStepProps {
  language: 'en' | 'ar';
  outline: SlideOutline[];
  onBack: () => void;
  handleGenerateSlides: () => void;
  isLoading: boolean;
}

const OutlineStep: React.FC<OutlineStepProps> = ({
  language,
  outline,
  onBack,
  handleGenerateSlides,
  isLoading,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {language === 'ar' ? 'رجوع' : 'Back'}
        </button>
        <h2 className="text-lg font-semibold">
          {language === 'ar' ? 'مخطط الشرائح' : 'Slide Outline'}
        </h2>
        <div className="w-16" />
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
        {outline.map((slide, i) => (
          <div
            key={i}
            className="p-4 rounded-xl border bg-card hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                {slide.slideNumber}
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm">{slide.title}</h3>
                <ul className="mt-1 space-y-0.5">
                  {slide.bullets.map((b, j) => (
                    <li key={j} className="text-xs text-muted-foreground flex items-start gap-1">
                      <span className="text-primary">•</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          onClick={handleGenerateSlides}
          disabled={isLoading}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#060541] to-[#0a0a6b] text-white font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {language === 'ar' ? 'جارٍ إنشاء الشرائح...' : 'Creating Slides...'}
            </>
          ) : (
            <>
              <ImageIcon className="w-4 h-4" />
              {language === 'ar' ? 'إنشاء الشرائح' : 'Create Slides'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default OutlineStep;
