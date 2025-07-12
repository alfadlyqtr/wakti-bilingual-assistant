
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Camera, Sparkles, Play, X } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { supabase } from '@/integrations/supabase/client';

interface VideoUploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  preview?: string;
}

interface VideoUploadInterfaceProps {
  onVideoGenerated?: (videoData: any) => void;
}

export function VideoUploadInterface({ onVideoGenerated }: VideoUploadInterfaceProps) {
  const { language } = useTheme();
  const { showSuccess, showError } = useToastHelper();
  
  const [uploadedFiles, setUploadedFiles] = useState<VideoUploadedFile[]>([]);
  const [videoCategory, setVideoCategory] = useState('custom');
  const [videoTemplate, setVideoTemplate] = useState('image2video');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Template prompts with ALL 33 templates
  const getTemplatePrompt = (template: string) => {
    const prompts: Record<string, string> = {
      // Custom (1)
      image2video: "Generate creative video animation",
      
      // Fun & Interactive (13)
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
      
      // Transform & Style (15)
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
      
      // Camera & Motion (4)
      zoom_in_fast: "Camera steadily zooms in isolating details of the subject.",
      zoom_out_image: "Camera pulls back revealing the surrounding environment.",
      zoom_out_startend: "Transition from close-up to wide shot between two images.",
      walk_forward: "Character walks forward toward camera naturally."
    };
    return prompts[template] || "Generate creative video animation";
  };

  // Convert file to base64
  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Handle file selection
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const newFiles: VideoUploadedFile[] = [];
      
      for (let i = 0; i < Math.min(files.length, 5); i++) { // Max 5 images
        const file = files[i];
        
        if (!file.type.startsWith('image/')) {
          showError(`${file.name} ${language === 'ar' ? 'ليس ملف صورة صالح' : 'is not a valid image file'}`);
          continue;
        }
        
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
          showError(`${file.name} ${language === 'ar' ? 'كبير جداً (أقصى حد 5 ميجابايت)' : 'is too large (max 5MB)'}`);
          continue;
        }

        const base64 = await convertToBase64(file);
        const videoFile: VideoUploadedFile = {
          id: `${Date.now()}-${i}`,
          name: file.name,
          type: file.type,
          size: file.size,
          url: base64,
          preview: base64
        };
        
        newFiles.push(videoFile);
      }
      
      setUploadedFiles(prev => [...prev, ...newFiles]);
      showSuccess(`${newFiles.length} ${language === 'ar' ? 'صور تم تحميلها' : 'images uploaded'}`);
      
    } catch (error) {
      console.error('Upload error:', error);
      showError(language === 'ar' ? 'فشل في تحميل الصور' : 'Failed to upload images');
    } finally {
      setIsUploading(false);
    }
  };

  // Remove file
  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  // Clear all files
  const clearAllFiles = () => {
    setUploadedFiles([]);
  };

  // Handle video generation
  const handleGenerateVideo = async () => {
    try {
      setIsGenerating(true);
      
      // Get user authentication
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error(language === 'ar' ? 'يجب تسجيل الدخول أولاً' : 'Authentication required');
      }
      
      if (uploadedFiles.length === 0) {
        throw new Error(language === 'ar' ? 'لم يتم تحميل أي صور' : 'No images uploaded');
      }
      
      // Prepare images (already base64)
      const base64Images = uploadedFiles.map(file => file.url);
      
      // Determine prompt
      const isCustom = videoTemplate === 'image2video';
      const promptToUse = isCustom ? 'Generate creative video animation' : getTemplatePrompt(videoTemplate);
      
      console.log('🎬 Starting video generation:', { 
        template: videoTemplate, 
        imageCount: base64Images.length,
        category: videoCategory 
      });
      
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
        throw new Error(response.error.message || (language === 'ar' ? 'فشل في إنشاء الفيديو' : 'Video generation failed'));
      }
      
      if (response.data?.success) {
        showSuccess(language === 'ar' ? '🎬 تم بدء إنشاء الفيديو! تحقق من المحادثة للحصول على التحديثات.' : '🎬 Video generation started! Check your chat for updates.');
        
        // Call callback if provided
        if (onVideoGenerated) {
          onVideoGenerated(response.data);
        }
        
        // Clear files after successful generation
        clearAllFiles();
      } else {
        throw new Error(response.data?.error || (language === 'ar' ? 'فشل في إنشاء الفيديو' : 'Video generation failed'));
      }
      
    } catch (error: any) {
      console.error('❌ Video generation error:', error);
      showError(error.message || (language === 'ar' ? 'فشل في إنشاء الفيديو. يرجى المحاولة مرة أخرى.' : 'Video generation failed. Please try again.'));
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
    <div className="w-full max-w-2xl mx-auto p-4 space-y-6">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
      />

      {/* MOBILE Upload Area - NO DRAG & DROP */}
      {uploadedFiles.length === 0 && (
        <div className="bg-purple-50/50 dark:bg-purple-900/20 rounded-xl p-8 text-center border-2 border-dashed border-purple-200 dark:border-purple-700">
          <div className="flex flex-col items-center gap-6">
            <div className="flex gap-3">
              <Sparkles className="h-10 w-10 text-purple-500" />
              <Play className="h-10 w-10 text-pink-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-purple-900 dark:text-purple-100">
                {language === 'ar' ? 'إنشاء فيديو من الصور' : 'Create Video from Images'}
              </h3>
              <p className="text-purple-700 dark:text-purple-300">
                {language === 'ar' ? 'ارفع صورك وحولها إلى فيديوهات مذهلة' : 'Upload your images and create amazing videos'}
              </p>
            </div>
            
            {/* MOBILE BUTTONS */}
            <div className="flex gap-3 w-full max-w-sm">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white h-14 text-base"
              >
                <Upload className="h-5 w-5 mr-2" />
                {isUploading ? (language === 'ar' ? 'جاري التحميل...' : 'Uploading...') : (language === 'ar' ? 'اختر صور' : 'Choose Images')}
              </Button>
              <Button
                onClick={() => cameraInputRef.current?.click()}
                disabled={isUploading}
                className="flex-1 bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-700 hover:to-pink-800 text-white h-14 text-base"
              >
                <Camera className="h-5 w-5 mr-2" />
                {language === 'ar' ? 'كاميرا' : 'Camera'}
              </Button>
            </div>
            
            <div className="text-sm text-purple-600 dark:text-purple-400">
              {language === 'ar' ? 'حتى 5 صور • أقصى حجم 5 ميجابايت لكل صورة' : 'Up to 5 images • Max 5MB per image'}
            </div>
          </div>
        </div>
      )}

      {/* Uploaded Images Display */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {language === 'ar' ? 'الصور المحملة' : 'Uploaded Images'} ({uploadedFiles.length})
            </h4>
            <Button
              onClick={clearAllFiles}
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {language === 'ar' ? 'مسح الكل' : 'Clear All'}
            </Button>
          </div>
          
          {/* Image Thumbnails */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="relative group">
                <img 
                  src={file.preview || file.url} 
                  className="w-full aspect-square object-cover rounded-lg border-2 border-purple-200 dark:border-purple-700 shadow-md group-hover:border-purple-400 transition-colors" 
                  alt={file.name}
                />
                <button 
                  onClick={() => removeFile(file.id)} 
                  className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg transition-colors"
                  title={language === 'ar' ? 'حذف الصورة' : 'Remove image'}
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 rounded-b-lg">
                  {(file.size / 1024).toFixed(0)}KB
                </div>
              </div>
            ))}
          </div>

          {/* Add More Button */}
          {uploadedFiles.length < 5 && (
            <div className="flex gap-2">
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="flex-1 border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                <Upload className="h-4 w-4 mr-2" />
                {language === 'ar' ? 'إضافة المزيد' : 'Add More'}
              </Button>
              <Button
                onClick={() => cameraInputRef.current?.click()}
                variant="outline"
                className="flex-1 border-pink-300 text-pink-700 hover:bg-pink-50"
              >
                <Camera className="h-4 w-4 mr-2" />
                {language === 'ar' ? 'كاميرا' : 'Camera'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* MOBILE Video Controls */}
      {uploadedFiles.length > 0 && (
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl p-6 space-y-4 border border-purple-200 dark:border-purple-700">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 text-center">
            {language === 'ar' ? 'إعدادات الفيديو' : 'Video Settings'}
          </h4>
          
          <div className="space-y-4">
            {/* Category Selector - FULL WIDTH ON MOBILE */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {language === 'ar' ? 'الفئة' : 'Category'}
              </label>
              <select 
                value={videoCategory} 
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-4 py-3 text-base border border-gray-300 dark:border-gray-600 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-all"
              >
                <option value="custom">{language === 'ar' ? 'مخصص (1 قالب)' : 'Custom (1 template)'}</option>
                <option value="fun">{language === 'ar' ? 'ممتع وتفاعلي (13 قالب)' : 'Fun & Interactive (13 templates)'}</option>
                <option value="transform">{language === 'ar' ? 'تحويل وتصميم (15 قالب)' : 'Transform & Style (15 templates)'}</option>
                <option value="camera">{language === 'ar' ? 'كاميرا وحركة (4 قوالب)' : 'Camera & Motion (4 templates)'}</option>
              </select>
            </div>
            
            {/* Template Selector - FULL WIDTH ON MOBILE */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {language === 'ar' ? 'القالب' : 'Template'}
              </label>
              <select 
                value={videoTemplate} 
                onChange={(e) => setVideoTemplate(e.target.value)}
                className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-4 py-3 text-base border border-gray-300 dark:border-gray-600 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-all"
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
            </div>
            
            {/* Generate Button - FULL WIDTH ON MOBILE */}
            <Button 
              onClick={handleGenerateVideo}
              disabled={isGenerating || uploadedFiles.length === 0}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 text-white py-4 rounded-lg text-lg font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isGenerating ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {language === 'ar' ? 'جاري إنشاء الفيديو...' : 'Generating Video...'}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  🎬 {language === 'ar' ? 'إنشاء فيديو' : 'Generate Video'}
                </div>
              )}
            </Button>
          </div>
          
          {/* Video Info & Usage */}
          <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="text-gray-600 dark:text-gray-400">
                <span className="font-medium">{language === 'ar' ? 'مقاطع 4 ثوانٍ' : '4-second clips'}</span> • 
                <span className="ml-1">{language === 'ar' ? 'جودة 720p' : '720p quality'}</span>
              </div>
              <div className="text-purple-600 dark:text-purple-400 font-medium">
                {language === 'ar' ? '15 في الشهر' : '15/month limit'}
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              {language === 'ar' ? 'يتم معالجة الفيديوهات بواسطة Vidu AI' : 'Videos processed by Vidu AI'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
