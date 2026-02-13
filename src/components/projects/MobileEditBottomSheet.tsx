import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, Type, Palette, Wand2, Send, ChevronRight,
  Image as ImageIcon, Undo2, Redo2, ArrowUp,
  Bold, Italic, AlignLeft, AlignCenter, AlignRight,
  Minus, Plus, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WAKTI_COLOR_PALETTE } from '@/pages/ProjectDetail/types/visual-edit';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SelectedElementInfo {
  tagName: string;
  className: string;
  id: string;
  innerText: string;
  openingTag: string;
  computedStyle?: {
    color: string;
    backgroundColor: string;
    fontSize: string;
  };
  rect?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  breadcrumb?: string[];
}

type BottomSheetTab = 'text' | 'style' | 'ai';

interface MobileEditBottomSheetProps {
  element: SelectedElementInfo;
  onClose: () => void;
  onDirectEdit: (changes: Record<string, string | undefined>) => void;
  onAIEdit: (prompt: string) => void;
  onImageChange?: () => void;
  onSelectParent?: () => void;
  onInlineTextSave?: (newText: string) => void;
  isRTL?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isTextElement = (tagName: string) => {
  const textTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'button', 'label', 'li', 'td', 'th', 'div'];
  return textTags.includes(tagName.toLowerCase());
};

const isImageElement = (tagName: string, className: string = '') => {
  const imageTags = ['img', 'svg', 'picture', 'video'];
  const hasImageClass = /\b(image|img|photo|picture|thumbnail|avatar|banner|hero|bg|background)\b/i.test(className);
  return imageTags.includes(tagName.toLowerCase()) || hasImageClass;
};

const parseFontSize = (size: string): number => {
  const match = size?.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 16;
};

const getQuickPrompts = (element: SelectedElementInfo, isRTL: boolean): string[] => {
  const tag = element.tagName.toLowerCase();
  const className = element.className || '';

  if (isImageElement(tag, className)) {
    return isRTL
      ? ['غير الصورة', 'اجعلها دائرية', 'أضف ظل', 'أضف hover']
      : ['Change image', 'Make rounded', 'Add shadow', 'Add hover'];
  }
  if (tag === 'button' || tag === 'a' || /btn|button|cta/i.test(className)) {
    return isRTL
      ? ['أضف hover', 'اجعله gradient', 'غير الحجم', 'أضف أيقونة']
      : ['Add hover', 'Make gradient', 'Change size', 'Add icon'];
  }
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
    return isRTL
      ? ['اجعله أكبر', 'أضف gradient', 'أضف تحريك', 'غير الخط']
      : ['Make bigger', 'Add gradient', 'Add animation', 'Change font'];
  }
  if (/hero|banner/i.test(className)) {
    return isRTL
      ? ['غير الخلفية', 'أضف parallax', 'أضف تحريك', 'غير النص']
      : ['Change background', 'Add parallax', 'Add animation', 'Change text'];
  }
  if (/card|tile/i.test(className)) {
    return isRTL
      ? ['أضف hover', 'أضف ظل', 'غير الحدود', 'غير التخطيط']
      : ['Add hover', 'Add shadow', 'Change border', 'Change layout'];
  }
  return isRTL
    ? ['غير اللون', 'اجعله أكبر', 'أضف ظل', 'أضف تحريك']
    : ['Change color', 'Make bigger', 'Add shadow', 'Add animation'];
};

// ─── Color Swatch Grid ──────────────────────────────────────────────────────

const QUICK_COLORS = [
  '#ffffff', '#000000', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#0c0f14', '#6366f1',
  '#06b6d4', '#10b981', '#f43f5e', '#4f46e5',
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function MobileEditBottomSheet({
  element,
  onClose,
  onDirectEdit,
  onAIEdit,
  onImageChange,
  onSelectParent,
  onInlineTextSave,
  isRTL = false,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}: MobileEditBottomSheetProps) {
  const showText = isTextElement(element.tagName);
  const showImage = isImageElement(element.tagName, element.className);
  const defaultTab: BottomSheetTab = showText ? 'text' : 'style';

  const [activeTab, setActiveTab] = useState<BottomSheetTab>(defaultTab);
  const [editText, setEditText] = useState(element.innerText || '');
  const [aiPrompt, setAiPrompt] = useState('');
  const [fontSize, setFontSize] = useState(parseFontSize(element.computedStyle?.fontSize || '16px'));
  const [isExpanded, setIsExpanded] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ startY: 0, startHeight: 0, isDragging: false });

  // Animate in
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  // Drag handle for expanding/collapsing
  const handleDragStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragRef.current = {
      startY: touch.clientY,
      startHeight: sheetRef.current?.offsetHeight || 0,
      isDragging: true,
    };
  }, []);

  const handleDragMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current.isDragging) return;
    const touch = e.touches[0];
    const delta = dragRef.current.startY - touch.clientY;
    // If dragged up more than 60px, expand
    if (delta > 60 && !isExpanded) {
      setIsExpanded(true);
      dragRef.current.isDragging = false;
    }
    // If dragged down more than 60px, collapse or close
    if (delta < -60) {
      if (isExpanded) {
        setIsExpanded(false);
      } else {
        handleClose();
      }
      dragRef.current.isDragging = false;
    }
  }, [isExpanded, handleClose]);

  const handleDragEnd = useCallback(() => {
    dragRef.current.isDragging = false;
  }, []);

  // Apply text change
  const handleTextSave = useCallback(() => {
    if (editText !== element.innerText && onInlineTextSave) {
      onInlineTextSave(editText);
    }
  }, [editText, element.innerText, onInlineTextSave]);

  // Apply font size change
  const handleFontSizeChange = useCallback((newSize: number) => {
    setFontSize(newSize);
    onDirectEdit({ fontSize: `${newSize}px` });
  }, [onDirectEdit]);

  // Send AI prompt
  const handleAISend = useCallback(() => {
    if (!aiPrompt.trim()) return;
    onAIEdit(aiPrompt.trim());
    setAiPrompt('');
    handleClose();
  }, [aiPrompt, onAIEdit, handleClose]);

  // Element label for header
  const elementLabel = (() => {
    const tag = element.tagName.toLowerCase();
    if (element.innerText) {
      const preview = element.innerText.substring(0, 25);
      return `${tag} "${preview}${element.innerText.length > 25 ? '…' : ''}"`;
    }
    return tag;
  })();

  const tabs: { id: BottomSheetTab; label: string; labelAr: string; icon: React.ReactNode }[] = [
    ...(showText ? [{ id: 'text' as BottomSheetTab, label: 'Text', labelAr: 'نص', icon: <Type className="h-4 w-4" /> }] : []),
    { id: 'style' as BottomSheetTab, label: 'Style', labelAr: 'ستايل', icon: <Palette className="h-4 w-4" /> },
    { id: 'ai' as BottomSheetTab, label: 'AI Edit', labelAr: 'تعديل AI', icon: <Wand2 className="h-4 w-4" /> },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-[400] transition-opacity duration-200",
          visible ? "bg-black/30" : "bg-transparent pointer-events-none"
        )}
        onClick={handleClose}
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          "fixed bottom-0 left-0 right-0 z-[401] transition-transform duration-200 ease-out",
          "bg-[#0c0f14] border-t border-white/10 rounded-t-2xl",
          "safe-area-bottom",
          visible ? "translate-y-0" : "translate-y-full",
          isExpanded ? "max-h-[85vh]" : "max-h-[55vh]"
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Drag Handle */}
        <div
          className="flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing"
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header: Element label + Undo/Redo + Close */}
        <div className={cn("flex items-center justify-between px-4 pb-2", isRTL && "flex-row-reverse")}>
          <div className={cn("flex items-center gap-2 flex-1 min-w-0", isRTL && "flex-row-reverse")}>
            {/* Breadcrumb / Parent nav */}
            {onSelectParent && (
              <button
                onClick={onSelectParent}
                className="flex-shrink-0 p-1.5 rounded-lg bg-white/5 active:bg-white/10 transition-colors"
                title={isRTL ? 'اختر العنصر الأب' : 'Select parent'}
              >
                <ArrowUp className="h-4 w-4 text-white/60" />
              </button>
            )}
            <span className={cn("text-xs text-white/50 truncate font-mono", isRTL && "text-right")}>
              {element.breadcrumb?.join(' › ') || elementLabel}
            </span>
          </div>

          <div className={cn("flex items-center gap-1 flex-shrink-0", isRTL && "flex-row-reverse")}>
            {canUndo && onUndo && (
              <button onClick={onUndo} className="p-2 rounded-lg active:bg-white/10 transition-colors" title={isRTL ? 'تراجع' : 'Undo'}>
                <Undo2 className="h-4 w-4 text-white/60" />
              </button>
            )}
            {canRedo && onRedo && (
              <button onClick={onRedo} className="p-2 rounded-lg active:bg-white/10 transition-colors" title={isRTL ? 'إعادة' : 'Redo'}>
                <Redo2 className="h-4 w-4 text-white/60" />
              </button>
            )}
            <button onClick={handleClose} className="p-2 rounded-lg active:bg-white/10 transition-colors" title={isRTL ? 'إغلاق' : 'Close'}>
              <X className="h-4 w-4 text-white/60" />
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className={cn("flex gap-1 px-4 pb-3", isRTL && "flex-row-reverse")}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95",
                activeTab === tab.id
                  ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                  : "bg-white/5 text-white/50 border border-transparent"
              )}
            >
              {tab.icon}
              {isRTL ? tab.labelAr : tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className={cn("px-4 pb-4 overflow-y-auto", isExpanded ? "max-h-[65vh]" : "max-h-[35vh]")}>

          {/* ─── TEXT TAB ─── */}
          {activeTab === 'text' && showText && (
            <div className="space-y-4">
              {/* Text editor */}
              <div>
                <label className={cn("text-xs font-medium text-white/40 mb-1.5 block", isRTL && "text-right")}>
                  {isRTL ? 'تعديل النص' : 'Edit Text'}
                </label>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className={cn(
                    "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/30",
                    "resize-none min-h-[60px] max-h-[120px]",
                    isRTL && "text-right"
                  )}
                  rows={2}
                  dir={isRTL ? 'rtl' : 'ltr'}
                  placeholder={isRTL ? 'عدّل النص هنا...' : 'Edit text here...'}
                />
                {editText !== element.innerText && (
                  <button
                    onClick={handleTextSave}
                    className={cn(
                      "mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium",
                      "bg-indigo-500 text-white active:scale-95 transition-transform",
                      isRTL && "flex-row-reverse"
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {isRTL ? 'تطبيق' : 'Apply'}
                  </button>
                )}
              </div>

              {/* Font size */}
              <div>
                <label className={cn("text-xs font-medium text-white/40 mb-1.5 block", isRTL && "text-right")}>
                  {isRTL ? 'حجم الخط' : 'Font Size'}
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleFontSizeChange(Math.max(8, fontSize - 2))}
                    className="p-2.5 rounded-xl bg-white/5 active:bg-white/10 transition-colors"
                    title={isRTL ? 'تصغير' : 'Decrease'}
                  >
                    <Minus className="h-4 w-4 text-white/60" />
                  </button>
                  <span className="text-white text-lg font-mono min-w-[3ch] text-center">{fontSize}</span>
                  <button
                    onClick={() => handleFontSizeChange(Math.min(120, fontSize + 2))}
                    className="p-2.5 rounded-xl bg-white/5 active:bg-white/10 transition-colors"
                    title={isRTL ? 'تكبير' : 'Increase'}
                  >
                    <Plus className="h-4 w-4 text-white/60" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── STYLE TAB ─── */}
          {activeTab === 'style' && (
            <div className="space-y-4">
              {/* Text Color */}
              <div>
                <label className={cn("text-xs font-medium text-white/40 mb-2 block", isRTL && "text-right")}>
                  {isRTL ? 'لون النص' : 'Text Color'}
                </label>
                <div className="grid grid-cols-8 gap-2">
                  {QUICK_COLORS.map((color) => (
                    <button
                      key={`tc-${color}`}
                      onClick={() => onDirectEdit({ color })}
                      className={cn(
                        "w-8 h-8 rounded-lg border-2 transition-transform active:scale-90",
                        element.computedStyle?.color === color ? "border-indigo-400 scale-110" : "border-white/10"
                      )}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {/* Background Color */}
              <div>
                <label className={cn("text-xs font-medium text-white/40 mb-2 block", isRTL && "text-right")}>
                  {isRTL ? 'لون الخلفية' : 'Background'}
                </label>
                <div className="grid grid-cols-8 gap-2">
                  {QUICK_COLORS.map((color) => (
                    <button
                      key={`bg-${color}`}
                      onClick={() => onDirectEdit({ backgroundColor: color })}
                      className={cn(
                        "w-8 h-8 rounded-lg border-2 transition-transform active:scale-90",
                        element.computedStyle?.backgroundColor === color ? "border-indigo-400 scale-110" : "border-white/10"
                      )}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {/* Change Image button (for image elements) */}
              {showImage && onImageChange && (
                <button
                  onClick={() => { onImageChange(); handleClose(); }}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl",
                    "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30",
                    "active:scale-95 transition-transform text-sm font-medium",
                    isRTL && "flex-row-reverse"
                  )}
                >
                  <ImageIcon className="h-4 w-4" />
                  {isRTL ? 'غير الصورة' : 'Change Image'}
                </button>
              )}
            </div>
          )}

          {/* ─── AI TAB ─── */}
          {activeTab === 'ai' && (
            <div className="space-y-3">
              {/* Quick prompts */}
              <div className={cn("flex flex-wrap gap-2", isRTL && "flex-row-reverse")}>
                {getQuickPrompts(element, isRTL).map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      onAIEdit(prompt);
                      handleClose();
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium",
                      "bg-white/5 text-white/70 border border-white/10",
                      "active:scale-95 active:bg-indigo-500/20 active:text-indigo-400 active:border-indigo-500/30",
                      "transition-all"
                    )}
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Custom AI prompt input */}
              <div className={cn("flex items-end gap-2", isRTL && "flex-row-reverse")}>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder={isRTL ? 'اكتب تعديلك هنا...' : 'Describe your edit...'}
                  className={cn(
                    "flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/30",
                    "resize-none min-h-[44px] max-h-[100px] placeholder:text-white/30",
                    isRTL && "text-right"
                  )}
                  rows={1}
                  dir={isRTL ? 'rtl' : 'ltr'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAISend();
                    }
                  }}
                />
                <button
                  onClick={handleAISend}
                  disabled={!aiPrompt.trim()}
                  className={cn(
                    "flex-shrink-0 p-3 rounded-xl transition-all active:scale-90",
                    aiPrompt.trim()
                      ? "bg-indigo-500 text-white"
                      : "bg-white/5 text-white/20"
                  )}
                  title={isRTL ? 'إرسال' : 'Send'}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
