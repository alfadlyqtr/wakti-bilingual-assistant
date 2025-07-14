
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, Upload, Camera, Sparkles } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { supabase } from '@/integrations/supabase/client';

interface VideoUploadInterfaceProps {
  onClose: () => void;
  onVideoGenerated: (data: any) => void;
  onTemplateChange?: (category: string, template: string) => void;
  customPrompt?: string;
}

export function VideoUploadInterface({ onClose, onVideoGenerated, onTemplateChange, customPrompt }: VideoUploadInterfaceProps) {
  const { language } = useTheme();
  const { showError, showSuccess } = useToastHelper();
  
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [videoCategory, setVideoCategory] = useState('klingai');
  const [videoTemplate, setVideoTemplate] = useState('klingai_video');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Upload image to Supabase storage and return URL
  const uploadImageToStorage = async (file: File): Promise<string> => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Please log in to upload images');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    
    console.log('📤 UPLOAD: Uploading image to storage:', fileName);
    
    const { data, error } = await supabase.storage
      .from('ai-temp-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('❌ UPLOAD ERROR:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('ai-temp-images')
      .getPublicUrl(data.path);

    console.log('✅ UPLOAD SUCCESS:', urlData.publicUrl);
    return urlData.publicUrl;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    if (files.length === 0) return;
    
    setIsUploading(true);
    
    try {
      const uploadPromises = files.map(async (file) => {
        const storageUrl = await uploadImageToStorage(file);
        return {
          id: Date.now() + Math.random(),
          name: file.name,
          url: storageUrl,
          size: file.size
        };
      });

      const uploadedFileData = await Promise.all(uploadPromises);
      setUploadedFiles(prev => [...prev, ...uploadedFileData]);
      
      console.log('✅ ALL FILES UPLOADED:', uploadedFileData.length);
    } catch (error: any) {
      console.error('❌ FILE UPLOAD ERROR:', error);
      showError(error.message || 'Failed to upload images');
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerateVideo = async () => {
    try {
      setIsGenerating(true);
      
      if (uploadedFiles.length === 0) {
        throw new Error('Please upload at least one image');
      }

      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        throw new Error('Please log in to generate videos');
      }

      const imageUrl = uploadedFiles[0].url;
      const promptToUse = customPrompt?.trim() || 'Create a smooth video animation';

      console.log('🎬 GENERATING KLINGAI VIDEO:', {
        imageUrl: imageUrl.substring(0, 50) + '...',
        prompt: promptToUse,
        userId: user.id
      });

      // Call KlingAI video generator via isolated function
      const response = await supabase.functions.invoke('generate-video-isolated', {
        body: {
          image_base64: `data:image/jpeg;base64,${btoa(await (await fetch(imageUrl)).text())}`,
          prompt: promptToUse,
          movement_style: 'auto',
          user_id: user.id
        }
      });

      if (response.error) throw new Error(response.error.message);

      if (response.data?.success) {
        showSuccess('🎬 KlingAI video generation started! You will be notified when it\'s ready.');
        onVideoGenerated({ 
          jobId: response.data.taskUUID, 
          template: 'klingai_video',
          taskId: response.data.taskUUID,
          model_used: response.data.model_used,
          estimated_cost: response.data.estimated_cost
        });
        onClose();
      } else {
        throw new Error('KlingAI video generation failed to start');
      }

    } catch (error: any) {
      console.error('❌ KLINGAI VIDEO ERROR:', error);
      showError(error.message || 'Video generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  // Update template when category changes
  const handleCategoryChange = (category: string) => {
    setVideoCategory(category);
    let newTemplate = 'klingai_video';
    switch (category) {
      case 'klingai':
        newTemplate = 'klingai_video';
        break;
      default:
        newTemplate = 'klingai_video';
    }
    setVideoTemplate(newTemplate);
    
    // Notify parent component
    if (onTemplateChange) {
      onTemplateChange(category, newTemplate);
    }
  };

  const handleTemplateChange = (template: string) => {
    setVideoTemplate(template);
    if (onTemplateChange) {
      onTemplateChange(videoCategory, template);
    }
  };

  return (
    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-500/30 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
          {language === 'ar' ? '🎬 إنشاء فيديو' : '🎬 Create Video'}
        </h3>
        <Button onClick={onClose} variant="ghost" size="sm">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Upload Area */}
      {uploadedFiles.length === 0 && (
        <div className="text-center py-8 bg-white dark:bg-transparent rounded-lg border border-purple-200 dark:border-purple-600">
          <div className="mb-4">
            <Sparkles className="h-12 w-12 text-purple-400 mx-auto mb-2" />
            <p className="text-purple-900 dark:text-purple-200 text-sm">
              {language === 'ar' ? 'ارفع صورة واحدة وحولها إلى فيديو مذهل' : 'Upload one image and turn it into an amazing video'}
            </p>
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button 
              onClick={() => fileInputRef.current?.click()} 
              className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-700"
              disabled={isUploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? (language === 'ar' ? 'جاري الرفع...' : 'Uploading...') : (language === 'ar' ? 'اختر صورة' : 'Choose Image')}
            </Button>
            <Button 
              onClick={() => cameraInputRef.current?.click()} 
              className="bg-pink-600 hover:bg-pink-700"
              disabled={isUploading}
            >
              <Camera className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'كاميرا' : 'Camera'}
            </Button>
          </div>

          <p className="text-xs text-purple-900 dark:text-purple-300 mt-2">
            {language === 'ar' ? 'صورة واحدة • حد أقصى 5MB' : 'Single image • Max 5MB'}
          </p>
        </div>
      )}

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-4">
          {/* Thumbnails */}
          <div className="flex flex-wrap gap-2">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="relative">
                <img 
                  src={file.url} 
                  className="w-16 h-16 object-cover rounded-lg border-2 border-purple-300" 
                  alt="Upload preview"
                />
                <Button
                  onClick={() => setUploadedFiles(prev => prev.filter(f => f.id !== file.id))}
                  className="absolute -top-1 -right-1 w-5 h-5 p-0 bg-red-500 hover:bg-red-600 rounded-full"
                >
                  <X className="h-3 w-3" />
                </Button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-1 py-0.5 rounded-b-lg">
                  {(file.size / 1024).toFixed(0)}KB
                </div>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="space-y-3">
            {/* Category */}
            <select 
              value={videoCategory} 
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-4 py-3 text-base border border-gray-600"
            >
              <option value="klingai">{language === 'ar' ? 'KlingAI - سريع وعالي الجودة' : 'KlingAI - Fast & High Quality'}</option>
            </select>

            {/* Template */}
            <select 
              value={videoTemplate} 
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-4 py-3 text-base border border-gray-600"
            >
              <option value="klingai_video">{language === 'ar' ? 'فيديو KlingAI 1.6 - 5 ثوان' : 'KlingAI 1.6 Video - 5 seconds'}</option>
            </select>

            {/* Info Card */}
            <div className="text-center text-sm text-purple-900 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/30 p-3 rounded-lg">
              {language === 'ar' 
                ? '⚡ KlingAI 1.6: فيديو 5 ثوان • 1920x1080 • جودة عالية' 
                : '⚡ KlingAI 1.6: 5-second video • 1920x1080 • High Quality'
              }
            </div>

            {/* Generate Button */}
            <Button 
              onClick={handleGenerateVideo}
              disabled={isGenerating || uploadedFiles.length === 0 || isUploading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 py-4 text-lg font-medium"
            >
              {isGenerating ? (
                language === 'ar' ? 'جاري الإنشاء...' : 'Generating...'
              ) : (
                language === 'ar' ? '🎬 إنشاء فيديو' : '🎬 Generate Video'
              )}
            </Button>
          </div>
        </div>
      )}

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
    </div>
  );
}
