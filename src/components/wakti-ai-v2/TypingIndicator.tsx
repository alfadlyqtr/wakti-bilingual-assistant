
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TypingIndicator() {
  const { language } = useTheme();

  return (
    <div className="flex gap-3 max-w-4xl">
      <div className="flex-1 space-y-2 max-w-[85%]">
        <div className={cn(
          "relative px-4 py-3 rounded-2xl shadow-sm",
          "bg-muted/50 text-foreground border rounded-bl-md"
        )}>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">
              {language === 'ar' ? 'يكتب...' : 'Typing...'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
