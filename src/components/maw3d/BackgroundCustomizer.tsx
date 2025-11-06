import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Palette, Image, Sparkles, Upload, Loader2, Link2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { t } from '@/utils/translations';

interface BackgroundCustomizerProps {
  backgroundType: 'color' | 'gradient' | 'image' | 'ai';
  backgroundValue: string;
  imageBlur?: number;
  onBackgroundChange: (type: 'color' | 'gradient' | 'image' | 'ai', value: string) => void;
  onImageBlurChange?: (blur: number) => void;
  language: string;
}

const gradientPresets = [
  { name: 'Ocean Blue', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { name: 'Sunset', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { name: 'Forest', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { name: 'Purple Dream', gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' },
  { name: 'Golden Hour', gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
  { name: 'Night Sky', gradient: 'linear-gradient(135deg, #2c3e50 0%, #000000 100%)' },
];

export const BackgroundCustomizer: React.FC<BackgroundCustomizerProps> = ({
  backgroundType,
  backgroundValue,
  imageBlur = 0,
  onBackgroundChange,
  onImageBlurChange,
  language
}) => {
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  const handleColorChange = (color: string) => {
    onBackgroundChange('color', color);
  };

  const handleGradientSelect = (gradient: string) => {
    onBackgroundChange('gradient', gradient);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `event-backgrounds/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Failed to upload image');
        return;
      }

      const { data } = supabase.storage
        .from('event-images')
        .getPublicUrl(filePath);

      onBackgroundChange('image', data.publicUrl);
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleBlurChange = (value: number[]) => {
    const blurValue = value[0];
    console.log('=== BACKGROUND CUSTOMIZER BLUR CHANGE ===');
    console.log('Slider value array received:', value);
    console.log('Blur value extracted:', blurValue);
    console.log('Blur value type:', typeof blurValue);
    console.log('onImageBlurChange callback exists:', !!onImageBlurChange);
    console.log('Current imageBlur prop:', imageBlur);
    
    if (onImageBlurChange) {
      console.log('Calling onImageBlurChange with:', blurValue);
      
      // Add a small delay to demonstrate real-time feedback
      onImageBlurChange(blurValue);
      
      // Show immediate feedback to user
      toast(`Image blur set to ${blurValue}px`, { 
        duration: 1000,
        description: 'Setting will be saved when you save the event'
      });
    } else {
      console.error('BackgroundCustomizer: onImageBlurChange callback not provided');
      toast.error('Unable to update blur setting - callback missing');
    }
  };

  const getBackgroundStyle = () => {
    let style: React.CSSProperties = {};
    
    console.log('=== GETTING BACKGROUND STYLE ===');
    console.log('Background type:', backgroundType);
    console.log('Background value:', backgroundValue);
    console.log('Image blur value:', imageBlur);
    console.log('Image blur type:', typeof imageBlur);
    
    switch (backgroundType) {
      case 'color':
        style.backgroundColor = backgroundValue;
        break;
      case 'gradient':
        style.background = backgroundValue;
        break;
      case 'image':
      case 'ai':
        style.backgroundImage = `url(${backgroundValue})`;
        style.backgroundSize = 'cover';
        style.backgroundPosition = 'center';
        // Apply blur if set
        if (imageBlur > 0) {
          style.filter = `blur(${imageBlur}px)`;
          console.log('Applied blur filter:', `blur(${imageBlur}px)`);
        }
        break;
      default:
        style.backgroundColor = '#3b82f6';
    }
    
    console.log('Final background style:', style);
    return style;
  };

  const handleApplyImageUrl = () => {
    if (!imageUrl.trim()) {
      toast.error(language === 'ar' ? 'الرجاء إدخال رابط الصورة' : 'Please enter an image URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(imageUrl);
    } catch {
      toast.error(language === 'ar' ? 'الرجاء إدخال رابط صالح' : 'Please enter a valid URL');
      return;
    }

    // Check if it looks like an image URL (basic check)
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const hasImageExtension = imageExtensions.some(ext => 
      imageUrl.toLowerCase().includes(ext)
    );
    
    if (!hasImageExtension && !imageUrl.includes('data:image') && !imageUrl.includes('blob:')) {
      toast.error(language === 'ar' ? 'الرابط لا يبدو كرابط صورة صالح' : 'URL doesn\'t appear to be a valid image URL');
      return;
    }

    onBackgroundChange('ai', imageUrl);
    toast.success(language === 'ar' ? 'تم تطبيق الصورة بنجاح!' : 'Image applied successfully!');
    setImageUrl('');
  };

  console.log('=== BACKGROUND CUSTOMIZER RENDER ===');
  console.log('Props received - imageBlur:', imageBlur, 'type:', typeof imageBlur);
  console.log('Props received - backgroundType:', backgroundType);
  console.log('Props received - backgroundValue:', backgroundValue);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="color" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="color">{t('color', language)}</TabsTrigger>
          <TabsTrigger value="gradient">{t('gradient', language)}</TabsTrigger>
          <TabsTrigger value="image">{t('image', language)}</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
        </TabsList>
        
        <TabsContent value="color" className="space-y-4">
          <div>
            <Label>{t('backgroundColor', language)}</Label>
            <div className="flex items-center gap-3 mt-2">
              <Input
                type="color"
                value={backgroundValue}
                onChange={(e) => handleColorChange(e.target.value)}
                className="w-12 h-10 p-1 rounded-md cursor-pointer"
              />
              <Input
                type="text"
                value={backgroundValue}
                onChange={(e) => handleColorChange(e.target.value)}
                placeholder="#3b82f6"
                className="flex-1"
              />
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="gradient" className="space-y-4">
          <div>
            <Label>{t('gradientPresets', language)}</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {gradientPresets.map((preset, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="h-12 p-2 relative overflow-hidden"
                  onClick={() => handleGradientSelect(preset.gradient)}
                >
                  <div
                    className="absolute inset-0 opacity-50"
                    style={{ background: preset.gradient }}
                  />
                  <span className="relative z-10 text-xs font-medium">
                    {preset.name}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="image" className="space-y-4">
          <div>
            <Label>{t('uploadImage', language)}</Label>
            <div className="mt-2">
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
                onChange={handleImageUpload}
                className="hidden"
                id="background-upload"
                disabled={uploadingImage}
                multiple={false}
              />
              <Button
                onClick={() => document.getElementById('background-upload')?.click()}
                className="w-full"
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('uploading', language)}...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    {t('chooseImage', language)}
                  </>
                )}
              </Button>
            </div>
            
            {/* Enhanced blur control for images */}
            {(backgroundType === 'image' || backgroundType === 'ai') && backgroundValue && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Label className="font-medium">{t('imageBlur', language)}: {imageBlur}px</Label>
                <div className="mt-2 mb-3">
                  <Slider
                    value={[imageBlur]}
                    onValueChange={handleBlurChange}
                    min={0}
                    max={10}
                    step={0.5}
                    className="w-full"
                  />
                </div>
                <div className="flex justify-between text-xs text-blue-600">
                  <span>0px (No blur)</span>
                  <span>Current: {imageBlur}px</span>
                  <span>10px (Max blur)</span>
                </div>
                <p className="text-xs text-blue-700 mt-2 font-medium">
                  💡 {t('adjustBlurForReadability', language)}
                </p>
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="ai" className="space-y-4">
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="h-6 w-6 text-purple-600" />
                <h3 className="text-lg font-semibold">
                  {language === 'ar' ? 'استخدام صورة من الذكاء الاصطناعي' : 'Use AI Generated Image'}
                </h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="image-url" className="text-sm font-medium">
                    {language === 'ar' ? 'رابط الصورة' : 'Image URL'}
                  </Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="image-url"
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder={language === 'ar' ? 'الصق رابط الصورة هنا...' : 'Paste image URL here...'}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleApplyImageUrl}
                      disabled={!imageUrl.trim()}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      {language === 'ar' ? 'تطبيق' : 'Apply'}
                    </Button>
                  </div>
                </div>
                
                <div className="text-sm text-muted-foreground space-y-2">
                  <p className="font-medium">
                    {language === 'ar' ? 'كيفية الاستخدام:' : 'How to use:'}
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>
                      {language === 'ar' 
                        ? 'اذهب إلى Wakti AI وولّد صورة في وضع الصورة'
                        : 'Go to Wakti AI and generate an image in image mode'
                      }
                    </li>
                    <li>
                      {language === 'ar' 
                        ? 'انسخ رابط الصورة باستخدام زر النسخ'
                        : 'Copy the image URL using the copy button'
                      }
                    </li>
                    <li>
                      {language === 'ar' 
                        ? 'الصق الرابط هنا واضغط تطبيق'
                        : 'Paste the URL here and click Apply'
                      }
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
          
          {/* Enhanced blur control for AI images */}
          {backgroundType === 'ai' && backgroundValue && (
            <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <Label className="font-medium">{t('imageBlur', language)}: {imageBlur}px</Label>
              <div className="mt-2 mb-3">
                <Slider
                  value={[imageBlur]}
                  onValueChange={handleBlurChange}
                  min={0}
                  max={10}
                  step={0.5}
                  className="w-full"
                />
              </div>
              <div className="flex justify-between text-xs text-purple-600">
                <span>0px (No blur)</span>
                <span>Current: {imageBlur}px</span>
                <span>10px (Max blur)</span>
              </div>
              <p className="text-xs text-purple-700 mt-2 font-medium">
                💡 {t('adjustBlurForReadability', language)}
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Enhanced Preview */}
      <div className="mt-6">
        <Label>{t('preview', language)}</Label>
        <div className="text-xs text-muted-foreground mb-2">
          Preview with current blur setting: {imageBlur}px
        </div>
        <div 
          className="mt-2 h-32 rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center text-white font-bold relative overflow-hidden"
        >
          <div 
            className="absolute inset-0"
            style={getBackgroundStyle()}
          />
          <div className="absolute inset-0 bg-black/20" />
          <span className="relative z-10 text-shadow-lg">
            {t('yourEventTitle', language)}
          </span>
        </div>
      </div>
    </div>
  );
};
