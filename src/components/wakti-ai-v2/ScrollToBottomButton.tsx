
import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/lib/utils';

interface ScrollToBottomButtonProps {
  visible: boolean;
  onClick: () => void;
}

export function ScrollToBottomButton({ visible, onClick }: ScrollToBottomButtonProps) {
  const { language } = useTheme();
  
  if (!visible) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <Button
        onClick={onClick}
        size="sm"
        className={cn(
          "h-10 w-10 rounded-full shadow-lg bg-primary/90 hover:bg-primary",
          "border border-white/20 backdrop-blur-sm",
          "transition-all duration-200 hover:scale-110"
        )}
        aria-label={language === 'ar' ? 'الانتقال للأسفل' : 'Scroll to bottom'}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
    </div>
  );
}
