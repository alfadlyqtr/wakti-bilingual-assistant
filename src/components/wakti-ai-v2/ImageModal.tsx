
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from "@/hooks/use-toast-helper";

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  prompt?: string;
}

export function ImageModal({ isOpen, onClose, imageUrl, prompt }: ImageModalProps) {
  const { language } = useTheme();
  const { showSuccess, showError } = useToastHelper();

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `wakti-ai-generated-${Date.now()}.webp`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showSuccess(
        language === 'ar' ? 'تم تحميل الصورة بنجاح' : 'Image downloaded successfully'
      );
    } catch (error) {
      showError(
        language === 'ar' ? 'فشل في تحميل الصورة' : 'Failed to download image'
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              {language === 'ar' ? 'الصورة المُولدة' : 'Generated Image'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {language === 'ar' ? 'تحميل' : 'Download'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {prompt && (
            <p className="text-sm text-muted-foreground mt-2">
              <strong>{language === 'ar' ? 'الوصف:' : 'Prompt:'}</strong> {prompt}
            </p>
          )}
        </DialogHeader>
        
        <div className="p-4 pt-0">
          <div className="relative bg-muted rounded-lg overflow-hidden">
            <img
              src={imageUrl}
              alt="Generated image"
              className="w-full h-auto max-h-[70vh] object-contain"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
