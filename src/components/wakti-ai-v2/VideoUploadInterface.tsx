
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, Upload, Camera, Sparkles } from 'lucide-react';
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Convert file to base64
  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const base64Files = await Promise.all(
      files.map(async (file) => ({
        id: Date.now() + Math.random(),
        name: file.name,
        base64: await convertToBase64(file),
        size: file.size
      }))
    );
    setUploadedFiles(prev => [...prev, ...base64Files]);
  };

  // ALL 33 TEMPLATES
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

  const handleGenerateVideo = async () => {
    try {
      setIsGenerating(true);
      
      if (uploadedFiles.length === 0) {
        throw new Error('Please upload at least one image');
      }

      const base64Images = uploadedFiles.map(file => file.base64);
      const isCustom = videoTemplate === 'image2video';
      const promptToUse = isCustom ? 'Generate creative video animation' : getTemplatePrompt(videoTemplate);

      // DIRECT API CALL - NO POLLING
      const response = await supabase.functions.invoke('vidu-video-generator', {
        body: {
          template: videoTemplate,
          images: base64Images,
          prompt: promptToUse,
          mode: isCustom ? 'image2video' : 'template2video'
        }
      });

      if (response.error) throw new Error(response.error.message);

      if (response.data?.success) {
        showSuccess('🎬 Video generation started! You will be notified when it\'s ready.');
        onVideoGenerated({ jobId: response.data.job_id, template: videoTemplate });
        onClose();
      }

    } catch (error: any) {
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
              {language === 'ar' ? 'ارفع صورك وحولها إلى فيديوهات مذهلة' : 'Upload your images and create amazing videos'}
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => fileInputRef.current?.click()} className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-700">
              <Upload className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'اختر صور' : 'Choose Images'}
            </Button>
            <Button onClick={() => cameraInputRef.current?.click()} className="bg-pink-600 hover:bg-pink-700">
              <Camera className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'كاميرا' : 'Camera'}
            </Button>
          </div>
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
                  src={file.base64} 
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

          {/* Add More Button */}
          <div className="flex gap-2">
            <Button 
              onClick={() => fileInputRef.current?.click()} 
              variant="outline" 
              size="sm"
              className="border-purple-300 text-purple-900 dark:text-purple-300"
            >
              <Upload className="h-3 w-3 mr-1" />
              {language === 'ar' ? 'المزيد' : 'Add More'}
            </Button>
          </div>

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
              disabled={isGenerating || uploadedFiles.length === 0}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 py-4 text-lg font-medium"
            >
              {isGenerating ? (
                language === 'ar' ? 'جاري الإنشاء...' : 'Generating...'
              ) : (
                language === 'ar' ? '🎬 إنشاء فيديو' : '🎬 Generate Video'
              )}
            </Button>
          </div>

          {/* Info */}
          <div className="text-center text-xs text-purple-900 dark:text-purple-300">
            {language === 'ar' ? 'مقاطع 4 ثوان • جودة 720p • حد 15/شهر' : '4-second clips • 720p quality • 15/month limit'}
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
