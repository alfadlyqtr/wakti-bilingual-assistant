
import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { Upload, Camera, Download, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IsolatedVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IsolatedVideoDialog({ open, onOpenChange }: IsolatedVideoDialogProps) {
  const { language } = useTheme();
  const { showSuccess, showError } = useToastHelper();

  // State management - completely isolated
  const [screen, setScreen] = useState<'upload' | 'generating'>('upload');
  const [image, setImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [movement, setMovement] = useState('auto');
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [taskUUID, setTaskUUID] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Reset all state when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      // Complete reset when closed
      setTimeout(() => {
        setScreen('upload');
        setImage(null);
        setPrompt('');
        setMovement('auto');
        setIsUploading(false);
        setIsGenerating(false);
        setProgress(0);
        setVideoUrl(null);
        setTaskUUID(null);
      }, 200);
    }
  }, [open]);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await supabase.functions.invoke('upload-for-video', {
        body: formData
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setImage(data.base64);
      console.log('✅ ISOLATED VIDEO: Image uploaded and converted to base64');
    } catch (error: any) {
      console.error('❌ ISOLATED VIDEO: Upload failed', error);
      showError('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset input
    if (event.target) {
      event.target.value = '';
    }
  };

  const pollForResults = async (taskUUID: string) => {
    const maxPolls = 60; // 5 minutes with 5-second intervals
    let pollCount = 0;

    const poll = async (): Promise<void> => {
      try {
        pollCount++;
        console.log(`🔍 POLLING: Attempt ${pollCount}/${maxPolls} for task ${taskUUID}`);

        const { data, error } = await supabase.functions.invoke('runware-get-response', {
          body: { taskUUID }
        });

        if (error) throw error;

        // Check if we have results
        if (data.data && data.data.length > 0) {
          const result = data.data.find((item: any) => item.taskUUID === taskUUID);
          
          if (result) {
            if (result.status === 'success' && result.videoURL) {
              setProgress(100);
              setVideoUrl(result.videoURL);
              setIsGenerating(false);
              showSuccess('Your video is ready!');
              return;
            } else if (result.status === 'error') {
              throw new Error(result.message || 'Video generation failed');
            }
          }
        }

        // Check errors array
        if (data.errors && data.errors.length > 0) {
          const error = data.errors.find((err: any) => err.taskUUID === taskUUID);
          if (error) {
            throw new Error(error.message || 'Video generation failed');
          }
        }

        // Continue polling if still pending and within limits
        if (pollCount < maxPolls) {
          setTimeout(poll, 5000); // Poll every 5 seconds
        } else {
          throw new Error('Video generation timed out. Please try again.');
        }

      } catch (error: any) {
        console.error('❌ POLLING ERROR:', error);
        setIsGenerating(false);
        setScreen('upload');
        showError(error.message || 'Failed to check video status');
      }
    };

    // Start polling after initial delay
    setTimeout(poll, 3000);
  };

  const handleGenerateVideo = async () => {
    if (!image || !prompt.trim()) {
      showError('Please upload an image and enter a description');
      return;
    }

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      showError('Please sign in to generate videos');
      return;
    }

    setIsGenerating(true);
    setScreen('generating');
    setProgress(0);

    try {
      const { data, error } = await supabase.functions.invoke('generate-video-isolated', {
        body: {
          image_base64: image,
          prompt: prompt.trim(),
          movement_style: movement,
          user_id: user.id
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setTaskUUID(data.taskUUID);

      // Start progress simulation (gradually increase over time)
      let currentProgress = 0;
      const progressInterval = setInterval(() => {
        currentProgress += 2;
        setProgress(Math.min(currentProgress, 90)); // Stop at 90% until completion
        
        if (currentProgress >= 90) {
          clearInterval(progressInterval);
        }
      }, 2000);

      // Start polling for results
      pollForResults(data.taskUUID);

    } catch (error: any) {
      console.error('❌ ISOLATED VIDEO: Generation failed', error);
      showError(error.message || 'Failed to generate video');
      setScreen('upload');
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (videoUrl) {
      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = `video-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showSuccess('Video downloaded successfully!');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto" hideCloseButton={isGenerating}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            {language === 'ar' ? 'إنشاء فيديو' : 'Create Video'}
          </DialogTitle>
        </DialogHeader>

        {screen === 'upload' && (
          <div className="space-y-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'رفع صورة' : 'Upload Image'}</Label>
              
              {!image ? (
                <div className="space-y-2">
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                      "hover:border-primary/50 hover:bg-primary/5"
                    )}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar' ? 'انقر لرفع صورة' : 'Click to upload image'}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="flex-1"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {language === 'ar' ? 'تحميل ملف' : 'Upload File'}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={isUploading}
                      className="flex-1"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      {language === 'ar' ? 'كاميرا' : 'Camera'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <img 
                    src={image} 
                    alt="Uploaded" 
                    className="w-full h-48 object-cover rounded-lg border"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setImage(null)}
                    className="w-full"
                  >
                    {language === 'ar' ? 'تغيير الصورة' : 'Change Image'}
                  </Button>
                </div>
              )}
            </div>

            {/* Movement Style */}
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'نمط الحركة' : 'Movement Style'}</Label>
              <select
                value={movement}
                onChange={(e) => setMovement(e.target.value)}
                className="w-full p-2 border rounded-md bg-background"
              >
                <option value="auto">{language === 'ar' ? 'تلقائي' : 'Auto'}</option>
                <option value="slow">{language === 'ar' ? 'بطيء' : 'Slow'}</option>
                <option value="medium">{language === 'ar' ? 'متوسط' : 'Medium'}</option>
                <option value="fast">{language === 'ar' ? 'سريع' : 'Fast'}</option>
              </select>
            </div>

            {/* Prompt */}
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'وصف الفيديو' : 'Describe your video'}</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={language === 'ar' ? 'اكتب وصفاً للفيديو الذي تريد إنشاءه...' : 'Describe what you want to happen in the video...'}
                rows={3}
              />
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerateVideo}
              disabled={!image || !prompt.trim() || isUploading || isGenerating}
              className="w-full"
            >
              {language === 'ar' ? 'إنشاء الآن' : 'Generate Now'}
            </Button>

            {/* Hidden file inputs */}
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
        )}

        {screen === 'generating' && (
          <div className="space-y-6 text-center py-4">
            {!videoUrl ? (
              <>
                {/* Progress */}
                <div className="space-y-4">
                  <div className="h-16 w-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                    <Video className="h-8 w-8 text-primary animate-pulse" />
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-2">
                      {language === 'ar' ? 'جاري إنشاء الفيديو...' : 'Creating your video...'}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {language === 'ar' ? 'يرجى الانتظار، قد يستغرق هذا بضع دقائق...' : 'Please wait, this may take a few minutes...'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Progress value={progress} className="w-full" />
                    <p className="text-xs text-muted-foreground">
                      {Math.round(progress)}% {language === 'ar' ? 'مكتمل' : 'complete'}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Video Result */}
                <div className="space-y-4">
                  <h3 className="font-medium text-green-600">
                    {language === 'ar' ? '✅ تم إنشاء الفيديو بنجاح!' : '✅ Video created successfully!'}
                  </h3>
                  
                  <video
                    src={videoUrl}
                    controls
                    className="w-full rounded-lg border"
                    autoPlay
                    muted
                  />
                  
                  <Button onClick={handleDownload} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'تحميل الفيديو' : 'Download Video'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
