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
 * Escape HTML to prevent XSS before we apply lightweight Markdown.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Lightweight, safe, progressive Markdown → HTML converter for the streaming
 * bubble only. Not a full Markdown parser — it handles the common tokens that
 * would otherwise show as raw text while streaming (###, **bold**, *italic*,
 * `code`, bullets, numbered lists, links). Heavy stuff (tables, code blocks)
 * is left as-is and gets properly parsed by ReactMarkdown after the stream
 * finishes.
 */
function lightMarkdownToHtml(input: string): string {
  // 1. Escape HTML first
  let out = escapeHtml(input);

  // 2. Inline code: `code`
  out = out.replace(/`([^`\n]+)`/g, '<code class="px-1 py-0.5 rounded bg-muted/60 text-[0.85em]">$1</code>');

  // 3. Headings at line starts: ###### … ##
  out = out.replace(/^######\s+(.+)$/gm, '<div class="font-semibold text-[0.92em] mt-2">$1</div>');
  out = out.replace(/^#####\s+(.+)$/gm, '<div class="font-semibold text-[0.95em] mt-2">$1</div>');
  out = out.replace(/^####\s+(.+)$/gm, '<div class="font-semibold text-base mt-2">$1</div>');
  out = out.replace(/^###\s+(.+)$/gm, '<div class="font-semibold text-base mt-2">$1</div>');
  out = out.replace(/^##\s+(.+)$/gm, '<div class="font-semibold text-lg mt-3">$1</div>');
  out = out.replace(/^#\s+(.+)$/gm, '<div class="font-bold text-lg mt-3">$1</div>');

  // 4. Bold **text** and __text__
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');

  // 5. Italic *text* and _text_ (avoid matching inside words)
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
  out = out.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');

  // 6. Links [label](url) — url already HTML-escaped above, but still sanity check
  out = out.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline text-primary">$1</a>');

  // 7. Bullets (- or *) at line starts — convert to styled divs (not <li>, to
  // avoid needing a parent <ul> and to keep it safe for streaming partials)
  out = out.replace(/^\s*[-*]\s+(.+)$/gm, '<div class="pl-4 relative"><span class="absolute left-1 top-[0.55em] w-1 h-1 rounded-full bg-current"></span>$1</div>');

  // 8. Numbered lists — keep the number visible
  out = out.replace(/^\s*(\d+)\.\s+(.+)$/gm, '<div class="pl-5 relative"><span class="absolute left-0 font-medium">$1.</span>$2</div>');

  return out;
}

/**
 * StreamingBubble — zero React re-renders during token streaming.
 * Tokens are appended directly to the DOM node via a ref.
 * React state is never touched during the stream — no reconciliation lag.
 *
 * Renders a safe, lightweight Markdown conversion progressively so users
 * don't see raw `##` and `**` tokens flashing on screen. After the stream
 * completes, the parent swaps to the full ReactMarkdown renderer.
 */
const StreamingBubble = forwardRef<StreamingBubbleHandle, StreamingBubbleProps>(
  ({ language }, ref) => {
    const spanRef = useRef<HTMLSpanElement>(null);
    const contentRef = useRef<string>('');

    const render = (text: string) => {
      if (!spanRef.current) return;
      spanRef.current.innerHTML = lightMarkdownToHtml(text);
    };

    useImperativeHandle(ref, () => ({
      appendToken(token: string) {
        contentRef.current += token;
        render(contentRef.current);
      },
      setContent(text: string) {
        contentRef.current = text;
        render(text);
      },
      reset() {
        contentRef.current = '';
        if (spanRef.current) {
          spanRef.current.innerHTML = '';
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
