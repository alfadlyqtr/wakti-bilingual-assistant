import React, { useState, useEffect } from 'react';
import { X, Type, Palette, AlignLeft, Wand2, Check, ChevronRight, Image as ImageIcon, Link2 } from 'lucide-react';
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
}

interface ElementEditPopoverProps {
  element: SelectedElementInfo;
  onClose: () => void;
  onDirectEdit: (changes: { text?: string; color?: string; bgColor?: string; fontSize?: string; fontFamily?: string; imageUrl?: string }) => void;
  onAIEdit: (prompt: string) => void;
  onImageChange?: () => void; // Opens stock photo selector
  isRTL?: boolean;
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
  const text = element.innerText?.toLowerCase() || '';
  const openingTag = element.openingTag || '';
  
  // Carousel/Slider context
  if (/carousel|slider|swiper|slick|embla/i.test(className) || /carousel|slider/i.test(openingTag)) {
    return isRTL 
      ? ['غير الصور', 'أضف مؤشرات', 'أضف تشغيل تلقائي', 'أضف أسهم']
      : ['Change images', 'Add indicators', 'Add autoplay', 'Add arrows'];
  }
  
  // Gallery context
  if (/gallery|grid.*image|photo.*grid/i.test(className)) {
    return isRTL 
      ? ['غير الصور', 'أضف lightbox', 'غير التخطيط', 'أضف فلتر']
      : ['Change images', 'Add lightbox', 'Change layout', 'Add filter'];
  }
  
  // Hero/Banner context
  if (/hero|banner|jumbotron|landing/i.test(className) || tag === 'section' && /hero|banner/i.test(openingTag)) {
    return isRTL 
      ? ['غير الخلفية', 'أضف تأثير parallax', 'أضف تحريك', 'غير النص']
      : ['Change background', 'Add parallax', 'Add animation', 'Change text'];
  }
  
  // Card context
  if (/card|tile|item/i.test(className)) {
    return isRTL 
      ? ['أضف hover effect', 'أضف ظل', 'غير الحدود', 'غير التخطيط']
      : ['Add hover effect', 'Add shadow', 'Change border', 'Change layout'];
  }

  // Image elements
  if (isImageElement(tag, className)) {
    return isRTL 
      ? ['غير الصورة', 'أضف تأثير hover', 'اجعلها دائرية', 'أضف ظل']
      : ['Change image', 'Add hover effect', 'Make rounded', 'Add shadow'];
  }
  
  // Button elements
  if (tag === 'button' || tag === 'a' || /btn|button|cta/i.test(className)) {
    return isRTL
      ? ['أضف تأثير hover', 'اجعله gradient', 'أضف أيقونة', 'غير الحجم']
      : ['Add hover effect', 'Make gradient', 'Add icon', 'Change size'];
  }
  
  // Heading elements
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
    return isRTL
      ? ['اجعله أكبر', 'أضف gradient للنص', 'أضف تحريك', 'غير اللون']
      : ['Make bigger', 'Add text gradient', 'Add animation', 'Change color'];
  }
  
  // Navigation context
  if (/nav|menu|header/i.test(className) || tag === 'nav') {
    return isRTL
      ? ['أضف قائمة موبايل', 'أضف hover effect', 'غير الخلفية', 'أضف ظل']
      : ['Add mobile menu', 'Add hover effect', 'Change background', 'Add shadow'];
  }
  
  // Form elements
  if (tag === 'form' || /form/i.test(className)) {
    return isRTL
      ? ['أضف تحقق', 'أضف رسائل خطأ', 'غير الستايل', 'أضف أيقونات']
      : ['Add validation', 'Add error messages', 'Change style', 'Add icons'];
  }
  
  // Input elements
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return isRTL
      ? ['غير الستايل', 'أضف أيقونة', 'أضف focus effect', 'اجعله أكبر']
      : ['Change style', 'Add icon', 'Add focus effect', 'Make bigger'];
  }
  
  // Footer context
  if (/footer/i.test(className) || tag === 'footer') {
    return isRTL
      ? ['أضف روابط', 'غير التخطيط', 'أضف أيقونات اجتماعية', 'غير الخلفية']
      : ['Add links', 'Change layout', 'Add social icons', 'Change background'];
  }
  
  // Container/Section elements - generic
  if (tag === 'div' || tag === 'section' || tag === 'article') {
    return isRTL
      ? ['غير الخلفية', 'أضف حدود', 'أضف ظل', 'أضف padding']
      : ['Change background', 'Add border', 'Add shadow', 'Add padding'];
  }
  
  // Default - text elements
  return isRTL 
    ? ['اجعله أكبر', 'غير اللون', 'أضف أيقونة', 'غير الخط']
    : ['Make bigger', 'Change color', 'Add icon', 'Change font'];
};

// Helper to parse font size (e.g., "16px" -> 16)
const parseFontSize = (size: string): number => {
  const match = size?.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 16;
};

// Quick edit presets
const colorPresets = [
  '#ffffff', '#000000', '#ef4444', '#f97316', '#eab308', 
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'
];

// Font family presets (Google Fonts compatible)
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

export const ElementEditPopover: React.FC<ElementEditPopoverProps> = ({
  element,
  onClose,
  onDirectEdit,
  onAIEdit,
  onImageChange,
  isRTL = false
}) => {
  // Local state for edits
  const [editedText, setEditedText] = useState(element.innerText || '');
  const [editedColor, setEditedColor] = useState(element.computedStyle?.color || '#ffffff');
  const [editedBgColor, setEditedBgColor] = useState(element.computedStyle?.backgroundColor || 'transparent');
  const [editedFontSize, setEditedFontSize] = useState(parseFontSize(element.computedStyle?.fontSize || '16px'));
  const [editedFontFamily, setEditedFontFamily] = useState('inherit');
  const [aiPrompt, setAiPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  
  // Determine if this is an image element
  const isImage = isImageElement(element.tagName, element.className);
  
  // Default to 'image' tab if it's an image element, otherwise 'direct'
  const [activeTab, setActiveTab] = useState<'direct' | 'image' | 'ai'>(isImage ? 'image' : 'direct');
  
  // Track which fields have been modified
  const [modified, setModified] = useState({
    text: false,
    color: false,
    bgColor: false,
    fontSize: false,
    fontFamily: false
  });

  const showTextEdit = isTextElement(element.tagName) && element.innerText.trim().length > 0;

  const handleApplyDirectEdits = () => {
    const changes: { text?: string; color?: string; bgColor?: string; fontSize?: string; fontFamily?: string } = {};
    
    if (modified.text && editedText !== element.innerText) {
      changes.text = editedText;
    }
    if (modified.color) {
      changes.color = editedColor;
    }
    if (modified.bgColor) {
      changes.bgColor = editedBgColor;
    }
    if (modified.fontSize) {
      changes.fontSize = `${editedFontSize}px`;
    }
    if (modified.fontFamily && editedFontFamily !== 'inherit') {
      changes.fontFamily = editedFontFamily;
    }
    
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

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-4 md:p-8">
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
              <h3 className="text-sm font-bold text-white">
                {isRTL ? 'تحرير مرئي' : 'Visual Edit'}
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono">
                &lt;{element.tagName.toLowerCase()}&gt;
                {element.className && <span className="text-indigo-400/70">.{element.className.split(' ')[0]?.substring(0, 15)}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
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
          
          {/* Image Tab - Only show for image elements */}
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
            {isRTL ? 'AI' : 'AI'}
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {activeTab === 'direct' ? (
            <>
              {/* Text Edit */}
              {showTextEdit && (
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <Type className="h-3 w-3" />
                    {isRTL ? 'النص' : 'Text Content'}
                  </label>
                  <Input
                    value={editedText}
                    onChange={(e) => {
                      setEditedText(e.target.value);
                      setModified(m => ({ ...m, text: true }));
                    }}
                    className="bg-zinc-800 border-zinc-700 text-white text-sm"
                    placeholder={isRTL ? 'أدخل النص الجديد...' : 'Enter new text...'}
                  />
                </div>
              )}

              {/* Text Color */}
              <div className="space-y-2">
                <label className="text-xs text-zinc-400 flex items-center gap-1.5">
                  <Palette className="h-3 w-3" />
                  {isRTL ? 'لون النص' : 'Text Color'}
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {colorPresets.map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        setEditedColor(color);
                        setModified(m => ({ ...m, color: true }));
                      }}
                      className={cn(
                        "w-6 h-6 rounded-lg border-2 transition-all hover:scale-110",
                        editedColor === color ? "border-indigo-500 ring-2 ring-indigo-500/30" : "border-zinc-600"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <Input
                    type="color"
                    value={editedColor}
                    onChange={(e) => {
                      setEditedColor(e.target.value);
                      setModified(m => ({ ...m, color: true }));
                    }}
                    className="w-8 h-6 p-0 border-0 cursor-pointer"
                  />
                </div>
              </div>

              {/* Background Color */}
              <div className="space-y-2">
                <label className="text-xs text-zinc-400 flex items-center gap-1.5">
                  <AlignLeft className="h-3 w-3" />
                  {isRTL ? 'لون الخلفية' : 'Background Color'}
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setEditedBgColor('transparent');
                      setModified(m => ({ ...m, bgColor: true }));
                    }}
                    className={cn(
                      "w-6 h-6 rounded-lg border-2 transition-all hover:scale-110 bg-gradient-to-r from-zinc-800 via-transparent to-zinc-800",
                      editedBgColor === 'transparent' ? "border-indigo-500 ring-2 ring-indigo-500/30" : "border-zinc-600"
                    )}
                    title="Transparent"
                  />
                  {colorPresets.slice(0, 8).map((color) => (
                    <button
                      key={`bg-${color}`}
                      onClick={() => {
                        setEditedBgColor(color);
                        setModified(m => ({ ...m, bgColor: true }));
                      }}
                      className={cn(
                        "w-6 h-6 rounded-lg border-2 transition-all hover:scale-110",
                        editedBgColor === color ? "border-indigo-500 ring-2 ring-indigo-500/30" : "border-zinc-600"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <Input
                    type="color"
                    value={editedBgColor === 'transparent' ? '#000000' : editedBgColor}
                    onChange={(e) => {
                      setEditedBgColor(e.target.value);
                      setModified(m => ({ ...m, bgColor: true }));
                    }}
                    className="w-8 h-6 p-0 border-0 cursor-pointer"
                  />
                </div>
              </div>

              {/* Font Size */}
              <div className="space-y-2">
                <label className="text-xs text-zinc-400 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Type className="h-3 w-3" />
                    {isRTL ? 'حجم الخط' : 'Font Size'}
                  </span>
                  <span className="font-mono text-white">{editedFontSize}px</span>
                </label>
                <Slider
                  value={[editedFontSize]}
                  onValueChange={([val]) => {
                    setEditedFontSize(val);
                    setModified(m => ({ ...m, fontSize: true }));
                  }}
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
                <Select
                  value={editedFontFamily}
                  onValueChange={(val) => {
                    setEditedFontFamily(val);
                    setModified(m => ({ ...m, fontFamily: true }));
                  }}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue placeholder={isRTL ? 'اختر الخط' : 'Select font'} />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
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

              {/* Apply Button - Direct edits are FREE */}
              <Button
                onClick={handleApplyDirectEdits}
                disabled={!Object.values(modified).some(Boolean)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white mt-3"
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
                
                {/* Choose from Library Button */}
                <Button
                  onClick={() => onImageChange?.()}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  {isRTL ? 'اختر من المكتبة' : 'Choose from Library'}
                </Button>
                
                {/* OR divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-zinc-700" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-zinc-900 px-2 text-zinc-500">
                      {isRTL ? 'أو' : 'or'}
                    </span>
                  </div>
                </div>
                
                {/* Direct URL Input */}
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
                
                {/* Context-aware quick prompts based on element type */}
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

        {/* Preview Bar - Shows element info */}
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
