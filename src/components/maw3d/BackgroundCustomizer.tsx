
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Palette, Image, Sparkles, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Maw3dService } from '@/services/maw3dService';
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

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

  const handleAIGeneration = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please enter a prompt for AI image generation');
      return;
    }

    try {
      setIsGenerating(true);
      
      const imageUrl = await Maw3dService.generateAIBackground(aiPrompt);
      onBackgroundChange('ai', imageUrl);
      toast.success('AI background generated successfully');
      setAiPrompt('');
    } catch (error) {
      console.error('Error generating AI background:', error);
      toast.error('Failed to generate AI background');
    } finally {
      setIsGenerating(false);
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
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="background-upload"
                disabled={uploadingImage}
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
          <div>
            <Label>{t('aiImagePrompt', language)}</Label>
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder={t('describeBackground', language)}
              className="mt-2"
              rows={3}
            />
          </div>
          <Button
            onClick={handleAIGeneration}
            disabled={isGenerating || !aiPrompt.trim()}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('generating', language)}...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                {t('generateAIBackground', language)}
              </>
            )}
          </Button>
          
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
