import React, { useRef, useImperativeHandle, forwardRef } from 'react';

export interface StreamingBubbleHandle {
  appendToken: (token: string) => void;
  setContent: (text: string) => void;
  reset: () => void;
  getContent: () => string;
}

interface StreamingBubbleProps {
  language: string;
}

/**
 * StreamingBubble — zero React re-renders during token streaming.
 * Tokens are appended directly to the DOM node via a ref.
 * React state is never touched during the stream — no reconciliation lag.
 */
const StreamingBubble = forwardRef<StreamingBubbleHandle, StreamingBubbleProps>(
  ({ language }, ref) => {
    const spanRef = useRef<HTMLSpanElement>(null);
    const contentRef = useRef<string>('');

    useImperativeHandle(ref, () => ({
      appendToken(token: string) {
        contentRef.current += token;
        if (spanRef.current) {
          spanRef.current.textContent = contentRef.current;
        }
      },
      setContent(text: string) {
        contentRef.current = text;
        if (spanRef.current) {
          spanRef.current.textContent = text;
        }
      },
      reset() {
        contentRef.current = '';
        if (spanRef.current) {
          spanRef.current.textContent = '';
        }
      },
      getContent() {
        return contentRef.current;
      },
    }));

    return (
      <div className={`text-sm leading-relaxed break-words whitespace-pre-wrap ${language === 'ar' ? 'text-right' : 'text-left'}`}>
        <span ref={spanRef} />
        <span className="inline-block w-2 h-4 ml-0.5 align-text-bottom bg-primary/70 animate-pulse rounded-sm" />
      </div>
    );
  }
);

StreamingBubble.displayName = 'StreamingBubble';

// Memoized: parent re-renders with the same language prop won't re-render or remount this
// component, preserving its DOM content (spanRef.textContent) during active streaming.
const MemoizedStreamingBubble = React.memo(StreamingBubble);

export { MemoizedStreamingBubble as StreamingBubble };
