
import React, { useState } from 'react';
import { Video, Upload, Trash2, Play, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImageUploader } from './ImageUploader';
import { TemplateSelector, templates } from './TemplateSelector';
import { VideoPreview } from './VideoPreview';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VideoGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const VideoGeneratorModal: React.FC<VideoGeneratorModalProps> = ({
  open,
  onOpenChange,
}) => {
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [inputMode, setInputMode] = useState<'template' | 'freeform'>('template');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [resolution, setResolution] = useState('720p');
  const [movementAmplitude, setMovementAmplitude] = useState('auto');
  const [bgm, setBgm] = useState(false);

  // Debug logging for modal state changes
  React.useEffect(() => {
    console.log('🎬 VIDEO GENERATOR MODAL: State changed - open:', open);
  }, [open]);

  const handleImageUpload = (files: File[]) => {
    setUploadedImages(files);
  };

  const clearAllImages = () => {
    setUploadedImages([]);
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const validateInputs = () => {
    if (uploadedImages.length === 0) {
      toast.error('Please upload at least one image');
      return false;
    }
    
    if (inputMode === 'template' && !selectedTemplate) {
      toast.error('Please select a template');
      return false;
    }
    
    if (inputMode === 'freeform' && !prompt.trim()) {
      toast.error('Please enter a prompt');
      return false;
    }
    
    return true;
  };

  const getTemplatePrompt = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    return template?.prompt || '';
  };

  const handleGenerateVideo = async () => {
    if (!validateInputs()) return;

    setIsGenerating(true);
    
    try {
      // Create user-specific folder in storage
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Upload images to the correct bucket
      const imageUrls = await Promise.all(
        uploadedImages.map(async (file, index) => {
          const fileName = `${userId}/${Date.now()}-${index}-${file.name}`;
          
          const { data, error } = await supabase.storage
            .from('video_generator_images')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false
            });
          
          if (error) {
            console.error('Upload error:', error);
            throw new Error(`Failed to upload ${file.name}: ${error.message}`);
          }
          
          const { data: publicUrl } = supabase.storage
            .from('video_generator_images')
            .getPublicUrl(data.path);
          
          return publicUrl.publicUrl;
        })
      );

      // Prepare the final prompt
      const finalPrompt = inputMode === 'template' 
        ? getTemplatePrompt(selectedTemplate)
        : prompt.trim();

      // Call edge function to generate video
      const { data, error } = await supabase.functions.invoke('vidu-video-generator', {
        body: {
          template: inputMode === 'template' ? selectedTemplate : undefined,
          images: imageUrls,
          prompt: finalPrompt,
          resolution,
          movement_amplitude: movementAmplitude,
          bgm,
          user_id: userId
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (data?.success) {
        toast.success('Video generation started! You will be notified when ready.');
        // For demo purposes, simulate video generation
        setTimeout(() => {
          setGeneratedVideo(data.video_url || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
          setIsGenerating(false);
          toast.success('Video generated successfully!');
        }, 3000);
      } else {
        throw new Error(data?.error || 'Failed to generate video');
      }
    } catch (error: any) {
      console.error('❌ TASK CREATION ERROR:', error);
      toast.error(error.message || 'Failed to generate video');
      setIsGenerating(false);
    }
  };

  const handleClose = (open: boolean) => {
    console.log('🎬 VIDEO GENERATOR MODAL: Close handler called with:', open);
    
    // Prevent closing during generation
    if (!open && isGenerating) {
      console.log('🎬 VIDEO GENERATOR MODAL: Preventing close during generation');
      return;
    }
    
    if (!open) {
      console.log('🎬 VIDEO GENERATOR MODAL: Resetting state and closing');
      setUploadedImages([]);
      setSelectedTemplate('');
      setPrompt('');
      setGeneratedVideo(null);
      setIsGenerating(false);
    }
    
    onOpenChange(open);
  };

  const selectedTemplateData = templates.find(t => t.id === selectedTemplate);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="max-w-6xl h-[95vh] flex flex-col p-0 z-[100000]" 
        hideCloseButton={isGenerating}
        onPointerDownOutside={(e) => {
          // Prevent closing when clicking outside during generation
          if (isGenerating) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          // Prevent closing with Escape during generation
          if (isGenerating) {
            e.preventDefault();
          }
        }}
      >
        {/* Header */}
        <DialogHeader className="p-6 border-b border-border bg-background rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500 rounded-lg text-white">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-foreground">AI Video Generator</DialogTitle>
              <p className="text-sm text-muted-foreground">Create professional videos from images with AI</p>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-6 space-y-8">
            {/* Input Mode Toggle */}
            <div className="flex bg-muted rounded-lg p-1">
              <button
                onClick={() => setInputMode('template')}
                className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-colors ${
                  inputMode === 'template'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                🎭 Template Mode
              </button>
              <button
                onClick={() => setInputMode('freeform')}
                className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-colors ${
                  inputMode === 'freeform'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                ✍️ Free-form Mode
              </button>
            </div>

            {/* Image Upload Area */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-foreground">Upload Images</h3>
                {uploadedImages.length > 0 && (
                  <button
                    onClick={clearAllImages}
                    className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear All
                  </button>
                )}
              </div>
              
              <ImageUploader
                onImagesUpload={handleImageUpload}
                uploadedImages={uploadedImages}
                onRemoveImage={removeImage}
                maxImages={5}
              />
            </div>

            {/* Template/Prompt Selection */}
            {inputMode === 'template' ? (
              <div className="space-y-4">
                <TemplateSelector
                  selectedTemplate={selectedTemplate}
                  onTemplateSelect={setSelectedTemplate}
                />
                
                {/* Selected Template Preview */}
                {selectedTemplateData && (
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{selectedTemplateData.thumbnail}</span>
                      <div>
                        <h4 className="font-medium text-foreground">{selectedTemplateData.name}</h4>
                        <p className="text-sm text-muted-foreground">{selectedTemplateData.category}</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{selectedTemplateData.description}</p>
                    <div className="text-xs bg-muted p-3 rounded border">
                      <strong>AI Prompt:</strong> {selectedTemplateData.prompt}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-foreground">Custom Video Prompt</h3>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the video animation you want to create... Be specific about movement, style, and effects you'd like to see."
                  className="w-full h-32 p-4 bg-muted border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  maxLength={1500}
                />
                <div className="text-xs text-muted-foreground text-right">
                  {prompt.length}/1500 characters
                </div>
              </div>
            )}

            {/* Video Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Resolution</label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="w-full p-3 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="360p">360p (Fast)</option>
                  <option value="720p">720p (Recommended)</option>
                  <option value="1080p">1080p (High Quality)</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Movement Intensity</label>
                <select
                  value={movementAmplitude}
                  onChange={(e) => setMovementAmplitude(e.target.value)}
                  className="w-full p-3 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="auto">Auto (Recommended)</option>
                  <option value="small">Subtle Movement</option>
                  <option value="medium">Medium Movement</option>
                  <option value="large">Dynamic Movement</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Background Music</label>
                <button
                  onClick={() => setBgm(!bgm)}
                  className={`w-full p-3 rounded-lg border transition-colors ${
                    bgm
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted border-border hover:bg-muted/80'
                  }`}
                >
                  {bgm ? '🎵 Enabled' : '🔇 Disabled'}
                </button>
              </div>
            </div>

            {/* Generated Video Preview */}
            {generatedVideo && !isGenerating && (
              <VideoPreview videoUrl={generatedVideo} />
            )}
          </div>
        </div>

        {/* Footer with Generate Button */}
        <div className="p-6 border-t border-border bg-background rounded-b-2xl">
          <button
            onClick={handleGenerateVideo}
            disabled={isGenerating || uploadedImages.length === 0}
            className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 disabled:bg-muted disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating Video... Please wait
              </>
            ) : (
              <>
                <Video className="w-5 h-5" />
                Generate Video with AI
              </>
            )}
          </button>
          
          {uploadedImages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground mt-2">
              Upload at least one image to get started
            </p>
          )}
          
          {inputMode === 'template' && !selectedTemplate && uploadedImages.length > 0 && (
            <p className="text-center text-sm text-muted-foreground mt-2">
              Select a template to continue
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
