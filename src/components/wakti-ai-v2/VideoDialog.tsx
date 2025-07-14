
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X, Upload, Camera, Sparkles } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { supabase } from '@/integrations/supabase/client';

interface VideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVideoGenerated: (data: any) => void;
}

export function VideoDialog({ open, onOpenChange, onVideoGenerated }: VideoDialogProps) {
  const { language } = useTheme();
  const { showError, showSuccess } = useToastHelper();
  
  const [uploadedImage, setUploadedImage] = useState<any>(null);
  const [movement, setMovement] = useState('auto');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const uploadImageToStorage = async (file: File): Promise<string> => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Please log in to upload images');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('ai-temp-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('ai-temp-images')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    if (files.length === 0) return;
    
    const file = files[0];
    if (file.size > 5 * 1024 * 1024) {
      showError(language === 'ar' ? 'حجم الملف يجب أن يكون أقل من 5 ميغابايت' : 'File size must be less than 5MB');
      return;
    }
    
    setIsUploading(true);
    
    try {
      const storageUrl = await uploadImageToStorage(file);
      setUploadedImage({
        id: Date.now(),
        name: file.name,
        url: storageUrl,
        size: file.size
      });
    } catch (error: any) {
      showError(error.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!uploadedImage) {
      showError(language === 'ar' ? 'يرجى تحميل صورة أولاً' : 'Please upload an image first');
      return;
    }

    if (!prompt.trim()) {
      showError(language === 'ar' ? 'يرجى كتابة وصف للفيديو' : 'Please enter a video description');
      return;
    }

    try {
      setIsGenerating(true);
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Please log in to generate videos');
      }

      const response = await supabase.functions.invoke('runware-video-generator', {
        body: {
          image_url: uploadedImage.url,
          prompt: prompt.trim(),
          user_id: user.id
        }
      });

      if (response.error) throw new Error(response.error.message);

      if (response.data?.success) {
        showSuccess(language === 'ar' ? '🎬 تم بدء إنشاء الفيديو! سيتم إشعارك عند الانتهاء.' : '🎬 Video generation started! You will be notified when ready.');
        onVideoGenerated({ 
          jobId: response.data.job_id, 
          taskId: response.data.job_id,
          model_used: response.data.model_used
        });
        onOpenChange(false);
        // Reset form
        setUploadedImage(null);
        setPrompt('');
        setMovement('auto');
      } else {
        throw new Error('Video generation failed to start');
      }

    } catch (error: any) {
      showError(error.message || 'Video generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    if (!isGenerating && !isUploading) {
      onOpenChange(false);
      setUploadedImage(null);
      setPrompt('');
      setMovement('auto');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" hideCloseButton={isGenerating || isUploading}>
        <DialogHeader>
          <DialogTitle className="text-center">
            {language === 'ar' ? '🎬 إنشاء فيديو' : '🎬 Create Video'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: Upload Image */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm">
              {language === 'ar' ? '1. ارفع صورة' : '1. Upload Image'}
            </h3>
            
            {!uploadedImage ? (
              <div className="text-center py-6 bg-muted/30 rounded-lg border border-dashed">
                <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">
                  {language === 'ar' ? 'اختر صورة لتحويلها إلى فيديو' : 'Choose an image to turn into video'}
                </p>
                <div className="flex gap-2 justify-center">
                  <Button 
                    onClick={() => fileInputRef.current?.click()} 
                    variant="outline"
                    size="sm"
                    disabled={isUploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isUploading ? (language === 'ar' ? 'جاري الرفع...' : 'Uploading...') : (language === 'ar' ? 'اختر صورة' : 'Choose Image')}
                  </Button>
                  <Button 
                    onClick={() => cameraInputRef.current?.click()} 
                    variant="outline"
                    size="sm"
                    disabled={isUploading}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'كاميرا' : 'Camera'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <img 
                  src={uploadedImage.url} 
                  className="w-full h-32 object-cover rounded-lg border" 
                  alt="Upload preview"
                />
                <Button
                  onClick={() => setUploadedImage(null)}
                  className="absolute -top-2 -right-2 w-6 h-6 p-0 bg-destructive hover:bg-destructive/90 rounded-full"
                  size="sm"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Step 2: Movement Style */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm">
              {language === 'ar' ? '2. نمط الحركة' : '2. Movement Style'}
            </h3>
            <select 
              value={movement} 
              onChange={(e) => setMovement(e.target.value)}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
            >
              <option value="auto">{language === 'ar' ? 'تلقائي (موصى به)' : 'Auto (Recommended)'}</option>
              <option value="slow">{language === 'ar' ? 'بطيء' : 'Slow'}</option>
              <option value="medium">{language === 'ar' ? 'متوسط' : 'Medium'}</option>
              <option value="fast">{language === 'ar' ? 'سريع' : 'Fast'}</option>
            </select>
          </div>

          {/* Step 3: Description */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm">
              {language === 'ar' ? '3. وصف الفيديو' : '3. Video Description'}
            </h3>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={language === 'ar' ? 'صف الفيديو الذي تريد إنشاؤه...' : 'Describe the video you want to create...'}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm min-h-[80px] resize-none"
              rows={3}
            />
          </div>

          {/* Generate Button */}
          <Button 
            onClick={handleGenerate}
            disabled={isGenerating || isUploading || !uploadedImage || !prompt.trim()}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              language === 'ar' ? 'جاري الإنشاء...' : 'Creating Video...'
            ) : (
              language === 'ar' ? '🎬 إنشاء فيديو' : '🎬 Create Video'
            )}
          </Button>
        </div>

        {/* Hidden Inputs */}
        <input 
          ref={fileInputRef} 
          type="file" 
          accept="image/*" 
          onChange={handleFileSelect} 
          className="hidden" 
        />
        <input 
          ref={cameraInputRef} 
          type="file" 
          accept="image/*" 
          capture="environment" 
          onChange={handleFileSelect} 
          className="hidden" 
        />
      </DialogContent>
    </Dialog>
  );
}
