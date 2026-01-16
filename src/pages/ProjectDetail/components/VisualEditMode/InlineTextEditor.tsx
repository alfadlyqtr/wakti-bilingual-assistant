import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { SelectedElementInfo } from '../../types';

interface InlineTextEditorProps {
  element: SelectedElementInfo;
  onSave: (newText: string) => void;
  onCancel: () => void;
  isRTL?: boolean;
}

export function InlineTextEditor({ 
  element, 
  onSave, 
  onCancel,
  isRTL = false 
}: InlineTextEditorProps) {
  const [text, setText] = useState(element.innerText || '');
  const editorRef = useRef<HTMLDivElement>(null);

  // Focus the editor on mount
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.focus();
      
      // Select all text
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }, []);

  // Position the editor over the element
  useEffect(() => {
    if (editorRef.current && element.rect) {
      Object.assign(editorRef.current.style, {
        position: 'fixed',
        top: `${element.rect.top}px`,
        left: `${element.rect.left}px`,
        width: `${Math.max(element.rect.width, 100)}px`,
        minHeight: `${element.rect.height}px`,
        zIndex: '300',
      });
    }
  }, [element.rect]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSave(text);
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleBlur = () => {
    // Save on blur if text changed
    if (text !== element.innerText) {
      onSave(text);
    } else {
      onCancel();
    }
  };

  // Extract font size from computed style (e.g., "16px" -> 16)
  const fontSize = element.computedStyle?.fontSize || '16px';

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-black/20 z-[299]"
        onClick={onCancel}
      />
      
      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => setText(e.currentTarget.textContent || '')}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={cn(
          "outline-2 outline-indigo-500 bg-white dark:bg-zinc-900",
          "p-2 rounded shadow-xl overflow-hidden",
          "ring-2 ring-indigo-500 ring-offset-2 ring-offset-transparent",
          isRTL && "text-right"
        )}
        style={{
          fontSize,
          color: element.computedStyle?.color || 'inherit',
          fontFamily: 'inherit',
          lineHeight: 'inherit',
        }}
      >
        {element.innerText}
      </div>

      {/* Hint */}
      <div 
        className={cn(
          "fixed z-[301] px-2 py-1 bg-zinc-800 text-xs text-zinc-300 rounded shadow-lg",
          isRTL ? "right-4 bottom-4" : "left-4 bottom-4"
        )}
      >
        {isRTL ? (
          <>Enter للحفظ • Esc للإلغاء</>
        ) : (
          <>Enter to save • Esc to cancel</>
        )}
      </div>
    </>
  );
}
