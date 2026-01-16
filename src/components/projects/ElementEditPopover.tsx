import React, { useState, useCallback } from 'react';
import { 
  X, Type, Wand2, Check, ChevronRight, ChevronDown, ChevronUp,
  Image as ImageIcon, Link2, Square, Circle, ArrowRight, ArrowDown,
  AlignStartVertical, AlignCenterVertical, 
  AlignEndVertical, Maximize2, Move, LayoutGrid, ChevronUpSquare,
  Edit3, MousePointer2, Undo2, Redo2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ColorPickerPopover } from '@/pages/ProjectDetail/components/VisualEditMode/ColorPickerPopover';
import { ResizeHandles } from '@/pages/ProjectDetail/components/VisualEditMode/ResizeHandles';
import { InlineTextEditor } from '@/pages/ProjectDetail/components/VisualEditMode/InlineTextEditor';
import type { SelectedElementInfo as VisualEditElementInfo, ResizeDimensions } from '@/pages/ProjectDetail/types/visual-edit';

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
}

interface ElementEditPopoverProps {
  element: SelectedElementInfo;
  onClose: () => void;
  onDirectEdit: (changes: Record<string, string | undefined>) => void;
  onAIEdit: (prompt: string) => void;
  onImageChange?: () => void;
  onSelectParent?: () => void;
  onResize?: (dimensions: ResizeDimensions) => void;
  onInlineTextSave?: (newText: string) => void;
  isRTL?: boolean;
  showResizeHandles?: boolean;
  // Undo/Redo support
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

// Helper to check if element contains editable text
const isTextElement = (tagName: string) => {
  const textTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'button', 'label', 'li', 'td', 'th', 'div'];
  return textTags.includes(tagName.toLowerCase());
};

// Helper to check if element is an image
const isImageElement = (tagName: string, className: string = '') => {
  const imageTags = ['img', 'svg', 'picture', 'video'];
  const hasImageClass = /\b(image|img|photo|picture|thumbnail|avatar|banner|hero|bg|background)\b/i.test(className);
  return imageTags.includes(tagName.toLowerCase()) || hasImageClass;
};

// Helper to get context-aware quick prompts based on element type and context
const getContextAwarePrompts = (element: SelectedElementInfo, isRTL: boolean): string[] => {
  const tag = element.tagName.toLowerCase();
  const className = element.className || '';
  const openingTag = element.openingTag || '';
  
  if (/carousel|slider|swiper|slick|embla/i.test(className) || /carousel|slider/i.test(openingTag)) {
    return isRTL 
      ? ['غير الصور', 'أضف مؤشرات', 'أضف تشغيل تلقائي', 'أضف أسهم']
      : ['Change images', 'Add indicators', 'Add autoplay', 'Add arrows'];
  }
  
  if (/gallery|grid.*image|photo.*grid/i.test(className)) {
    return isRTL 
      ? ['غير الصور', 'أضف lightbox', 'غير التخطيط', 'أضف فلتر']
      : ['Change images', 'Add lightbox', 'Change layout', 'Add filter'];
  }
  
  if (/hero|banner|jumbotron|landing/i.test(className) || tag === 'section' && /hero|banner/i.test(openingTag)) {
    return isRTL 
      ? ['غير الخلفية', 'أضف تأثير parallax', 'أضف تحريك', 'غير النص']
      : ['Change background', 'Add parallax', 'Add animation', 'Change text'];
  }
  
  if (/card|tile|item/i.test(className)) {
    return isRTL 
      ? ['أضف hover effect', 'أضف ظل', 'غير الحدود', 'غير التخطيط']
      : ['Add hover effect', 'Add shadow', 'Change border', 'Change layout'];
  }

  if (isImageElement(tag, className)) {
    return isRTL 
      ? ['غير الصورة', 'أضف تأثير hover', 'اجعلها دائرية', 'أضف ظل']
      : ['Change image', 'Add hover effect', 'Make rounded', 'Add shadow'];
  }
  
  if (tag === 'button' || tag === 'a' || /btn|button|cta/i.test(className)) {
    return isRTL
      ? ['أضف تأثير hover', 'اجعله gradient', 'أضف أيقونة', 'غير الحجم']
      : ['Add hover effect', 'Make gradient', 'Add icon', 'Change size'];
  }
  
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
    return isRTL
      ? ['اجعله أكبر', 'أضف gradient للنص', 'أضف تحريك', 'غير اللون']
      : ['Make bigger', 'Add text gradient', 'Add animation', 'Change color'];
  }
  
  if (/nav|menu|header/i.test(className) || tag === 'nav') {
    return isRTL
      ? ['أضف قائمة موبايل', 'أضف hover effect', 'غير الخلفية', 'أضف ظل']
      : ['Add mobile menu', 'Add hover effect', 'Change background', 'Add shadow'];
  }
  
  if (tag === 'form' || /form/i.test(className)) {
    return isRTL
      ? ['أضف تحقق', 'أضف رسائل خطأ', 'غير الستايل', 'أضف أيقونات']
      : ['Add validation', 'Add error messages', 'Change style', 'Add icons'];
  }
  
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return isRTL
      ? ['غير الستايل', 'أضف أيقونة', 'أضف focus effect', 'اجعله أكبر']
      : ['Change style', 'Add icon', 'Add focus effect', 'Make bigger'];
  }
  
  if (/footer/i.test(className) || tag === 'footer') {
    return isRTL
      ? ['أضف روابط', 'غير التخطيط', 'أضف أيقونات اجتماعية', 'غير الخلفية']
      : ['Add links', 'Change layout', 'Add social icons', 'Change background'];
  }
  
  if (tag === 'div' || tag === 'section' || tag === 'article') {
    return isRTL
      ? ['غير الخلفية', 'أضف حدود', 'أضف ظل', 'أضف padding']
      : ['Change background', 'Add border', 'Add shadow', 'Add padding'];
  }
  
  return isRTL 
    ? ['اجعله أكبر', 'غير اللون', 'أضف أيقونة', 'غير الخط']
    : ['Make bigger', 'Change color', 'Add icon', 'Change font'];
};

// Helper to parse font size
const parseFontSize = (size: string): number => {
  const match = size?.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 16;
};

// Color presets matching Lovable's design
const colorPresets = [
  { color: 'transparent', label: 'Inherit' },
  { color: '#000000', label: 'Black' },
  { color: '#ffffff', label: 'White' },
  { color: '#ef4444', label: 'Red' },
  { color: '#f97316', label: 'Orange' },
  { color: '#eab308', label: 'Yellow' },
  { color: '#22c55e', label: 'Green' },
  { color: '#3b82f6', label: 'Blue' },
  { color: '#8b5cf6', label: 'Purple' },
  { color: '#ec4899', label: 'Pink' },
  { color: '#6b7280', label: 'Gray' },
];

// Font family presets
const fontPresets = [
  { value: 'inherit', label: 'Default' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Roboto, sans-serif', label: 'Roboto' },
  { value: 'Poppins, sans-serif', label: 'Poppins' },
  { value: 'Playfair Display, serif', label: 'Playfair' },
  { value: 'Montserrat, sans-serif', label: 'Montserrat' },
  { value: 'Open Sans, sans-serif', label: 'Open Sans' },
  { value: 'Lato, sans-serif', label: 'Lato' },
  { value: 'Cairo, sans-serif', label: 'Cairo (Arabic)' },
  { value: 'Tajawal, sans-serif', label: 'Tajawal (Arabic)' },
  { value: 'monospace', label: 'Monospace' },
];

// Border width options
const borderWidthOptions = [
  { value: '0', label: 'None' },
  { value: '1px', label: '1px' },
  { value: '2px', label: '2px' },
  { value: '3px', label: '3px' },
  { value: '4px', label: '4px' },
];

// Border style options
const borderStyleOptions = [
  { value: 'none', label: 'None' },
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'double', label: 'Double' },
];

// Border radius options
const borderRadiusOptions = [
  { value: '0', label: 'None' },
  { value: '4px', label: 'Small' },
  { value: '8px', label: 'Medium' },
  { value: '12px', label: 'Large' },
  { value: '16px', label: 'XL' },
  { value: '24px', label: '2XL' },
  { value: '9999px', label: 'Full' },
];

// Shadow options
const shadowOptions = [
  { value: 'none', label: 'None' },
  { value: '0 1px 2px rgba(0,0,0,0.05)', label: 'XS' },
  { value: '0 1px 3px rgba(0,0,0,0.1)', label: 'SM' },
  { value: '0 4px 6px rgba(0,0,0,0.1)', label: 'MD' },
  { value: '0 10px 15px rgba(0,0,0,0.1)', label: 'LG' },
  { value: '0 20px 25px rgba(0,0,0,0.1)', label: 'XL' },
  { value: '0 25px 50px rgba(0,0,0,0.25)', label: '2XL' },
];

// Opacity options
const opacityOptions = [
  { value: '1', label: '100%' },
  { value: '0.9', label: '90%' },
  { value: '0.75', label: '75%' },
  { value: '0.5', label: '50%' },
  { value: '0.25', label: '25%' },
  { value: '0.1', label: '10%' },
  { value: '0', label: '0%' },
];

// Spacing input component
const SpacingInput = ({ 
  value, 
  onChange, 
  icon 
}: { 
  value: string; 
  onChange: (v: string) => void; 
  icon: React.ReactNode;
}) => (
  <div className="flex items-center gap-1.5 bg-zinc-800 rounded-lg px-2 py-1.5">
    <span className="text-zinc-500">{icon}</span>
    <input
      type="number"
      value={parseInt(value) || 0}
      onChange={(e) => onChange(e.target.value)}
      className="w-10 bg-transparent text-white text-xs text-center outline-none"
      min="0"
    />
  </div>
);

// Section header component
const SectionHeader = ({ 
  title, 
  isOpen, 
  onClick 
}: { 
  title: string; 
  isOpen: boolean; 
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex items-center justify-between w-full py-2 text-sm font-semibold text-white hover:text-zinc-300 transition-colors"
  >
    {title}
    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
  </button>
);

// Enhanced Color picker row using ColorPickerPopover with inherit option
const ColorPickerRow = ({
  label,
  value,
  onChange,
  isRTL
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  isRTL: boolean;
}) => (
  <div className="space-y-2">
    <label className="text-xs text-zinc-400">{label}</label>
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange('inherit')}
        className={cn(
          "flex items-center gap-2 flex-1 px-3 py-2 rounded-lg text-xs transition-all",
          value === 'inherit' || value === 'transparent'
            ? "bg-indigo-500/20 border border-indigo-500/50 text-indigo-300"
            : "bg-zinc-800 border border-zinc-700 text-zinc-400 hover:border-zinc-600"
        )}
      >
        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800 border border-zinc-600" />
        {isRTL ? 'وراثة' : 'Inherit'}
      </button>
      <ColorPickerPopover
        color={value === 'inherit' || value === 'transparent' ? '#000000' : value}
        onChange={onChange}
        label={label}
        isRTL={isRTL}
      />
    </div>
  </div>
);

export const ElementEditPopover: React.FC<ElementEditPopoverProps> = ({
  element,
  onClose,
  onDirectEdit,
  onAIEdit,
  onImageChange,
  onSelectParent,
  onResize,
  onInlineTextSave,
  isRTL = false,
  showResizeHandles = false,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo
}) => {
  // Inline editing state
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  // Local state for edits
  const [editedText, setEditedText] = useState(element.innerText || '');
  const [editedColor, setEditedColor] = useState(element.computedStyle?.color || 'inherit');
  const [editedBgColor, setEditedBgColor] = useState(element.computedStyle?.backgroundColor || 'inherit');
  const [editedFontSize, setEditedFontSize] = useState(parseFontSize(element.computedStyle?.fontSize || '16px'));
  const [editedFontFamily, setEditedFontFamily] = useState('inherit');
  const [aiPrompt, setAiPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  
  // Spacing state
  const [marginX, setMarginX] = useState('0');
  const [marginY, setMarginY] = useState('0');
  const [paddingX, setPaddingX] = useState('0');
  const [paddingY, setPaddingY] = useState('0');
  const [gap, setGap] = useState('0');
  
  // Layout state
  const [flexDirection, setFlexDirection] = useState<'row' | 'column'>('column');
  const [alignItems, setAlignItems] = useState<string>('start');
  
  // Border state
  const [borderWidth, setBorderWidth] = useState('0');
  const [borderColor, setBorderColor] = useState('inherit');
  const [borderStyle, setBorderStyle] = useState('none');
  
  // Effects state
  const [borderRadius, setBorderRadius] = useState('0');
  const [shadow, setShadow] = useState('none');
  const [opacity, setOpacity] = useState('1');
  
  // Section visibility
  const [openSections, setOpenSections] = useState({
    colors: true,
    spacing: false,
    layout: false,
    border: false,
    effects: false,
    advanced: false
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  const isImage = isImageElement(element.tagName, element.className);
  const [activeTab, setActiveTab] = useState<'direct' | 'image' | 'ai'>(isImage ? 'image' : 'direct');
  
  const [modified, setModified] = useState<Record<string, boolean>>({});

  const showTextEdit = isTextElement(element.tagName) && element.innerText.trim().length > 0;

  const handleApplyDirectEdits = () => {
    const changes: Record<string, string | undefined> = {};
    
    if (modified.text && editedText !== element.innerText) changes.text = editedText;
    if (modified.color && editedColor !== 'inherit') changes.color = editedColor;
    if (modified.bgColor && editedBgColor !== 'inherit') changes.bgColor = editedBgColor;
    if (modified.fontSize) changes.fontSize = `${editedFontSize}px`;
    if (modified.fontFamily && editedFontFamily !== 'inherit') changes.fontFamily = editedFontFamily;
    
    // Spacing
    if (modified.marginX || modified.marginY) changes.margin = `${marginY}px ${marginX}px`;
    if (modified.paddingX || modified.paddingY) changes.padding = `${paddingY}px ${paddingX}px`;
    if (modified.gap) changes.gap = `${gap}px`;
    
    // Layout
    if (modified.flexDirection) changes.flexDirection = flexDirection;
    if (modified.alignItems) changes.alignItems = alignItems;
    
    // Border
    if (modified.borderWidth || modified.borderStyle || modified.borderColor) {
      changes.border = `${borderWidth} ${borderStyle} ${borderColor === 'inherit' ? 'currentColor' : borderColor}`;
    }
    
    // Effects
    if (modified.borderRadius) changes.borderRadius = borderRadius;
    if (modified.shadow) changes.boxShadow = shadow;
    if (modified.opacity) changes.opacity = opacity;
    
    if (Object.keys(changes).length > 0) {
      onDirectEdit(changes);
    }
    onClose();
  };

  const handleAISubmit = () => {
    if (aiPrompt.trim()) {
      onAIEdit(aiPrompt.trim());
    }
  };

  const setMod = (key: string) => setModified(m => ({ ...m, [key]: true }));

  // Handle inline text edit
  const handleStartInlineEdit = useCallback(() => {
    if (showTextEdit) {
      setIsInlineEditing(true);
    }
  }, [showTextEdit]);

  const handleSaveInlineEdit = useCallback((newText: string) => {
    if (onInlineTextSave) {
      onInlineTextSave(newText);
    } else {
      onDirectEdit({ text: newText });
    }
    setIsInlineEditing(false);
    onClose();
  }, [onInlineTextSave, onDirectEdit, onClose]);

  const handleCancelInlineEdit = useCallback(() => {
    setIsInlineEditing(false);
  }, []);

  // Handle resize
  const handleResize = useCallback((dimensions: ResizeDimensions) => {
    if (onResize) {
      onResize(dimensions);
    }
  }, [onResize]);

  // If inline editing, show the inline editor instead
  if (isInlineEditing && element.rect) {
    return (
      <InlineTextEditor
        element={{ ...element, rect: element.rect } as any}
        onSave={handleSaveInlineEdit}
        onCancel={handleCancelInlineEdit}
        isRTL={isRTL}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-4 md:p-8">
      {/* Resize Handles - shown when element has rect */}
      {showResizeHandles && element.rect && (
        <div 
          className="fixed z-[201] pointer-events-none"
          style={{
            top: element.rect.top,
            left: element.rect.left,
            width: element.rect.width,
            height: element.rect.height,
          }}
        >
          <div className="relative w-full h-full pointer-events-auto">
            <ResizeHandles 
              element={element as any}
              onResize={handleResize}
              onResizeEnd={handleResize}
            />
          </div>
        </div>
      )}
      
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Popover Content */}
      <div className={cn(
        "relative w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden",
        "animate-in slide-in-from-bottom-10 duration-300"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-800/50 border-b border-zinc-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <Wand2 className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  {isRTL ? 'تحرير مرئي' : 'Visual Edit'}
                </h3>
                {/* Parent selection button */}
                <button 
                  onClick={onSelectParent}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors"
                >
                  <ChevronUpSquare className="h-3 w-3" />
                  {isRTL ? 'الأب' : 'Parent'}
                </button>
                {/* Inline text edit button */}
                {showTextEdit && (
                  <button 
                    onClick={handleStartInlineEdit}
                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                    title={isRTL ? 'تحرير النص مباشرة' : 'Edit text inline'}
                  >
                    <Edit3 className="h-3 w-3" />
                    {isRTL ? 'تحرير' : 'Edit'}
                  </button>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 font-mono">
                &lt;{element.tagName.toLowerCase()}&gt;
                {element.className && <span className="text-indigo-400/70">.{element.className.split(' ')[0]?.substring(0, 15)}</span>}
              </p>
            </div>
          </div>
          {/* Undo/Redo buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={cn(
                "p-2 rounded-lg transition-colors",
                canUndo 
                  ? "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10" 
                  : "text-zinc-600 cursor-not-allowed"
              )}
              title={isRTL ? 'تراجع (Ctrl+Z)' : 'Undo (Ctrl+Z)'}
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={cn(
                "p-2 rounded-lg transition-colors",
                canRedo 
                  ? "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10" 
                  : "text-zinc-600 cursor-not-allowed"
              )}
              title={isRTL ? 'إعادة (Ctrl+Shift+Z)' : 'Redo (Ctrl+Shift+Z)'}
            >
              <Redo2 className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-zinc-700/50">
          <button
            onClick={() => setActiveTab('direct')}
            className={cn(
              "flex-1 py-2.5 text-xs font-medium transition-colors",
              activeTab === 'direct' 
                ? "text-white bg-zinc-800/50 border-b-2 border-indigo-500"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            {isRTL ? 'تعديل مباشر' : 'Direct Edit'}
          </button>
          
          {isImage && (
            <button
              onClick={() => setActiveTab('image')}
              className={cn(
                "flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5",
                activeTab === 'image' 
                  ? "text-white bg-zinc-800/50 border-b-2 border-emerald-500"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <ImageIcon className="h-3 w-3" />
              {isRTL ? 'صورة' : 'Image'}
            </button>
          )}
          
          <button
            onClick={() => setActiveTab('ai')}
            className={cn(
              "flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5",
              activeTab === 'ai' 
                ? "text-white bg-zinc-800/50 border-b-2 border-purple-500"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Wand2 className="h-3 w-3" />
            AI
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-1 max-h-[60vh] overflow-y-auto">
          {activeTab === 'direct' ? (
            <>
              {/* ===== TEXT CONTENT SECTION (Top Priority) ===== */}
              {showTextEdit && (
                <div className="mb-4 p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-white flex items-center gap-1.5">
                      <Edit3 className="h-3.5 w-3.5 text-emerald-400" />
                      {isRTL ? 'محتوى النص' : 'Text Content'}
                    </label>
                    <button
                      onClick={handleStartInlineEdit}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
                    >
                      <MousePointer2 className="h-3 w-3" />
                      {isRTL ? 'تحرير في المكان' : 'Edit in place'}
                    </button>
                  </div>
                  <textarea
                    value={editedText}
                    onChange={(e) => { setEditedText(e.target.value); setMod('text'); }}
                    placeholder={isRTL ? 'أدخل النص هنا...' : 'Enter text here...'}
                    className={cn(
                      "w-full min-h-[60px] px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg",
                      "text-sm text-white placeholder:text-zinc-500",
                      "focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50",
                      "resize-none transition-all",
                      isRTL && "text-right"
                    )}
                    dir={isRTL ? 'rtl' : 'ltr'}
                  />
                  <p className="mt-1.5 text-[10px] text-zinc-500">
                    {isRTL 
                      ? 'قم بتعديل النص مباشرة هنا أو اضغط "تحرير في المكان" للتحرير على العنصر'
                      : 'Edit text directly here or click "Edit in place" to edit on the element'}
                  </p>
                </div>
              )}

              {/* ===== COLORS SECTION ===== */}
              <Collapsible open={openSections.colors} onOpenChange={() => toggleSection('colors')}>
                <CollapsibleTrigger asChild>
                  <SectionHeader title={isRTL ? 'الألوان' : 'Colors'} isOpen={openSections.colors} onClick={() => {}} />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pb-4">
                  {/* Text Color */}
                  <ColorPickerRow
                    label={isRTL ? 'لون النص' : 'Text color'}
                    value={editedColor}
                    onChange={(v) => { setEditedColor(v); setMod('color'); }}
                    isRTL={isRTL}
                  />
                  
                  {/* Background Color */}
                  <ColorPickerRow
                    label={isRTL ? 'لون الخلفية' : 'Background color'}
                    value={editedBgColor}
                    onChange={(v) => { setEditedBgColor(v); setMod('bgColor'); }}
                    isRTL={isRTL}
                  />

                  {/* Font Size */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-zinc-400 flex items-center gap-1.5">
                        <Type className="h-3 w-3" />
                        {isRTL ? 'حجم الخط' : 'Font Size'}
                      </label>
                      <span className="text-xs text-white font-mono">{editedFontSize}px</span>
                    </div>
                    <Slider
                      value={[editedFontSize]}
                      onValueChange={([val]) => { setEditedFontSize(val); setMod('fontSize'); }}
                      min={8}
                      max={72}
                      step={1}
                      className="w-full"
                    />
                  </div>

                  {/* Font Family */}
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400 flex items-center gap-1.5">
                      <Type className="h-3 w-3" />
                      {isRTL ? 'نوع الخط' : 'Font Type'}
                    </label>
                    <Select value={editedFontFamily} onValueChange={(val) => { setEditedFontFamily(val); setMod('fontFamily'); }}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                        <SelectValue placeholder={isRTL ? 'اختر الخط' : 'Select font'} />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700 z-[250]">
                        {fontPresets.map((font) => (
                          <SelectItem 
                            key={font.value} 
                            value={font.value}
                            className="text-white hover:bg-zinc-700"
                            style={{ fontFamily: font.value !== 'inherit' ? font.value : undefined }}
                          >
                            {font.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* ===== SPACING SECTION ===== */}
              <Collapsible open={openSections.spacing} onOpenChange={() => toggleSection('spacing')}>
                <CollapsibleTrigger asChild>
                  <SectionHeader title={isRTL ? 'المسافات' : 'Spacing'} isOpen={openSections.spacing} onClick={() => {}} />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pb-4">
                  {/* Margin */}
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400">{isRTL ? 'الهامش' : 'Margin'}</label>
                    <div className="grid grid-cols-3 gap-2">
                      <SpacingInput 
                        value={marginX} 
                        onChange={(v) => { setMarginX(v); setMod('marginX'); }} 
                        icon={<Move className="h-3 w-3" />} 
                      />
                      <SpacingInput 
                        value={marginY} 
                        onChange={(v) => { setMarginY(v); setMod('marginY'); }} 
                        icon={<Move className="h-3 w-3 rotate-90" />} 
                      />
                      <button className="bg-zinc-800 rounded-lg p-2 text-zinc-500 hover:text-zinc-300">
                        <Maximize2 className="h-4 w-4 mx-auto" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Padding */}
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400">{isRTL ? 'الحشو' : 'Padding'}</label>
                    <div className="grid grid-cols-3 gap-2">
                      <SpacingInput 
                        value={paddingX} 
                        onChange={(v) => { setPaddingX(v); setMod('paddingX'); }} 
                        icon={<Square className="h-3 w-3" />} 
                      />
                      <SpacingInput 
                        value={paddingY} 
                        onChange={(v) => { setPaddingY(v); setMod('paddingY'); }} 
                        icon={<Square className="h-3 w-3" />} 
                      />
                      <button className="bg-zinc-800 rounded-lg p-2 text-zinc-500 hover:text-zinc-300">
                        <Maximize2 className="h-4 w-4 mx-auto" />
                      </button>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* ===== LAYOUT SECTION ===== */}
              <Collapsible open={openSections.layout} onOpenChange={() => toggleSection('layout')}>
                <CollapsibleTrigger asChild>
                  <SectionHeader title={isRTL ? 'التخطيط' : 'Layout'} isOpen={openSections.layout} onClick={() => {}} />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pb-4">
                  {/* Direction */}
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400">{isRTL ? 'الاتجاه' : 'Direction'}</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => { setFlexDirection('row'); setMod('flexDirection'); }}
                        className={cn(
                          "flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs transition-all",
                          flexDirection === 'row'
                            ? "bg-indigo-500/30 border border-indigo-500/50 text-white"
                            : "bg-zinc-800 border border-zinc-700 text-zinc-400 hover:border-zinc-600"
                        )}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => { setFlexDirection('column'); setMod('flexDirection'); }}
                        className={cn(
                          "flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs transition-all",
                          flexDirection === 'column'
                            ? "bg-indigo-500/30 border border-indigo-500/50 text-white"
                            : "bg-zinc-800 border border-zinc-700 text-zinc-400 hover:border-zinc-600"
                        )}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Alignment */}
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400">{isRTL ? 'المحاذاة' : 'Alignment'}</label>
                    <div className="grid grid-cols-5 gap-1">
                      {['start', 'center', 'end', 'stretch', 'baseline'].map((align) => (
                        <button
                          key={align}
                          onClick={() => { setAlignItems(align); setMod('alignItems'); }}
                          className={cn(
                            "p-2 rounded-lg text-xs transition-all flex items-center justify-center",
                            alignItems === align
                              ? "bg-indigo-500/30 border border-indigo-500/50 text-white"
                              : "bg-zinc-800 border border-zinc-700 text-zinc-500 hover:border-zinc-600"
                          )}
                        >
                          {align === 'start' && <AlignStartVertical className="h-3 w-3" />}
                          {align === 'center' && <AlignCenterVertical className="h-3 w-3" />}
                          {align === 'end' && <AlignEndVertical className="h-3 w-3" />}
                          {align === 'stretch' && <LayoutGrid className="h-3 w-3" />}
                          {align === 'baseline' && <span className="text-[8px]">B</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Gap */}
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400">{isRTL ? 'الفجوة' : 'Gap'}</label>
                    <SpacingInput 
                      value={gap} 
                      onChange={(v) => { setGap(v); setMod('gap'); }} 
                      icon={<LayoutGrid className="h-3 w-3" />} 
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* ===== BORDER SECTION ===== */}
              <Collapsible open={openSections.border} onOpenChange={() => toggleSection('border')}>
                <CollapsibleTrigger asChild>
                  <SectionHeader title={isRTL ? 'الحدود' : 'Border'} isOpen={openSections.border} onClick={() => {}} />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pb-4">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Border Width */}
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400">{isRTL ? 'العرض' : 'Border width'}</label>
                      <Select value={borderWidth} onValueChange={(v) => { setBorderWidth(v); setMod('borderWidth'); }}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-800 border-zinc-700 z-[250]">
                          {borderWidthOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-white hover:bg-zinc-700 text-xs">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Border Color */}
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400">{isRTL ? 'اللون' : 'Border color'}</label>
                      <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                        <div 
                          className="w-4 h-4 rounded-full border border-zinc-600"
                          style={{ backgroundColor: borderColor === 'inherit' ? 'transparent' : borderColor }}
                        />
                        <span className="text-xs text-zinc-400 flex-1">{borderColor === 'inherit' ? 'Inherit' : borderColor}</span>
                        <input
                          type="color"
                          value={borderColor === 'inherit' ? '#000000' : borderColor}
                          onChange={(e) => { setBorderColor(e.target.value); setMod('borderColor'); }}
                          className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Border Style */}
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400">{isRTL ? 'النمط' : 'Border style'}</label>
                    <Select value={borderStyle} onValueChange={(v) => { setBorderStyle(v); setMod('borderStyle'); }}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700 z-[250]">
                        {borderStyleOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-white hover:bg-zinc-700 text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* ===== EFFECTS SECTION ===== */}
              <Collapsible open={openSections.effects} onOpenChange={() => toggleSection('effects')}>
                <CollapsibleTrigger asChild>
                  <SectionHeader title={isRTL ? 'التأثيرات' : 'Effects'} isOpen={openSections.effects} onClick={() => {}} />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pb-4">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Border Radius */}
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400 flex items-center gap-1">
                        {isRTL ? 'نصف القطر' : 'Border radius'}
                        <Circle className="h-3 w-3" />
                      </label>
                      <Select value={borderRadius} onValueChange={(v) => { setBorderRadius(v); setMod('borderRadius'); }}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-800 border-zinc-700 z-[250]">
                          {borderRadiusOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-white hover:bg-zinc-700 text-xs">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Shadow */}
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400">{isRTL ? 'الظل' : 'Shadow'}</label>
                      <Select value={shadow} onValueChange={(v) => { setShadow(v); setMod('shadow'); }}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-800 border-zinc-700 z-[250]">
                          {shadowOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-white hover:bg-zinc-700 text-xs">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Opacity */}
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400">{isRTL ? 'الشفافية' : 'Opacity'}</label>
                    <Select value={opacity} onValueChange={(v) => { setOpacity(v); setMod('opacity'); }}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700 z-[250]">
                        {opacityOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-white hover:bg-zinc-700 text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* ===== ADVANCED SECTION ===== */}
              <Collapsible open={openSections.advanced} onOpenChange={() => toggleSection('advanced')}>
                <CollapsibleTrigger asChild>
                  <SectionHeader title={isRTL ? 'متقدم' : 'Advanced'} isOpen={openSections.advanced} onClick={() => {}} />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pb-4">
                  {/* Text Edit */}
                  {showTextEdit && (
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400 flex items-center gap-1.5">
                        <Type className="h-3 w-3" />
                        {isRTL ? 'محتوى النص' : 'Text Content'}
                      </label>
                      <Input
                        value={editedText}
                        onChange={(e) => { setEditedText(e.target.value); setMod('text'); }}
                        className="bg-zinc-800 border-zinc-700 text-white text-sm"
                        placeholder={isRTL ? 'أدخل النص الجديد...' : 'Enter new text...'}
                      />
                    </div>
                  )}
                  <p className="text-[10px] text-zinc-500">
                    {isRTL ? 'المزيد من الخيارات المتقدمة قريبًا...' : 'More advanced options coming soon...'}
                  </p>
                </CollapsibleContent>
              </Collapsible>

              {/* Apply Button */}
              <Button
                onClick={handleApplyDirectEdits}
                disabled={!Object.values(modified).some(Boolean)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white mt-4"
              >
                <Check className="h-4 w-4 mr-2" />
                {isRTL ? 'تطبيق التغييرات' : 'Apply Changes'}
              </Button>
            </>
          ) : activeTab === 'image' ? (
            <>
              {/* Image Tab Content */}
              <div className="space-y-4">
                <p className="text-xs text-zinc-400 text-center">
                  {isRTL ? 'اختر مصدر الصورة الجديدة' : 'Choose a new image source'}
                </p>
                
                <Button
                  onClick={() => onImageChange?.()}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  {isRTL ? 'اختر من المكتبة' : 'Choose from Library'}
                </Button>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-zinc-700" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-zinc-900 px-2 text-zinc-500">{isRTL ? 'أو' : 'or'}</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <Link2 className="h-3 w-3" />
                    {isRTL ? 'رابط الصورة' : 'Image URL'}
                  </label>
                  <Input
                    placeholder={isRTL ? 'الصق رابط الصورة...' : 'Paste image URL...'}
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white text-sm"
                  />
                  <Button
                    onClick={() => {
                      if (imageUrl.trim()) {
                        onDirectEdit({ imageUrl: imageUrl.trim() });
                        onClose();
                      }
                    }}
                    disabled={!imageUrl.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {isRTL ? 'تطبيق الرابط' : 'Apply URL'}
                  </Button>
                </div>
                
                <p className="text-[10px] text-center text-emerald-500/80 pt-2">
                  ✓ {isRTL ? 'تغيير الصورة مجاني - بدون AI' : 'Image change is FREE - No AI needed'}
                </p>
              </div>
            </>
          ) : (
            <>
              {/* AI Edit Section */}
              <div className="space-y-3">
                <p className="text-xs text-zinc-400">
                  {isRTL 
                    ? `قم بوصف التغييرات التي تريدها للعنصر "${element.innerText.substring(0, 30)}..."`
                    : `Describe changes for "${element.innerText.substring(0, 30)}..."`
                  }
                </p>
                
                <div className="flex flex-wrap gap-2">
                  {getContextAwarePrompts(element, isRTL).map((quick) => (
                    <button
                      key={quick}
                      onClick={() => setAiPrompt(quick)}
                      className="px-2.5 py-1 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
                    >
                      {quick}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Input
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white text-sm pr-10"
                    placeholder={isRTL ? 'ماذا تريد تغييره؟' : 'What would you like to change?'}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && aiPrompt.trim()) {
                        handleAISubmit();
                      }
                    }}
                  />
                  <button
                    onClick={handleAISubmit}
                    disabled={!aiPrompt.trim()}
                    className={cn(
                      "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors",
                      aiPrompt.trim() 
                        ? "bg-purple-600 text-white hover:bg-purple-700"
                        : "bg-zinc-700 text-zinc-500"
                    )}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <p className="text-[10px] text-center text-zinc-500 pt-2">
                {isRTL ? 'التعديل بالذكاء الاصطناعي يستهلك رصيد' : 'AI edits use credits'}
              </p>
            </>
          )}
        </div>

        {/* Preview Bar */}
        <div className="px-4 py-2 bg-zinc-800/30 border-t border-zinc-700/50">
          <p className="text-[10px] text-zinc-500 truncate text-center">
            {element.innerText.substring(0, 60)}{element.innerText.length > 60 ? '...' : ''}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ElementEditPopover;
