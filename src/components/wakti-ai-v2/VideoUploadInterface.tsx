
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Upload, Camera, Sparkles, Key } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { supabase } from '@/integrations/supabase/client';

interface VideoUploadInterfaceProps {
  onClose: () => void;
  onVideoGenerated: (data: any) => void;
}

export function VideoUploadInterface({ onClose, onVideoGenerated }: VideoUploadInterfaceProps) {
  const { language } = useTheme();
  const { showError, showSuccess } = useToastHelper();
  
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [videoCategory, setVideoCategory] = useState('custom');
  const [videoTemplate, setVideoTemplate] = useState('image2video');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showApiUpload, setShowApiUpload] = useState(false);
  const [apiImageUrl, setApiImageUrl] = useState('');
  
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

  const handleApiUpload = async () => {
    if (!apiImageUrl) return;
    
    try {
      // Validate URL format
      new URL(apiImageUrl);
      
      const newFile = {
        id: Date.now() + Math.random(),
        name: 'API Upload',
        url: apiImageUrl,
        size: 0
      };
      
      setUploadedFiles(prev => [...prev, newFile]);
      setShowApiUpload(false);
      setApiImageUrl('');
      showSuccess("Image loaded from URL successfully!");
    } catch (error) {
      showError("Invalid URL format");
      console.error('API upload failed:', error);
    }
  };

  // ALL 33 TEMPLATES
  const getTemplatePrompt = (template: string) => {
    const prompts: Record<string, string> = {
      // Custom (1)
      image2video: "Generate creative video animation",
      
      // Fun & Interactive (13)
      make_face: "Person walks toward camera, then makes playful face with tongue out and eyes rolled up",
      blow_kiss: "Person leans forward, blows a kiss toward camera, then waves with a warm smile",
      hair_swap: "Character's hairstyle and color transforms smoothly",
      flying: "Character flies forward through the air like a superhero",
      nap_me: "Character lies down and covers themselves with a blanket for sleep",
      pilot: "Character appears in airplane cockpit as a pilot",
      interaction: "Two people face camera, each making heart shape with hands",
      hugging_pro: "Two people turn toward each other and embrace in a hug",
      carry_me: "One person carries another on their back",
      emotionlab: "Character's expression transitions from neutral to smiling",
      wild_laugh: "Character breaks into joyful wild laughter",
      surprised: "Character shows sudden surprise expression",
      send_roses: "Person picks up roses and presents them to another person",
      
      // Transform & Style (15)
      cartoon_doll: "Character jumps and transforms into smooth doll version",
      style_me: "Character puts on crisp suit and walks gracefully toward camera",
      toy_me: "Character slowly turns around and transforms into figurine on base",
      muscling: "Man takes off shirt revealing muscular chest",
      muscling_360p: "Lower resolution muscle reveal animation",
      fairy_me: "Character transforms into magical fairy with wings appearing",
      yayoi_kusama_style: "Character transforms with polka dot pattern covering everything",
      irasutoya: "Character transforms into Japanese illustration art style",
      american_comic: "Character transforms into Rick and Morty animation style",
      simpsons_comic: "Character transforms into Simpsons cartoon style",
      child_memory: "Child version appears and embraces the adult subject",
      outfit_show: "Model turns 180 degrees to showcase clothing details",
      spin360: "Subject rotates 360 degrees to show all angles",
      live_memory: "Subtle lifelike movements like blinking and breathing",
      sakura_season: "Cherry blossom petals fall while subject looks up smiling",
      
      // Camera & Motion (4)
      zoom_in_fast: "Camera steadily zooms in isolating details of subject",
      zoom_out_image: "Camera pulls back revealing surrounding environment",
      zoom_out_startend: "Transition from close-up to wide shot",
      walk_forward: "Character walks forward toward camera naturally"
    };
    return prompts[template] || "Generate creative video animation";
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

      // Use storage URLs instead of base64
      const imageUrls = uploadedFiles.map(file => file.url);
      const isCustom = videoTemplate === 'image2video';
      const promptToUse = isCustom ? 'Generate creative video animation' : getTemplatePrompt(videoTemplate);

      console.log('🎬 GENERATING VIDEO WITH REPLICATE:', {
        template: videoTemplate,
        imageCount: imageUrls.length,
        userId: user.id
      });

      // Call new Replicate edge function
      const response = await supabase.functions.invoke('replicate-video-generator', {
        body: {
          template: videoTemplate,
          images: imageUrls,
          prompt: promptToUse,
          mode: isCustom ? 'image2video' : 'template2video',
          user_id: user.id
        }
      });

      if (response.error) throw new Error(response.error.message);

      if (response.data?.success) {
        showSuccess('🎬 Video generation started with Replicate! You will be notified when it\'s ready.');
        onVideoGenerated({ 
          jobId: response.data.job_id, 
          template: videoTemplate,
          taskId: response.data.job_id
        });
        onClose();
      } else {
        throw new Error('Video generation failed to start');
      }

    } catch (error: any) {
      console.error('❌ VIDEO GENERATION ERROR:', error);
      showError(error.message || 'Video generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  // Update template when category changes
  const handleCategoryChange = (category: string) => {
    setVideoCategory(category);
    // Set default template for each category
    switch (category) {
      case 'custom':
        setVideoTemplate('image2video');
        break;
      case 'fun':
        setVideoTemplate('make_face');
        break;
      case 'transform':
        setVideoTemplate('cartoon_doll');
        break;
      case 'camera':
        setVideoTemplate('zoom_in_fast');
        break;
      default:
        setVideoTemplate('image2video');
    }
  };

  return (
    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-500/30 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
          {language === 'ar' ? '🎬 إنشاء فيديو (Replicate)' : '🎬 Create Video (Replicate)'}
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
              {language === 'ar' ? 'ارفع صورك وحولها إلى فيديوهات مذهلة بواسطة Replicate' : 'Upload your images and create amazing videos with Replicate'}
            </p>
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button 
              onClick={() => fileInputRef.current?.click()} 
              className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-700"
              disabled={isUploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? (language === 'ar' ? 'جاري الرفع...' : 'Uploading...') : (language === 'ar' ? 'اختر صور' : 'Choose Images')}
            </Button>
            <Button 
              onClick={() => cameraInputRef.current?.click()} 
              className="bg-pink-600 hover:bg-pink-700"
              disabled={isUploading}
            >
              <Camera className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'كاميرا' : 'Camera'}
            </Button>
            <Button 
              onClick={() => setShowApiUpload(!showApiUpload)}
              variant="outline" 
              className="border-purple-300 text-purple-900 dark:text-purple-300"
            >
              <Key className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'رابط صورة' : 'API Upload'}
            </Button>
          </div>

          {/* API Upload Panel */}
          {showApiUpload && (
            <div className="mt-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
              <Label htmlFor="api-url" className="text-sm font-medium">
                {language === 'ar' ? 'رابط الصورة' : 'Image URL'}
              </Label>
              <Input
                id="api-url"
                type="url"
                placeholder="https://example.com/image.jpg"
                value={apiImageUrl}
                onChange={(e) => setApiImageUrl(e.target.value)}
                className="mt-2"
              />
              <Button 
                onClick={handleApiUpload}
                className="mt-2 w-full"
                disabled={!apiImageUrl}
              >
                {language === 'ar' ? 'تحميل من الرابط' : 'Load from URL'}
              </Button>
            </div>
          )}

          <p className="text-xs text-purple-900 dark:text-purple-300 mt-2">
            {language === 'ar' ? 'حتى 5 صور • حد أقصى 5MB لكل صورة' : 'Up to 5 images • Max 5MB per image'}
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
                  {file.size > 0 ? `${(file.size / 1024).toFixed(0)}KB` : 'API'}
                </div>
              </div>
            ))}
          </div>

          {/* Add More Button */}
          <div className="flex gap-2">
            <Button 
              onClick={() => fileInputRef.current?.click()} 
              variant="outline" 
              size="sm"
              className="border-purple-300 text-purple-900 dark:text-purple-300"
              disabled={isUploading}
            >
              <Upload className="h-3 w-3 mr-1" />
              {isUploading ? (language === 'ar' ? 'جاري الرفع...' : 'Uploading...') : (language === 'ar' ? 'المزيد' : 'Add More')}
            </Button>
            <Button 
              onClick={() => setShowApiUpload(!showApiUpload)}
              variant="outline" 
              size="sm"
              className="border-purple-300 text-purple-900 dark:text-purple-300"
            >
              <Key className="h-3 w-3 mr-1" />
              {language === 'ar' ? 'رابط' : 'URL'}
            </Button>
          </div>

          {/* API Upload Panel for existing files */}
          {showApiUpload && (
            <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
              <Label htmlFor="api-url-add" className="text-sm font-medium">
                {language === 'ar' ? 'إضافة صورة من رابط' : 'Add Image from URL'}
              </Label>
              <Input
                id="api-url-add"
                type="url"
                placeholder="https://example.com/image.jpg"
                value={apiImageUrl}
                onChange={(e) => setApiImageUrl(e.target.value)}
                className="mt-2"
              />
              <Button 
                onClick={handleApiUpload}
                className="mt-2 w-full"
                disabled={!apiImageUrl}
              >
                {language === 'ar' ? 'إضافة من الرابط' : 'Add from URL'}
              </Button>
            </div>
          )}

          {/* Controls */}
          <div className="space-y-3">
            {/* Category */}
            <select 
              value={videoCategory} 
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-4 py-3 text-base border border-gray-600"
            >
              <option value="custom">{language === 'ar' ? 'مخصص (1 قالب)' : 'Custom (1 template)'}</option>
              <option value="fun">{language === 'ar' ? 'ممتع وتفاعلي (13 قالب)' : 'Fun & Interactive (13 templates)'}</option>
              <option value="transform">{language === 'ar' ? 'تحويل وأسلوب (15 قالب)' : 'Transform & Style (15 templates)'}</option>
              <option value="camera">{language === 'ar' ? 'كاميرا وحركة (4 قوالب)' : 'Camera & Motion (4 templates)'}</option>
            </select>

            {/* Template */}
            <select 
              value={videoTemplate} 
              onChange={(e) => setVideoTemplate(e.target.value)}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-4 py-3 text-base border border-gray-600"
            >
              {videoCategory === 'custom' && (
                <option value="image2video">{language === 'ar' ? 'موجه مخصص' : 'Custom Prompt'}</option>
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

            {/* Generate Button */}
            <Button 
              onClick={handleGenerateVideo}
              disabled={isGenerating || uploadedFiles.length === 0 || isUploading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 py-4 text-lg font-medium"
            >
              {isGenerating ? (
                language === 'ar' ? 'جاري الإنشاء بواسطة Replicate...' : 'Generating with Replicate...'
              ) : (
                language === 'ar' ? '🎬 إنشاء فيديو (Replicate)' : '🎬 Generate Video (Replicate)'
              )}
            </Button>
          </div>

          {/* Info */}
          <div className="text-center text-xs text-purple-900 dark:text-purple-300">
            {language === 'ar' ? 'مقاطع عالية الجودة • 832x480 • بواسطة Replicate' : 'High quality clips • 832x480 • Powered by Replicate'}
          </div>
        </div>
      )}

      {/* Hidden Inputs */}
      <input 
        ref={fileInputRef} 
        type="file" 
        multiple 
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
