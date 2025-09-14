import { useEffect, useCallback, RefObject } from 'react';

interface UseAutoExpandingTextareaOptions {
  textareaRef: RefObject<HTMLTextAreaElement>;
  value: string;
  maxLines?: number;
  minLines?: number;
  enabled?: boolean;
}

export function useAutoExpandingTextarea({
  textareaRef,
  value,
  maxLines = 4,
  minLines = 1,
  enabled = true
}: UseAutoExpandingTextareaOptions) {
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || !enabled) return;

    // Reset height to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Calculate line height
    const computedStyle = window.getComputedStyle(textarea);
    const lineHeight = parseInt(computedStyle.lineHeight) || 24;
    const paddingTop = parseInt(computedStyle.paddingTop) || 0;
    const paddingBottom = parseInt(computedStyle.paddingBottom) || 0;
    
    // Calculate min and max heights
    const minHeight = (lineHeight * minLines) + paddingTop + paddingBottom;
    const maxHeight = (lineHeight * maxLines) + paddingTop + paddingBottom;
    
    // Set height based on content
    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
    
    textarea.style.height = `${newHeight}px`;
    
    // Enable/disable scrolling based on whether we've reached max height
    if (scrollHeight > maxHeight) {
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.overflowY = 'hidden';
    }
  }, [textareaRef, maxLines, minLines, enabled]);

  // Adjust height when value changes
  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  // Adjust height on window resize
  useEffect(() => {
    if (!enabled) return;
    
    const handleResize = () => {
      // Small delay to ensure layout is stable
      setTimeout(adjustHeight, 0);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [adjustHeight, enabled]);

  return { adjustHeight };
}