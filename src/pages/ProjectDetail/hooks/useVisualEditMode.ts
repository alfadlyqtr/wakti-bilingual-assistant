// useVisualEditMode - Visual element selection and editing
// Part of Group A Enhancement: Performance & Code Quality

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { applyDirectEdits, validateJSX } from '@/utils/directStyleEditor';
import type { SelectedElementInfo, PendingElementImageEdit } from '../types';

interface UseVisualEditModeProps {
  isRTL: boolean;
}

export function useVisualEditMode({ isRTL }: UseVisualEditModeProps) {
  // Element selection state
  const [elementSelectMode, setElementSelectMode] = useState(false);
  const [selectedElementInfo, setSelectedElementInfo] = useState<SelectedElementInfo | null>(null);
  const [showElementEditPopover, setShowElementEditPopover] = useState(false);
  
  // Pending element image edit (for stock photo selection)
  const [pendingElementImageEdit, setPendingElementImageEdit] = useState<PendingElementImageEdit | null>(null);
  
  // Stock photo selector state
  const [showStockPhotoSelector, setShowStockPhotoSelector] = useState(false);
  const [photoSearchTerm, setPhotoSearchTerm] = useState('');
  const [photoSelectorInitialTab, setPhotoSelectorInitialTab] = useState<'stock' | 'user'>('stock');
  const [photoSelectorMultiSelect, setPhotoSelectorMultiSelect] = useState(false);
  const [isChangingCarouselImages, setIsChangingCarouselImages] = useState(false);
  const [savedPromptForPhotos, setSavedPromptForPhotos] = useState('');
  const [photoSelectorShowOnlyUserPhotos, setPhotoSelectorShowOnlyUserPhotos] = useState(false);
  const [isUploadingAttachedImages, setIsUploadingAttachedImages] = useState(false);
  
  // Image source dialog state
  const [showImageSourceDialog, setShowImageSourceDialog] = useState(false);
  const [pendingImagePrompt, setPendingImagePrompt] = useState('');
  const [isAIGeneratingImages, setIsAIGeneratingImages] = useState(false);
  
  // Enter element select mode
  const enterElementSelectMode = useCallback(() => {
    setElementSelectMode(true);
  }, []);
  
  // Exit element select mode
  const exitElementSelectMode = useCallback(() => {
    setElementSelectMode(false);
    setSelectedElementInfo(null);
  }, []);
  
  // Handle element selection from inspector
  const handleElementSelected = useCallback((elementInfo: SelectedElementInfo) => {
    setSelectedElementInfo(elementInfo);
    setShowElementEditPopover(true);
    setElementSelectMode(false);
  }, []);
  
  // Close element edit popover
  const closeElementEditPopover = useCallback(() => {
    setShowElementEditPopover(false);
    setSelectedElementInfo(null);
  }, []);
  
  // Apply direct edits to code (no AI, no credits)
  const applyDirectCodeEdits = useCallback((
    currentCode: string,
    elementInfo: SelectedElementInfo,
    changes: {
      text?: string;
      backgroundColor?: string;
      color?: string;
      fontSize?: string;
      imageUrl?: string;
    },
    setGeneratedFiles: (fn: (prev: Record<string, string>) => Record<string, string>) => void,
    setCodeContent: (code: string) => void
  ): boolean => {
    // Handle direct image URL change
    if (changes.imageUrl) {
      const className = elementInfo.className?.split(' ')[0];
      const tag = elementInfo.tagName.toLowerCase();
      
      let newCode = currentCode;
      let replaced = false;
      
      // Try to find img element with matching class
      if (className) {
        const imgClassPattern = new RegExp(
          `(<img[^>]*?(?:className|class)=["'][^"']*${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"']*["'][^>]*?src=)(["'])([^"']+)(\\2)`,
          'g'
        );
        newCode = newCode.replace(imgClassPattern, (match, prefix, quote, oldUrl, endQuote) => {
          replaced = true;
          return `${prefix}${quote}${changes.imageUrl}${endQuote}`;
        });
      }
      
      // Fallback: try simple img src replacement
      if (!replaced && tag === 'img') {
        const openingTag = elementInfo.openingTag;
        if (openingTag && openingTag.includes('src=')) {
          const srcMatch = openingTag.match(/src=["']([^"']+)["']/);
          if (srcMatch) {
            const oldSrc = srcMatch[1];
            newCode = newCode.replace(
              new RegExp(`src=["']${oldSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'g'),
              `src="${changes.imageUrl}"`
            );
            replaced = newCode !== currentCode;
          }
        }
      }
      
      if (replaced) {
        setGeneratedFiles(prev => ({ ...prev, '/App.js': newCode }));
        setCodeContent(newCode);
        toast.success(isRTL ? 'تم تحديث الصورة!' : 'Image updated!');
        return true;
      }
      
      return false;
    }
    
    // Apply direct edits using the utility
    const result = applyDirectEdits(currentCode, elementInfo, changes);
    
    if (result.success) {
      // Validate JSX before applying
      if (validateJSX(result.code)) {
        setGeneratedFiles(prev => ({ ...prev, '/App.js': result.code }));
        setCodeContent(result.code);
        toast.success(
          isRTL
            ? `تم التطبيق: ${result.message} (غير محفوظ بعد)`
            : `Applied: ${result.message} (not saved yet)`
        );
        return true;
      } else {
        // JSX validation failed - try simple text replace
        if (changes.text && elementInfo.innerText) {
          const simpleCode = currentCode.replace(elementInfo.innerText, changes.text);
          setGeneratedFiles(prev => ({ ...prev, '/App.js': simpleCode }));
          toast.success(isRTL ? 'تم تحديث النص!' : 'Text updated!');
          return true;
        }
      }
    }
    
    toast.error(
      isRTL
        ? 'تعذر تطبيق التعديل مباشرة. جرّب اختيار عنصر آخر أو استخدم "تعديل بالذكاء الاصطناعي".'
        : 'Could not apply this direct edit. Try selecting a different element or use "Edit with AI".'
    );
    return false;
  }, [isRTL]);
  
  // Check if this is a multi-image context (carousel/gallery)
  const isMultiImageContext = useCallback((elementInfo: SelectedElementInfo | null): boolean => {
    if (!elementInfo) return false;
    const className = elementInfo.className || '';
    const openingTag = elementInfo.openingTag || '';
    return /carousel|slider|swiper|slick|embla|gallery|grid.*image|photo.*grid/i.test(className + ' ' + openingTag);
  }, []);
  
  // Detect image-related request in prompt
  const detectImageRequest = useCallback((prompt: string): {
    isImageRequest: boolean;
    searchTerm: string;
  } => {
    const imageKeywords = /\b(image|photo|picture|background|img|صورة|صور|خلفية)\b/i;
    const changeToPattern = /\b(change|replace|swap|switch|update|set|make|add|use|غير|غيّر|بدل|استبدل|استخدم)\b.*?\b(to|with|of|into|as|إلى|ب)\b\s*(.+)/i;
    const imageOfPattern = /\b(image|photo|picture|صورة|صور)\s*(of|about|for|عن|من)\s*(.+)/i;
    
    const isImageRequest = imageKeywords.test(prompt);
    let searchTerm = '';
    
    const changeMatch = prompt.match(changeToPattern);
    const imageOfMatch = prompt.match(imageOfPattern);
    
    if (changeMatch && changeMatch[3]) {
      searchTerm = changeMatch[3].trim().replace(/[.!?]+$/, '');
    } else if (imageOfMatch && imageOfMatch[3]) {
      searchTerm = imageOfMatch[3].trim().replace(/[.!?]+$/, '');
    } else if (isImageRequest) {
      const words = prompt.split(/\s+/).filter(w =>
        !['change', 'replace', 'image', 'photo', 'picture', 'to', 'with', 'the', 'a', 'an', 'of', 'add', 'use', 'set', 'make'].includes(w.toLowerCase())
      );
      searchTerm = words.slice(0, 3).join(' ');
    }
    
    return { isImageRequest, searchTerm };
  }, []);
  
  // Open stock photo selector for element replacement
  const openStockPhotoSelectorForElement = useCallback((
    elementInfo: SelectedElementInfo | null,
    originalPrompt: string,
    multiSelect: boolean = false
  ) => {
    if (!elementInfo) return;
    
    setPendingElementImageEdit({ elementInfo, originalPrompt });
    setPhotoSelectorMultiSelect(multiSelect);
    setPhotoSelectorInitialTab('stock');
    setShowStockPhotoSelector(true);
    setShowElementEditPopover(false);
  }, []);
  
  // Open stock photo selector for carousel
  const openStockPhotoSelectorForCarousel = useCallback(() => {
    setIsChangingCarouselImages(true);
    setPhotoSearchTerm('');
    setPhotoSelectorInitialTab('stock');
    setPhotoSelectorMultiSelect(true);
    setShowStockPhotoSelector(true);
    setShowElementEditPopover(false);
  }, []);
  
  // Close stock photo selector
  const closeStockPhotoSelector = useCallback(() => {
    setShowStockPhotoSelector(false);
    setPendingElementImageEdit(null);
    setIsChangingCarouselImages(false);
  }, []);
  
  return {
    // State
    elementSelectMode,
    selectedElementInfo,
    showElementEditPopover,
    pendingElementImageEdit,
    showStockPhotoSelector,
    photoSearchTerm,
    photoSelectorInitialTab,
    photoSelectorMultiSelect,
    isChangingCarouselImages,
    savedPromptForPhotos,
    photoSelectorShowOnlyUserPhotos,
    isUploadingAttachedImages,
    showImageSourceDialog,
    pendingImagePrompt,
    isAIGeneratingImages,
    
    // Setters
    setElementSelectMode,
    setSelectedElementInfo,
    setShowElementEditPopover,
    setPendingElementImageEdit,
    setShowStockPhotoSelector,
    setPhotoSearchTerm,
    setPhotoSelectorInitialTab,
    setPhotoSelectorMultiSelect,
    setIsChangingCarouselImages,
    setSavedPromptForPhotos,
    setPhotoSelectorShowOnlyUserPhotos,
    setIsUploadingAttachedImages,
    setShowImageSourceDialog,
    setPendingImagePrompt,
    setIsAIGeneratingImages,
    
    // Actions
    enterElementSelectMode,
    exitElementSelectMode,
    handleElementSelected,
    closeElementEditPopover,
    applyDirectCodeEdits,
    isMultiImageContext,
    detectImageRequest,
    openStockPhotoSelectorForElement,
    openStockPhotoSelectorForCarousel,
    closeStockPhotoSelector,
  };
}
