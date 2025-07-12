import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, Loader2 } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { supabase } from '@/integrations/supabase/client';
import { ImageTypeSelector, ImageTypeOption } from './ImageTypeSelector';

export interface SimplifiedUploadedFile {
  id: string;
  name: string;
  url: string;
  publicUrl: string;
  type: string;
  size: number;
  preview?: string;
  imageType?: ImageTypeOption;
}

interface SimplifiedFileUploadProps {
  onFilesUploaded: (files: SimplifiedUploadedFile[]) => void;
  onUpdateFiles: (files: SimplifiedUploadedFile[]) => void;
  uploadedFiles: SimplifiedUploadedFile[];
  onRemoveFile: (fileId: string) => void;
  isUploading: boolean;
  disabled?: boolean;
  onExamplePromptSelect?: (prompt: string) => void;
  onAutoSwitchMode?: (mode: string) => void;
  activeTrigger?: string;
}

export function SimplifiedFileUpload({
  onFilesUploaded,
  onUpdateFiles,
  uploadedFiles,
  onRemoveFile,
  isUploading,
  disabled = false,
  onExamplePromptSelect,
  onAutoSwitchMode,
  activeTrigger
}: SimplifiedFileUploadProps) {
  const { language } = useTheme();
  const { showError, showSuccess } = useToastHelper();
  const [hideAfterUpload, setHideAfterUpload] = useState(false);

  // Video mode state variables
  const [videoCategory, setVideoCategory] = useState('custom');
  const [videoTemplate, setVideoTemplate] = useState('image2video');
  const [isGenerating, setIsGenerating] = useState(false);

  // Template prompts function with ALL 33 templates
  const getTemplatePrompt = (template: string) => {
    const prompts: Record<string, string> = {
      // Custom
      image2video: "Generate creative video animation",
      
      // Fun & Interactive (13 templates)
      make_face: "The camera remains stationary. The subject stands still with hands on hips, head slightly tilted to the left, and a smiling expression. Then, the subject begins walking forward—directly toward the camera. Upon reaching the front of the lens, they simultaneously strike a playful pose and expression: mouth wide open, tongue sticking out, and eyes rolled upward.",
      blow_kiss: "The subject gently leans forward, blows a kiss toward the camera from just below the lips using the right hand, then naturally waves at the camera. Afterward, she unfolds a sweet and warm smile.",
      hair_swap: "The character transforms their hairstyle and color smoothly.",
      flying: "The character begins flying forward like a superhero through the air.",
      nap_me: "The character lies down and covers themselves with a blanket for sleep.",
      pilot: "The character appears in an airplane cockpit as a pilot.",
      interaction: "The two people in the picture face the camera, each extending a hand and making a heart shape in front of their chest.",
      hugging_pro: "The two subjects in the scene turn towards each other and begin to hug.",
      carry_me: "One person in the scene begins to carry another on their back.",
      emotionlab: "The character transitions from neutral to smiling expression.",
      wild_laugh: "The character breaks into wild laughter.",
      surprised: "The character shows surprise expression.",
      send_roses: "The person picks up roses and presents them to another person.",
      
      // Transform & Style (15 templates)
      cartoon_doll: "The character in the picture jumped, turning into a smooth doll version of themselves.",
      style_me: "The character puts on a crisp suit and walks gracefully toward the camera.",
      toy_me: "The subject slowly turns around and transforms into a figurine on a base.",
      muscling: "A man takes off his shirt, revealing his muscular chest.",
      muscling_360p: "Lower resolution muscle reveal animation.",
      fairy_me: "The character transforms into a magical fairy with wings.",
      yayoi_kusama_style: "Style transformation into polka dot art style.",
      irasutoya: "Style transformation into Japanese illustration style.",
      american_comic: "Style transformation into Rick and Morty animation style.",
      simpsons_comic: "Style transformation into Simpsons cartoon style.",
      child_memory: "A child version appears and embraces the subject.",
      outfit_show: "The model turns 180 degrees to showcase clothing details.",
      spin360: "The subject rotates 360 degrees to show all angles.",
      live_memory: "Subtle movements like blinking and breathing.",
      sakura_season: "Cherry blossom petals fall while subject looks up smiling.",
      
      // Camera & Motion (4 templates)
      zoom_in_fast: "Camera steadily zooms in isolating details of the subject.",
      zoom_out_image: "Camera pulls back revealing the surrounding environment.",
      zoom_out_startend: "Transition from close-up to wide shot between two images.",
      walk_forward: "Character walks forward toward camera naturally."
    };
    return prompts[template] || "Generate creative video animation";
  };

  // Video generation function
  const handleGenerateVideo = async () => {
    try {
      setIsGenerating(true);
      
      // Get user authentication
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Authentication required');
      }
      
      // Prepare images (already base64 from upload)
      const base64Images = uploadedFiles.map(file => file.url);
      
      if (base64Images.length === 0) {
        throw new Error('No images uploaded');
      }
      
      // Determine prompt
      const isCustom = videoTemplate === 'image2video';
      const promptToUse = isCustom ? 'Generate creative video animation' : getTemplatePrompt(videoTemplate);
      
      console.log('🎬 Starting video generation:', { template: videoTemplate, imageCount: base64Images.length });
      
      // Call Vidu API
      const response = await supabase.functions.invoke('vidu-video-generator', {
        body: {
          template: videoTemplate,
          images: base64Images,
          prompt: promptToUse,
          user_id: user.id,
          mode: isCustom ? 'image2video' : 'template2video'
        }
      });
      
      if (response.error) {
        throw new Error(response.error.message || 'Video generation failed');
      }
      
      if (response.data?.success) {
        showSuccess('🎬 Video generation started! Check your chat for updates.');
        // Clear files after successful generation
        onUpdateFiles([]);
      } else {
        throw new Error(response.data?.error || 'Video generation failed');
      }
      
    } catch (error) {
      console.error('❌ Video generation error:', error);
      showError(error.message || 'Video generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const generatePreview = useCallback((file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve(undefined);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const result = e.target?.result as string;
          resolve(result);
        } catch (error) {
          console.error('Preview generation failed:', error);
          resolve(undefined);
        }
      };
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(file);
    });
  }, []);

  const uploadFiles = useCallback(async (files: File[]) => {
    if (!files || files.length === 0) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      console.log('📁 CLAUDE WAY - Processing', files.length, 'files directly');

      const uploadPromises = Array.from(files).map(async (file): Promise<SimplifiedUploadedFile | null> => {
        try {
          // Validate file
          if (file.size > 10 * 1024 * 1024) {
            throw new Error(`File ${file.name} is too large (max 10MB)`);
          }

          if (!file.type.startsWith('image/') && file.type !== 'text/plain') {
            throw new Error(`File type ${file.type} not supported`);
          }

          // Generate base64 data (this is what we'll send to brain)
          const base64Data = await generatePreview(file);
          
          if (!base64Data) {
            throw new Error(`Failed to process ${file.name}`);
          }

          // Create file object with base64 as the main data
          const fileId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
          
          return {
            id: fileId,
            name: file.name,
            url: base64Data,           // BASE64 DATA (not storage URL)
            publicUrl: base64Data,     // Same base64 data
            type: file.type,
            size: file.size,
            preview: base64Data        // For display
          };

        } catch (error) {
          console.error(`❌ Failed to process ${file.name}:`, error);
          return null;
        }
      });

      const results = await Promise.allSettled(uploadPromises);
      const successfulUploads = results
        .filter((result): result is PromiseFulfilledResult<SimplifiedUploadedFile> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value!);

      if (successfulUploads.length > 0) {
        console.log('🎉 CLAUDE WAY SUCCESS:', successfulUploads.length, 'files processed');
        onFilesUploaded(successfulUploads);
        showSuccess(`Successfully processed ${successfulUploads.length} file(s)`);
        
        // AUTO-SWITCH TO VISION MODE FOR IMAGES
        const hasImages = successfulUploads.some(file => file.type?.startsWith('image/'));
        if (hasImages && onAutoSwitchMode) {
          console.log('🔍 AUTO-SWITCH: Images detected, switching to vision mode');
          onAutoSwitchMode('vision');
        }
      }

      const failedUploads = results.filter(result => result.status === 'rejected').length;
      if (failedUploads > 0) {
        showError(`${failedUploads} file(s) failed to process`);
      }

      return successfulUploads;

    } catch (error) {
      console.error('❌ Processing failed:', error);
      showError('Processing failed. Please try again.');
    }
  }, [generatePreview, showError, showSuccess, onFilesUploaded, onAutoSwitchMode]);

  const updateFileImageType = (fileId: string, imageType: ImageTypeOption) => {
    console.log('🏷️ TYPE ASSIGNMENT AUDIT:', {
      fileId: fileId,
      imageTypeName: imageType.name,
      imageTypeId: imageType.id,
      hasContext: !!imageType.context,
      contextLength: imageType.context?.length || 0
    });
    
    const updatedFiles = uploadedFiles.map(file => 
      file.id === fileId ? { ...file, imageType } : file
    );
    onUpdateFiles(updatedFiles);
    
    // Send example prompt to parent
    if (onExamplePromptSelect && imageType.examplePrompt) {
      // onExamplePromptSelect(imageType.examplePrompt); // COMMENT THIS OUT
    }
  };

  const handleRemoveFile = (fileId: string) => {
    onRemoveFile(fileId);
    // Reset hideAfterUpload when files are removed
    if (uploadedFiles.length <= 1) {
      setHideAfterUpload(false);
    }
  };

  // Handle file selection from PlusMenu
  React.useEffect(() => {
    const handleFileInput = (event: CustomEvent<{ files: FileList }>) => {
      if (event.detail?.files) {
        const fileArray = Array.from(event.detail.files).filter((file: File) => 
          file.type.startsWith('image/') || file.type === 'text/plain'
        );
        
        if (fileArray.length === 0) {
          showError('Please select valid image or text files');
          return;
        }

        uploadFiles(fileArray);
      }
    };

    window.addEventListener('wakti-file-selected', handleFileInput as EventListener);
    return () => window.removeEventListener('wakti-file-selected', handleFileInput as EventListener);
  }, [uploadFiles, showError]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* Uploaded Files Display - Keep visible until AI processing completes */}
      {!hideAfterUpload && uploadedFiles.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">
            {language === 'ar' ? 'الملفات المرفوعة' : 'Uploaded Files'}
          </h3>
          <div className="space-y-3">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-white/10 dark:bg-white/5 border border-white/20"
              >
                {/* 80x80 Thumbnail */}
                {file.preview && (
                  <div className="relative">
                    <img 
                      src={file.preview} 
                      alt={file.name}
                      className="w-20 h-20 rounded-lg object-cover flex-shrink-0 border border-white/20"
                    />
                    {/* Delete button on thumbnail */}
                    <Button
                      onClick={() => handleRemoveFile(file.id)}
                      variant="ghost"
                      size="sm"
                      className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full bg-red-500 text-white hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                
                {/* File info and controls */}
                <div className="flex-1 min-w-0 space-y-2">
                  {/* File name and size */}
                  <div>
                    <p className="text-sm font-medium text-foreground truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)} • Base64: {file.url ? '✅ Ready' : '❌ Invalid'}
                    </p>
                  </div>
                  
                  {/* Type selector and description */}
                  <div className="flex items-start gap-2">
                    <ImageTypeSelector
                      selectedType={file.imageType?.id || null}
                      onTypeSelect={(type) => updateFileImageType(file.id, type)}
                      compact={true}
                    />
                  </div>
                  
                  {/* Show description when type is selected */}
                  {file.imageType && (
                    <div className="text-xs text-muted-foreground bg-primary/5 px-2 py-1 rounded border border-primary/20">
                      <span className="text-primary font-medium">
                        {file.imageType.icon} {file.imageType.name[language || 'en']}:
                      </span> {file.imageType.description[language || 'en']}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Video Mode Controls - ADD AFTER EXISTING UPLOAD DISPLAY */}
      {activeTrigger === 'video' && uploadedFiles.length > 0 && (
        <div className="mt-3 p-4 rounded-lg bg-purple-900/20 border border-pink-500/30 backdrop-blur-sm">
          {/* Video thumbnails with purple styling */}
          <div className="flex flex-wrap gap-2 mb-3">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="relative group">
                <img 
                  src={file.preview || file.url} 
                  className="w-16 h-16 object-cover rounded-lg border-2 border-purple-300 shadow-md group-hover:border-purple-400 transition-colors" 
                  alt={`Video source ${index + 1}`}
                />
                <button 
                  onClick={() => handleRemoveFile(file.id)} 
                  className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center shadow-lg transition-colors font-bold"
                  title="Remove image"
                >
                  ×
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-1 py-0.5 rounded-b-lg">
                  {(file.size / 1024).toFixed(0)}KB
                </div>
              </div>
            ))}
          </div>
          
          {/* Controls in ONE LINE - Responsive Layout */}
          <div className="flex gap-2 items-center flex-wrap">
            {/* Category Dropdown */}
            <select 
              value={videoCategory} 
              onChange={(e) => setVideoCategory(e.target.value)}
              className="flex-1 min-w-[120px] bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-purple-400 focus:outline-none transition-colors"
            >
              <option value="custom">Custom</option>
              <option value="fun">Fun & Interactive</option>
              <option value="transform">Transform & Style</option>
              <option value="camera">Camera & Motion</option>
            </select>
            
            {/* Template Dropdown */}
            <select 
              value={videoTemplate} 
              onChange={(e) => setVideoTemplate(e.target.value)}
              className="flex-1 min-w-[140px] bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-purple-400 focus:outline-none transition-colors"
            >
              {videoCategory === 'custom' && (
                <option value="image2video">Custom Prompt</option>
              )}
              {videoCategory === 'fun' && (
                <>
                  <option value="make_face">Make a Face</option>
                  <option value="blow_kiss">Blow a Kiss</option>
                  <option value="hair_swap">Hair Swap</option>
                  <option value="flying">Flying</option>
                  <option value="nap_me">Nap Me</option>
                  <option value="pilot">Pilot</option>
                  <option value="interaction">Finger Heart</option>
                  <option value="hugging_pro">Hugging Pro</option>
                  <option value="carry_me">Carry Me</option>
                  <option value="emotionlab">Smile</option>
                  <option value="wild_laugh">Wild Laugh</option>
                  <option value="surprised">Surprised</option>
                  <option value="send_roses">Send Roses</option>
                </>
              )}
              {videoCategory === 'transform' && (
                <>
                  <option value="cartoon_doll">Cartoon Doll</option>
                  <option value="style_me">Style Me</option>
                  <option value="toy_me">Toy Me</option>
                  <option value="muscling">Muscling</option>
                  <option value="muscling_360p">Muscling 360p</option>
                  <option value="fairy_me">Fairy Me</option>
                  <option value="yayoi_kusama_style">Yayoi Kusama</option>
                  <option value="irasutoya">Irasutoya</option>
                  <option value="american_comic">American Comic</option>
                  <option value="simpsons_comic">Simpsons</option>
                  <option value="child_memory">Child Memory</option>
                  <option value="outfit_show">Outfit Show</option>
                  <option value="spin360">Spin 360</option>
                  <option value="live_memory">Live Memory</option>
                  <option value="sakura_season">Sakura Season</option>
                </>
              )}
              {videoCategory === 'camera' && (
                <>
                  <option value="zoom_in_fast">Zoom In Fast</option>
                  <option value="zoom_out_image">Zoom Out</option>
                  <option value="zoom_out_startend">Zoom Out Start-End</option>
                  <option value="walk_forward">Walk Forward</option>
                </>
              )}
            </select>
            
            {/* Generate Button with Purple-Pink Gradient */}
            <button 
              onClick={handleGenerateVideo}
              disabled={isGenerating || uploadedFiles.length === 0}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-6 py-2 rounded-lg text-sm font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 whitespace-nowrap flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Generating...
                </>
              ) : (
                <>
                  🎬 Generate Video
                </>
              )}
            </button>
          </div>
          
          {/* Video Info & Usage */}
          <div className="mt-3 flex items-center justify-between text-xs">
            <div className="text-gray-400">
              <span className="font-medium">4-second clips</span> • <span>720p quality</span> • <span>$0.20 per video</span>
            </div>
            <div className="text-purple-300 font-medium">
              15/month limit
            </div>
          </div>
        </div>
      )}

      {isUploading && (
        <div className="flex items-center justify-center gap-2 p-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">
            {language === 'ar' ? 'جاري المعالجة...' : 'Processing...'}
          </span>
        </div>
      )}
    </div>
  );
}
