
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface NewConversationButtonProps {
  onNewConversation: () => void;
}

export function NewConversationButton({ onNewConversation }: NewConversationButtonProps) {
  const { language } = useTheme();

  return (
    <Button
      onClick={onNewConversation}
      variant="outline"
      size="sm"
      className="flex items-center gap-2"
    >
      <Plus className="h-4 w-4" />
      {language === 'ar' ? 'محادثة جديدة' : 'New Chat'}
    </Button>
  );
}
