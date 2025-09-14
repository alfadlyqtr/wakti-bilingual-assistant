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

    // Only apply on mobile
    if (window.innerWidth >= 768) return;

    // Reset height to auto to get accurate scrollHeight
    textarea.style.height = 'auto';
    
    // Get computed styles
    const computedStyle = window.getComputedStyle(textarea);
    const lineHeight = parseInt(computedStyle.lineHeight) || 20;
    const paddingTop = parseInt(computedStyle.paddingTop) || 8;
    const paddingBottom = parseInt(computedStyle.paddingBottom) || 8;
    const borderTop = parseInt(computedStyle.borderTopWidth) || 0;
    const borderBottom = parseInt(computedStyle.borderBottomWidth) || 0;
    
    // Calculate heights
    const minHeight = (lineHeight * minLines) + paddingTop + paddingBottom + borderTop + borderBottom;
    const maxHeight = (lineHeight * maxLines) + paddingTop + paddingBottom + borderTop + borderBottom;
    
    // Get content height and apply constraints
    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
    
    // Apply the new height
    textarea.style.height = `${newHeight}px`;
    
    // Handle scrolling
    if (scrollHeight > maxHeight) {
      textarea.style.overflowY = 'auto';
      textarea.scrollTop = textarea.scrollHeight; // Auto-scroll to bottom
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