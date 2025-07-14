
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
import { useVideoStatusPoller } from '@/hooks/useVideoStatusPoller';
import { Upload, Camera, Download, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IsolatedVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IsolatedVideoDialog({ open, onOpenChange }: IsolatedVideoDialogProps) {
  const { language } = useTheme();
  const { showSuccess, showError } = useToastHelper();
  const { addTask, activeTasks } = useVideoStatusPoller();

  // State management - completely isolated
  const [screen, setScreen] = useState<'upload' | 'generating'>('upload');
  const [image, setImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [movement, setMovement] = useState('auto');
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Find current task from active tasks
  const currentTask = currentTaskId ? activeTasks.find(task => task.task_id === currentTaskId) : null;
  const progress = currentTask?.status === 'completed' ? 100 : currentTask?.status === 'processing' ? 75 : 0;

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
        setCurrentTaskId(null);
        setVideoUrl(null);
      }, 200);
    }
  }, [open]);

  // Listen for task completion
  React.useEffect(() => {
    if (currentTask?.status === 'completed' && currentTask.video_url) {
      setVideoUrl(currentTask.video_url);
      setIsGenerating(false);
      showSuccess('Your video is ready!');
    } else if (currentTask?.status === 'failed') {
      setIsGenerating(false);
      setScreen('upload');
      showError(currentTask.error_message || 'Video generation failed');
    }
  }, [currentTask, showSuccess, showError]);

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

    try {
      // Clear any stuck processing tasks first
      await supabase
        .from('video_generation_tasks')
        .update({ status: 'failed' })
        .eq('user_id', user.id)
        .eq('status', 'processing')
        .eq('template', 'isolated_video');

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

      const taskId = data.taskUUID;
      setCurrentTaskId(taskId);

      // Add task to the poller
      addTask({
        task_id: taskId,
        status: 'processing'
      });

      console.log('✅ ISOLATED VIDEO: Task added to poller:', taskId);

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
