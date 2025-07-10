
import React, { useState } from 'react';
import { X, Video, Upload, Trash2, Play, Download } from 'lucide-react';
import { ImageUploader } from './ImageUploader';
import { TemplateSelector } from './TemplateSelector';
import { VideoPreview } from './VideoPreview';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VideoGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VideoGeneratorModal: React.FC<VideoGeneratorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [inputMode, setInputMode] = useState<'template' | 'freeform'>('template');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [resolution, setResolution] = useState('360p');
  const [movementAmplitude, setMovementAmplitude] = useState('auto');
  const [bgm, setBgm] = useState(false);

  if (!isOpen) return null;

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

  const handleGenerateVideo = async () => {
    if (!validateInputs()) return;

    setIsGenerating(true);
    
    try {
      // Convert images to base64 or upload to storage
      const imageUrls = await Promise.all(
        uploadedImages.map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);
          
          const { data, error } = await supabase.storage
            .from('video_generator_images')
            .upload(`${Date.now()}-${file.name}`, file);
          
          if (error) throw error;
          
          const { data: publicUrl } = supabase.storage
            .from('video_generator_images')
            .getPublicUrl(data.path);
          
          return publicUrl.publicUrl;
        })
      );

      // Call edge function to generate video
      const { data, error } = await supabase.functions.invoke('vidu-video-generator', {
        body: {
          template: inputMode === 'template' ? selectedTemplate : undefined,
          images: imageUrls,
          prompt: prompt.trim() || undefined,
          resolution,
          movement_amplitude: movementAmplitude,
          bgm,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Video generation started! You will be notified when ready.');
        // Here you would typically poll for completion or use webhooks
        // For now, we'll simulate success
        setTimeout(() => {
          setGeneratedVideo(data.video_url || 'https://example.com/generated-video.mp4');
          setIsGenerating(false);
        }, 30000); // 30 second simulation
      } else {
        throw new Error(data.error || 'Failed to generate video');
      }
    } catch (error: any) {
      console.error('Video generation error:', error);
      toast.error(error.message || 'Failed to generate video');
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    setUploadedImages([]);
    setSelectedTemplate('');
    setPrompt('');
    setGeneratedVideo(null);
    setIsGenerating(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500 rounded-lg text-white">
              <Video className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">AI Video Generator</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Input Mode Toggle */}
          <div className="flex bg-muted rounded-lg p-1">
            <button
              onClick={() => setInputMode('template')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                inputMode === 'template'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Template Mode
            </button>
            <button
              onClick={() => setInputMode('freeform')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                inputMode === 'freeform'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Free-form Mode
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
              maxImages={inputMode === 'template' ? 5 : 5}
            />
          </div>

          {/* Template/Prompt Selection */}
          {inputMode === 'template' ? (
            <TemplateSelector
              selectedTemplate={selectedTemplate}
              onTemplateSelect={setSelectedTemplate}
            />
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-foreground">Video Prompt</h3>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the video you want to create..."
                className="w-full h-32 p-4 bg-muted border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                maxLength={1500}
              />
              <div className="text-xs text-muted-foreground text-right">
                {prompt.length}/1500 characters
              </div>
            </div>
          )}

          {/* Video Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Resolution</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full p-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="360p">360p</option>
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Movement</label>
              <select
                value={movementAmplitude}
                onChange={(e) => setMovementAmplitude(e.target.value)}
                className="w-full p-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="auto">Auto</option>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Background Music</label>
              <button
                onClick={() => setBgm(!bgm)}
                className={`w-full p-2 rounded-lg border transition-colors ${
                  bgm
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted border-border hover:bg-muted/80'
                }`}
              >
                {bgm ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>

          {/* Generated Video Preview */}
          {generatedVideo && (
            <VideoPreview videoUrl={generatedVideo} />
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerateVideo}
            disabled={isGenerating}
            className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 disabled:bg-muted disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating Video...
              </>
            ) : (
              <>
                <Video className="w-5 h-5" />
                Generate Video
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
