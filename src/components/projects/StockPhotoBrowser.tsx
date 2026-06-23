import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ProjectImageGeneratorPanel from '@/components/projects/ProjectImageGeneratorPanel';

interface StockPhotoBrowserProps {
  projectId: string;
  isRTL?: boolean;
  onInsertImage?: (imageUrl: string, title: string) => void;
  onClose?: () => void;
  className?: string;
}

export function StockPhotoBrowser({
  isRTL = false,
  onInsertImage,
  onClose,
  className = ''
}: StockPhotoBrowserProps) {
  return (
    <div className={cn('flex h-full flex-col bg-background p-5', className)} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className={cn('mb-4 flex items-center justify-between', isRTL && 'flex-row-reverse')}>
        <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
          <Sparkles className='h-5 w-5 text-cyan-500' />
          <h2 className='text-sm font-semibold'>
            {isRTL ? 'إنشاء الصور بالذكاء الاصطناعي' : 'AI Image Generation'}
          </h2>
        </div>
        {onClose && (
          <Button variant='ghost' size='icon' onClick={onClose}>
            <X className='h-4 w-4' />
          </Button>
        )}
      </div>

      <div className='rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground'>
        {isRTL
          ? 'تم حذف مزودات الصور الجاهزة. استخدم مولد المشروع الداخلي لإنشاء صور Nano Banana.'
          : 'Stock providers were removed. Use the in-project Nano Banana generator below.'}
      </div>

      <div className='mt-4'>
        <ProjectImageGeneratorPanel
          isRTL={isRTL}
          onUseImage={async (image) => {
            if (onInsertImage) {
              onInsertImage(image.imageUrl, image.prompt || (isRTL ? 'صورة مولّدة' : 'Generated image'));
            }
            onClose?.();
          }}
        />
      </div>
    </div>
  );
}

export default StockPhotoBrowser;
