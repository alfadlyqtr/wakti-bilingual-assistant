
import React, { useState, useCallback } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { Scissors, Upload, Download, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RunwareBackgroundService } from '@/services/runwareBackgroundService';

interface BackgroundRemovalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BackgroundRemovalModal({ open, onOpenChange }: BackgroundRemovalModalProps) {
  const { language } = useTheme();
  const { showSuccess, showError, showLoading } = useToastHelper();
  
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleReset = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    setProcessedImage(null);
    setIsProcessing(false);
    setDragOver(false);
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      showError(language === 'ar' ? 'يرجى اختيار ملف صورة صالح' : 'Please select a valid image file');
      return;
    }

    setSelectedImage(file);
    setProcessedImage(null);
    
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }, [language, showError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleRemoveBackground = async () => {
    if (!selectedImage) return;

    setIsProcessing(true);
    const loadingToast = showLoading(
      language === 'ar' ? 'جاري إزالة الخلفية...' : 'Removing background...'
    );

    try {
      const result = await RunwareBackgroundService.removeBackground({
        image: selectedImage,
        includeCost: true
      });

      if (result.success) {
        setProcessedImage(result.imageUrl || result.imageBase64Data || null);
        showSuccess(
          language === 'ar' ? 'تم إزالة الخلفية بنجاح!' : 'Background removed successfully!'
        );
        
        if (result.cost) {
          console.log('Background removal cost:', result.cost);
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Background removal failed:', error);
      showError(
        language === 'ar' ? 'فشل في إزالة الخلفية' : 'Failed to remove background'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!processedImage) return;

    const link = document.createElement('a');
    link.href = processedImage;
    link.download = `background_removed_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showSuccess(
      language === 'ar' ? 'تم تحميل الصورة!' : 'Image downloaded!'
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" hideCloseButton>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-orange-500" />
              {language === 'ar' ? 'إزالة الخلفية' : 'Remove Background'}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {!selectedImage ? (
            // Upload Area
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                dragOver ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20" : "border-gray-300 dark:border-gray-600"
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">
                {language === 'ar' ? 'ارفع صورة لإزالة الخلفية' : 'Upload image to remove background'}
              </h3>
              <p className="text-gray-500 mb-4">
                {language === 'ar' ? 'اسحب وأفلت الصورة هنا أو انقر للاختيار' : 'Drag and drop your image here or click to select'}
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                className="hidden"
                id="image-upload"
              />
              <label htmlFor="image-upload">
                <Button type="button" className="cursor-pointer">
                  {language === 'ar' ? 'اختر صورة' : 'Choose Image'}
                </Button>
              </label>
            </div>
          ) : (
            // Image Preview and Processing
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original Image */}
                <div className="space-y-2">
                  <h4 className="font-medium">
                    {language === 'ar' ? 'الصورة الأصلية' : 'Original Image'}
                  </h4>
                  <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                    {previewUrl && (
                      <img
                        src={previewUrl}
                        alt="Original"
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                </div>

                {/* Processed Image */}
                <div className="space-y-2">
                  <h4 className="font-medium">
                    {language === 'ar' ? 'بعد إزالة الخلفية' : 'Background Removed'}
                  </h4>
                  <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden relative">
                    {isProcessing ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-orange-500" />
                          <p className="text-sm text-gray-500">
                            {language === 'ar' ? 'جاري المعالجة...' : 'Processing...'}
                          </p>
                        </div>
                      </div>
                    ) : processedImage ? (
                      <img
                        src={processedImage}
                        alt="Processed"
                        className="w-full h-full object-contain"
                        style={{ background: 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAZuEWrXUCAJNAAAAB/2+IQs9hUAAAAGElFTkSuQmCC) repeat' }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-gray-400">
                          {language === 'ar' ? 'سيظهر هنا بعد المعالجة' : 'Processed image will appear here'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between">
                <Button variant="outline" onClick={handleReset}>
                  {language === 'ar' ? 'صورة جديدة' : 'New Image'}
                </Button>
                
                <div className="flex gap-2">
                  {processedImage && (
                    <Button variant="outline" onClick={handleDownload}>
                      <Download className="h-4 w-4 mr-2" />
                      {language === 'ar' ? 'تحميل' : 'Download'}
                    </Button>
                  )}
                  
                  <Button 
                    onClick={handleRemoveBackground}
                    disabled={isProcessing || !!processedImage}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Scissors className="h-4 w-4 mr-2" />
                    )}
                    {language === 'ar' ? 'إزالة الخلفية' : 'Remove Background'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
