import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Image, FolderOpen, Wand2, Link, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ImageSourceChoice = 'stock' | 'uploads' | 'generate' | 'urls';

interface ImageSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (choice: ImageSourceChoice) => void;
  prompt: string; // The original user prompt to display context
  isGenerating?: boolean; // Show loading state for AI generation
}

export function ImageSourceDialog({
  open,
  onOpenChange,
  onSelect,
  prompt,
  isGenerating = false,
}: ImageSourceDialogProps) {
  const { language } = useTheme();
  const isRTL = language === 'ar';

  const options: {
    id: ImageSourceChoice;
    icon: React.ReactNode;
    title: string;
    titleAr: string;
    description: string;
    descriptionAr: string;
    color: string;
  }[] = [
    {
      id: 'stock',
      icon: <Image className="w-6 h-6" />,
      title: 'Pick from Stock',
      titleAr: 'اختر من المخزون',
      description: 'Search and select from stock photos',
      descriptionAr: 'ابحث واختر من صور المخزون',
      color: 'bg-blue-500/10 text-blue-500 border-blue-500/30 hover:bg-blue-500/20',
    },
    {
      id: 'uploads',
      icon: <FolderOpen className="w-6 h-6" />,
      title: 'Use My Uploads',
      titleAr: 'استخدم صوري',
      description: 'Select from your uploaded images',
      descriptionAr: 'اختر من الصور التي رفعتها',
      color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20',
    },
    {
      id: 'generate',
      icon: isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Wand2 className="w-6 h-6" />,
      title: 'Auto-Generate',
      titleAr: 'إنشاء تلقائي',
      description: 'Let AI create images for you',
      descriptionAr: 'اجعل الذكاء الاصطناعي ينشئ الصور',
      color: 'bg-purple-500/10 text-purple-500 border-purple-500/30 hover:bg-purple-500/20',
    },
    {
      id: 'urls',
      icon: <Link className="w-6 h-6" />,
      title: "I'll Provide URLs",
      titleAr: 'سأوفر الروابط',
      description: 'Paste image URLs directly',
      descriptionAr: 'الصق روابط الصور مباشرة',
      color: 'bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20',
    },
  ];

  // Truncate long prompts for display
  const displayPrompt = prompt.length > 100 ? prompt.slice(0, 100) + '...' : prompt;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        title={isRTL ? 'مصدر الصور' : 'Image Source'}
        description={isRTL ? 'اختر كيف تريد إضافة الصور' : 'Choose how you want to add images'}
      >
        <DialogHeader>
          <DialogTitle className={cn(isRTL && 'text-right')}>
            {isRTL ? 'كيف تريد إضافة الصور؟' : 'How do you want to add images?'}
          </DialogTitle>
          <DialogDescription className={cn('text-sm', isRTL && 'text-right')}>
            <span className="text-muted-foreground">
              {isRTL ? 'طلبك:' : 'Your request:'}
            </span>{' '}
            <span className="text-foreground font-medium">"{displayPrompt}"</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mt-4" dir={isRTL ? 'rtl' : 'ltr'}>
          {options.map((option) => (
            <Button
              key={option.id}
              variant="outline"
              className={cn(
                'flex flex-col items-center justify-center gap-2 h-auto py-4 px-3 border-2 transition-all',
                option.color,
                isGenerating && option.id === 'generate' && 'opacity-70 pointer-events-none'
              )}
              onClick={() => onSelect(option.id)}
              disabled={isGenerating && option.id === 'generate'}
            >
              {option.icon}
              <span className="font-medium text-sm">
                {isRTL ? option.titleAr : option.title}
              </span>
              <span className="text-xs text-muted-foreground text-center leading-tight">
                {isRTL ? option.descriptionAr : option.description}
              </span>
            </Button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          {isRTL
            ? 'يمكنك تغيير الصور لاحقًا في أي وقت'
            : 'You can always change images later'}
        </p>
      </DialogContent>
    </Dialog>
  );
}
