
import * as React from "react"

import { cn } from "@/lib/utils"
import { useAutoExpandingTextarea } from "@/hooks/useAutoExpandingTextarea"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoExpand?: boolean;
  maxLines?: number;
  minLines?: number;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, autoExpand = false, maxLines = 4, minLines = 1, value, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    
    // Use provided ref or internal ref
    const finalRef = (ref as React.RefObject<HTMLTextAreaElement>) || textareaRef;
    
    // Only enable auto-expand on mobile devices
    const isMobile = React.useMemo(() => {
      if (typeof window === 'undefined') return false;
      return window.innerWidth < 768; // Tailwind md breakpoint
    }, []);
    
    useAutoExpandingTextarea({
      textareaRef: finalRef,
      value: value as string || '',
      maxLines,
      minLines,
      enabled: autoExpand && isMobile
    });

    return (
      <textarea
        className={cn(
          "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none transition-all duration-200",
          // Dynamic height and scrolling for auto-expand mode
          autoExpand && isMobile 
            ? "min-h-[40px] leading-5 overflow-y-hidden"
            : "min-h-[96px] overflow-y-auto",
          className
        )}
        rows={autoExpand && isMobile ? minLines : 4}
        ref={finalRef}
        value={value}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
