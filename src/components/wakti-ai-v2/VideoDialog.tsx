
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X, Upload, Camera, Sparkles } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { supabase } from '@/integrations/supabase/client';
import { useVideoStatusPoller } from '@/hooks/useVideoStatusPoller';

interface VideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VideoDialog({ open, onOpenChange }: VideoDialogProps) {
  const { language } = useTheme();
  const { showError, showSuccess } = useToastHelper();
  const { addTask: addVideoTask } = useVideoStatusPoller();
  
  const [uploadedImage, setUploadedImage] = useState<any>(null);
  const [movementStyle, setMovementStyle] = useState('auto');
  const [description, setDescription] = useState('');
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
    
    setIsUploading(true);
    
    try {
      const file = files[0];
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image size must be less than 5MB');
      }

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

  const handleGenerateVideo = async () => {
    try {
      setIsGenerating(true);
      
      if (!uploadedImage) {
        throw new Error('Please upload an image first');
      }

      if (!description.trim()) {
        throw new Error('Please provide a description for your video');
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        throw new Error('Please log in to generate videos');
      }

      const response = await supabase.functions.invoke('runware-video-generator', {
        body: {
          image_url: uploadedImage.url,
          prompt: description.trim(),
          user_id: user.id,
          movement_style: movementStyle
        }
      });

      if (response.error) throw new Error(response.error.message);

      if (response.data?.success) {
        showSuccess('Video generation started! You will be notified when it\'s ready.');
        addVideoTask({ 
          task_id: response.data.job_id, 
          status: 'processing'
        });
        
        // Reset form and close dialog
        setUploadedImage(null);
        setDescription('');
        setMovementStyle('auto');
        onOpenChange(false);
      } else {
        throw new Error('Video generation failed to start');
      }

    } catch (error: any) {
      showError(error.message || 'Video generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const removeImage = () => {
    setUploadedImage(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              {language === 'ar' ? 'إنشاء فيديو' : 'Create Video'}
            </span>
            <Button onClick={() => onOpenChange(false)} variant="ghost" size="sm">
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 p-1">
          {/* Step 1: Upload Image */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm">
              {language === 'ar' ? '1. ارفع صورة' : '1. Upload Image'}
            </h3>
            
            {!uploadedImage ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                <Sparkles className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  {language === 'ar' ? 'ارفع صورة لتحويلها إلى فيديو' : 'Upload an image to turn into a video'}
                </p>
                <div className="flex gap-2 justify-center">
                  <Button 
                    onClick={() => fileInputRef.current?.click()} 
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
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 w-6 h-6 p-0 bg-red-500 hover:bg-red-600 rounded-full"
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
              value={movementStyle} 
              onChange={(e) => setMovementStyle(e.target.value)}
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm"
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
              {language === 'ar' ? '3. وصف الفيديو' : '3. Describe Your Video'}
            </h3>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={language === 'ar' ? 'اكتب وصفاً للفيديو المطلوب...' : 'Describe what you want to happen in the video...'}
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm resize-none"
              rows={3}
            />
          </div>

          {/* Generate Button */}
          <Button 
            onClick={handleGenerateVideo}
            disabled={isGenerating || !uploadedImage || !description.trim() || isUploading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
          >
            {isGenerating ? (
              language === 'ar' ? 'جاري الإنشاء...' : 'Generating...'
            ) : (
              language === 'ar' ? '🎬 إنشاء فيديو' : '🎬 Generate Video'
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
