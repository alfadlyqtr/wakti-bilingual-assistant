import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Image, FolderOpen, Wand2, Link } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ImageSourceChoice = 'stock' | 'uploads' | 'generate' | 'urls';

interface ImageSourceButtonsProps {
  onSelect: (choice: ImageSourceChoice) => void;
  prompt: string;
}

export function ImageSourceButtons({ onSelect, prompt }: ImageSourceButtonsProps) {
  const { language } = useTheme();
  const isRTL = language === 'ar';

  const options: {
    id: ImageSourceChoice;
    icon: React.ReactNode;
    emoji: string;
    title: string;
    titleAr: string;
  }[] = [
    {
      id: 'stock',
      icon: <Image className="w-4 h-4" />,
      emoji: '📷',
      title: 'Pick from Stock',
      titleAr: 'من المخزون',
    },
    {
      id: 'uploads',
      icon: <FolderOpen className="w-4 h-4" />,
      emoji: '📁',
      title: 'My Uploads',
      titleAr: 'صوري',
    },
    {
      id: 'generate',
      icon: <Wand2 className="w-4 h-4" />,
      emoji: '🤖',
      title: 'Auto-Generate',
      titleAr: 'إنشاء تلقائي',
    },
    {
      id: 'urls',
      icon: <Link className="w-4 h-4" />,
      emoji: '✏️',
      title: 'Provide URLs',
      titleAr: 'روابط',
    },
  ];

  // Truncate long prompts for display
  const displayPrompt = prompt.length > 60 ? prompt.slice(0, 60) + '...' : prompt;

  return (
    <div className="space-y-3" dir={isRTL ? 'rtl' : 'ltr'}>
      <p className="text-sm text-muted-foreground">
        {isRTL 
          ? `🖼️ كيف تريد إضافة الصور لـ "${displayPrompt}"؟`
          : `🖼️ How do you want to add images for "${displayPrompt}"?`
        }
      </p>
      
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.id}
            variant="outline"
            size="sm"
            className={cn(
              'flex items-center gap-1.5 h-8 px-3 rounded-full border transition-all',
              'bg-background/80 hover:bg-primary/10 hover:border-primary/50',
              'text-foreground hover:text-primary'
            )}
            onClick={() => onSelect(option.id)}
          >
            <span>{option.emoji}</span>
            <span className="text-xs font-medium">
              {isRTL ? option.titleAr : option.title}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}
