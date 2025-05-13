import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { TranslationKey } from '@/utils/translationTypes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AIModeButtonProps {
  mode: string;
  activeMode: string;
  onClick: () => void;
  className?: string;
}

const AIModeButton: React.FC<AIModeButtonProps> = ({
  mode,
  activeMode,
  onClick,
  className,
}) => {
  const { language } = useTheme();
  const isActive = mode === activeMode;

  // Get the translation key for this mode
  const translationKey = `${mode}Mode` as TranslationKey;
  
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        'rounded-full px-4 py-1 text-sm transition-all',
        isActive
          ? 'bg-primary text-white hover:bg-primary/90'
          : 'hover:bg-accent',
        className
      )}
    >
      {t(translationKey, language)}
    </Button>
  );
};

export function ModePanel({
  activeMode,
  setActiveMode,
}: {
  activeMode: string;
  setActiveMode: (mode: string) => void;
}) {
  const availableModes = ['general', 'writer', 'creative', 'assistant'];

  return (
    <div className="flex items-center justify-center space-x-2 p-2 overflow-x-auto">
      {availableModes.map((mode) => (
        <AIModeButton
          key={mode}
          mode={mode}
          activeMode={activeMode}
          onClick={() => setActiveMode(mode)}
        />
      ))}
    </div>
  );
}
