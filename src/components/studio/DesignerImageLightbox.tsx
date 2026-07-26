import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, ChevronRight, FolderPlus, Loader2, Smartphone, X } from 'lucide-react';
import { renderFileName, saveImagesToDevice } from './saveImageToDevice';

export type LightboxImage = {
  url: string;
  label?: string;
};

type DesignerImageLightboxProps = {
  images: LightboxImage[];
  /** Index to open on. Pass null to close. */
  startIndex: number | null;
  onClose: () => void;
  language: 'en' | 'ar';
  /** Optional: offer "save as project" from inside the viewer too, so the action is reachable
   *  without closing it first. Omit it where the images are already saved. */
  onSaveProject?: () => void;
  isSavingProject?: boolean;
  isSavedProject?: boolean;
};

/**
 * Full-screen image viewer for the Designer.
 *
 * Two things here are deliberate and must not be "simplified" away:
 *  - It renders through a portal into document.body at z-[1100]. The app header is fixed at
 *    z-[990] and is itself portaled to body, so anything less than that gets covered and the
 *    close button becomes unreachable.
 *  - It pushes a history entry on open, so the phone's back gesture and the wrapper's back
 *    button close the viewer instead of navigating away from the Designer entirely.
 */
export default function DesignerImageLightbox({
  images,
  startIndex,
  onClose,
  language,
  onSaveProject,
  isSavingProject = false,
  isSavedProject = false,
}: DesignerImageLightboxProps) {
  const isArabic = language === 'ar';
  const isOpen = startIndex !== null && images.length > 0;
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  // Tracks whether OUR history entry is still on the stack, so closing does not pop
  // somebody else's entry and throw the user out of the page.
  const pushedHistoryRef = useRef(false);
  // Callers pass an inline arrow, so onClose gets a new identity on every render. Keeping
  // it in a ref lets the history effect depend on the open state alone — otherwise it would
  // re-run constantly and push a fresh history entry each time.
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (startIndex === null) return;
    setIndex(Math.min(Math.max(startIndex, 0), Math.max(images.length - 1, 0)));
  }, [startIndex, images.length]);

  const close = useCallback(() => {
    if (pushedHistoryRef.current) {
      pushedHistoryRef.current = false;
      // Triggers popstate, which calls onClose for us.
      window.history.back();
      return;
    }
    onCloseRef.current();
  }, []);

  const showPrevious = useCallback(() => {
    setIndex((current) => (current - 1 + images.length) % images.length);
  }, [images.length]);

  const showNext = useCallback(() => {
    setIndex((current) => (current + 1) % images.length);
  }, [images.length]);

  // Back gesture / hardware back closes the viewer instead of leaving the Designer.
  useEffect(() => {
    if (!isOpen) return;
    window.history.pushState({ waktiDesignerLightbox: true }, '');
    pushedHistoryRef.current = true;

    const handlePopState = () => {
      pushedHistoryRef.current = false;
      onCloseRef.current();
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // Closed by button rather than by back: clean our entry off the stack.
      if (pushedHistoryRef.current) {
        pushedHistoryRef.current = false;
        window.history.back();
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      else if (event.key === 'ArrowLeft') showPrevious();
      else if (event.key === 'ArrowRight') showNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, close, showPrevious, showNext]);

  // Stop the page behind from scrolling while the viewer is up.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const current = images[index];
  if (!current) return null;

  const saveToPhone = () => saveImagesToDevice([{
    url: current.url,
    fileName: renderFileName(current.label || '', index + 1),
  }]);

  const actionButtonClass = 'inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl px-3 text-xs font-extrabold text-white transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isArabic ? 'عرض الصورة' : 'Image viewer'}
      className="fixed inset-0 z-[1100] flex flex-col bg-black/95"
      onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        if (start === null) return;
        const delta = (event.changedTouches[0]?.clientX ?? start) - start;
        if (Math.abs(delta) < 50 || images.length < 2) return;
        if (delta > 0) showPrevious();
        else showNext();
      }}
    >
      {/* One close control only. A back arrow next to an X that did the same thing was
          just confusing. The phone's back gesture still closes this too. */}
      <div
        className="flex items-center justify-between gap-2 px-3 pb-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <div className="min-w-0 flex-1 text-start">
          {current.label && (
            <p className="truncate text-sm font-bold text-white">{current.label}</p>
          )}
          {images.length > 1 && (
            <p className="text-[10px] font-semibold text-white/60">{index + 1} / {images.length}</p>
          )}
        </div>

        <button
          type="button"
          onClick={close}
          aria-label={isArabic ? 'إغلاق' : 'Close'}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30 active:scale-95"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4">
        <img
          key={current.url}
          src={current.url}
          alt={current.label || (isArabic ? 'معاينة' : 'Preview')}
          className="max-h-full max-w-full rounded-xl object-contain"
        />

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={showPrevious}
              aria-label={isArabic ? 'الصورة السابقة' : 'Previous image'}
              className="absolute start-2 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80 active:scale-95"
            >
              <ChevronLeft className="h-7 w-7 rtl:rotate-180" />
            </button>
            <button
              type="button"
              onClick={showNext}
              aria-label={isArabic ? 'الصورة التالية' : 'Next image'}
              className="absolute end-2 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80 active:scale-95"
            >
              <ChevronRight className="h-7 w-7 rtl:rotate-180" />
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex items-center justify-center gap-2 pb-3">
          {images.map((image, dotIndex) => (
            <button
              key={image.url}
              type="button"
              onClick={() => setIndex(dotIndex)}
              aria-label={image.label || `${dotIndex + 1}`}
              className={`h-2 rounded-full transition-all ${dotIndex === index ? 'w-6 bg-white' : 'w-2 bg-white/40'}`}
            />
          ))}
        </div>
      )}

      {/* Both save actions live in here as well, because the buttons on the page behind are
          unreachable while this overlay is up. */}
      <div className="flex items-center gap-2 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
        <button
          type="button"
          onClick={saveToPhone}
          className={`${actionButtonClass} border border-white/25 bg-white/15 backdrop-blur hover:bg-white/25`}
        >
          <Smartphone className="h-4 w-4" />
          {isArabic ? 'حفظ في الهاتف' : 'Save to phone'}
        </button>

        {onSaveProject && (
          <button
            type="button"
            onClick={onSaveProject}
            disabled={isSavingProject || isSavedProject}
            className={`${actionButtonClass} bg-gradient-to-r from-sky-500 to-indigo-600 shadow-[0_4px_14px_hsla(210,100%,65%,0.45)] hover:brightness-110`}
          >
            {isSavingProject
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : isSavedProject
                ? <Check className="h-4 w-4" />
                : <FolderPlus className="h-4 w-4" />}
            {isSavingProject
              ? (isArabic ? 'جاري الحفظ...' : 'Saving...')
              : isSavedProject
                ? (isArabic ? 'محفوظ' : 'Saved')
                : (isArabic ? 'حفظ كمشروع' : 'Save as project')}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
