import { useState, useCallback, useRef, useEffect } from 'react';
import type { SelectedElementInfo, DirectEditChanges, ResizeDimensions } from '../types';

interface UseVisualEditModeOptions {
  isRTL: boolean;
  onDirectEdit?: (changes: DirectEditChanges) => void;
}

interface UseVisualEditModeReturn {
  isEnabled: boolean;
  selectedElement: SelectedElementInfo | null;
  showPopover: boolean;
  isInlineEditing: boolean;
  inlineEditText: string;
  setIsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedElement: React.Dispatch<React.SetStateAction<SelectedElementInfo | null>>;
  setShowPopover: React.Dispatch<React.SetStateAction<boolean>>;
  setIsInlineEditing: React.Dispatch<React.SetStateAction<boolean>>;
  setInlineEditText: React.Dispatch<React.SetStateAction<string>>;
  handleElementSelect: (ref: string, info?: SelectedElementInfo) => void;
  handleClose: () => void;
  handleSelectParent: () => void;
  handleStartInlineEdit: () => void;
  handleSaveInlineEdit: () => void;
  handleCancelInlineEdit: () => void;
  handleResize: (dimensions: ResizeDimensions) => void;
}

export function useVisualEditMode({ isRTL, onDirectEdit }: UseVisualEditModeOptions): UseVisualEditModeReturn {
  const [isEnabled, setIsEnabled] = useState(false);
  const [selectedElement, setSelectedElement] = useState<SelectedElementInfo | null>(null);
  const [showPopover, setShowPopover] = useState(false);
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [inlineEditText, setInlineEditText] = useState('');

  // Handle element selection from the iframe
  const handleElementSelect = useCallback((ref: string, info?: SelectedElementInfo) => {
    console.log('[useVisualEditMode] Element selected:', ref, info);
    if (info) {
      setSelectedElement(info);
      setShowPopover(true);
      setIsInlineEditing(false);
    }
  }, []);

  // Close the popover and clear selection
  const handleClose = useCallback(() => {
    setShowPopover(false);
    setSelectedElement(null);
    setIsInlineEditing(false);
    setInlineEditText('');
  }, []);

  // Request parent element selection
  const handleSelectParent = useCallback(() => {
    const iframe = document.querySelector('.sp-preview-container iframe') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'WAKTI_SELECT_PARENT' }, '*');
    }
  }, []);

  // Start inline text editing
  const handleStartInlineEdit = useCallback(() => {
    if (selectedElement?.innerText) {
      setInlineEditText(selectedElement.innerText);
      setIsInlineEditing(true);
    }
  }, [selectedElement]);

  // Save inline text edit
  const handleSaveInlineEdit = useCallback(() => {
    if (onDirectEdit && inlineEditText !== selectedElement?.innerText) {
      onDirectEdit({ text: inlineEditText });
    }
    setIsInlineEditing(false);
  }, [inlineEditText, selectedElement, onDirectEdit]);

  // Cancel inline text edit
  const handleCancelInlineEdit = useCallback(() => {
    setIsInlineEditing(false);
    setInlineEditText('');
  }, []);

  // Handle resize
  const handleResize = useCallback((dimensions: ResizeDimensions) => {
    if (onDirectEdit) {
      onDirectEdit({
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
      });
    }
  }, [onDirectEdit]);

  // Clear selection when visual edit mode is disabled
  useEffect(() => {
    if (!isEnabled) {
      setSelectedElement(null);
      setShowPopover(false);
      setIsInlineEditing(false);
    }
  }, [isEnabled]);

  return {
    isEnabled,
    selectedElement,
    showPopover,
    isInlineEditing,
    inlineEditText,
    setIsEnabled,
    setSelectedElement,
    setShowPopover,
    setIsInlineEditing,
    setInlineEditText,
    handleElementSelect,
    handleClose,
    handleSelectParent,
    handleStartInlineEdit,
    handleSaveInlineEdit,
    handleCancelInlineEdit,
    handleResize,
  };
}
