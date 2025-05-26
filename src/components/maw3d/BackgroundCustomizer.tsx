
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Palette, Image, Wand2, Upload, Trash2, Loader2 } from 'lucide-react';
import { t } from '@/utils/translations';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface BackgroundCustomizerProps {
  backgroundType: 'color' | 'gradient' | 'image' | 'ai';
  backgroundValue: string;
  onBackgroundChange: (type: 'color' | 'gradient' | 'image' | 'ai', value: string) => void;
  language: string;
}

const gradientPresets = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
];

const colorPresets = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
];

export const BackgroundCustomizer: React.FC<BackgroundCustomizerProps> = ({
  backgroundType,
  backgroundValue,
  onBackgroundChange,
  language
}) => {
  const [customGradient, setCustomGradient] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleGradientSubmit = () => {
    if (customGradient.trim()) {
      onBackgroundChange('gradient', customGradient);
      setCustomGradient('');
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(language === 'ar' ? 'يرجى اختيار ملف صورة صالح' : 'Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(language === 'ar' ? 'حجم الملف كبير جداً (الحد الأقصى 5 ميجابايت)' : 'File size too large (max 5MB)');
      return;
    }

    try {
      setIsUploading(true);
      
      // Upload to Supabase storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `maw3d-backgrounds/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error(language === 'ar' ? 'فشل في رفع الصورة' : 'Failed to upload image');
        return;
      }

      // Get public URL
      const { data } = supabase.storage
        .from('event-images')
        .getPublicUrl(filePath);

      onBackgroundChange('image', data.publicUrl);
      toast.success(language === 'ar' ? 'تم رفع الصورة بنجاح' : 'Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error(language === 'ar' ? 'فشل في رفع الصورة' : 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    onBackgroundChange('color', '#3b82f6');
    toast.success(language === 'ar' ? 'تم حذف الصورة' : 'Image removed');
  };

  const handleAIGeneration = async () => {
    if (!aiPrompt.trim()) {
      toast.error(language === 'ar' ? 'يرجى إدخال وصف للصورة' : 'Please enter a prompt for AI image generation');
      return;
    }

    try {
      setIsGenerating(true);
      
      console.log('Starting AI image generation...');
      console.log('Prompt:', aiPrompt);

      const { data, error } = await supabase.functions.invoke('generate-event-image', {
        body: { 
          prompt: aiPrompt,
          width: 1200,
          height: 600,
          style: 'photographic'
        }
      });

      console.log('Edge function response:', { data, error });

      if (error) {
        console.error('Edge function error:', error);
        toast.error(language === 'ar' ? `فشل في توليد الصورة: ${error.message}` : `AI generation failed: ${error.message || 'Unknown error'}`);
        return;
      }

      if (!data) {
        console.error('No data returned from edge function');
        toast.error(language === 'ar' ? 'لا يوجد رد من خدمة الذكاء الاصطناعي' : 'No response from AI service');
        return;
      }

      if (data.error) {
        console.error('AI service error:', data.error);
        toast.error(language === 'ar' ? `خطأ في خدمة الذكاء الاصطناعي: ${data.error}` : `AI service error: ${data.error}`);
        return;
      }

      if (data.imageUrl) {
        console.log('AI image generated successfully:', data.imageUrl);
        onBackgroundChange('ai', data.imageUrl);
        toast.success(language === 'ar' ? 'تم توليد الصورة بنجاح' : 'Image generated successfully');
        setAiPrompt('');
      } else {
        console.error('No image URL in response:', data);
        toast.error(language === 'ar' ? 'لم يتم توليد صورة. يرجى المحاولة مرة أخرى' : 'No image was generated. Please try again.');
      }
    } catch (error) {
      console.error('Unexpected error generating AI image:', error);
      toast.error(language === 'ar' ? 'فشل في توليد الصورة بالذكاء الاصطناعي' : 'Failed to generate AI image. Please check your connection and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">🖼️ {t('backgroundCustomization', language)}</h2>
      
      <Tabs value={backgroundType} onValueChange={(value) => onBackgroundChange(value as any, backgroundValue)}>
        <TabsList className={`grid w-full grid-cols-4 ${language === 'ar' ? 'rtl' : ''}`}>
          <TabsTrigger value="color" className="flex items-center gap-1 text-xs">
            <Palette className="w-3 h-3" />
            <span>{t('color', language)}</span>
          </TabsTrigger>
          <TabsTrigger value="gradient" className="flex items-center gap-1 text-xs">
            <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded" />
            <span>{t('gradient', language)}</span>
          </TabsTrigger>
          <TabsTrigger value="image" className="flex items-center gap-1 text-xs">
            <Image className="w-3 h-3" />
            <span>{t('image', language)}</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-1 text-xs">
            <Wand2 className="w-3 h-3" />
            <span>AI</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="color" className="space-y-4">
          <div>
            <Label htmlFor="color-picker">{t('customColor', language)}</Label>
            <Input
              id="color-picker"
              type="color"
              value={backgroundType === 'color' ? backgroundValue : '#3b82f6'}
              onChange={(e) => onBackgroundChange('color', e.target.value)}
              className="w-full h-12"
            />
          </div>
          
          <div>
            <Label>{t('colorPresets', language)}</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {colorPresets.map((color) => (
                <button
                  key={color}
                  className={`w-full h-12 rounded-md border-2 transition-all ${
                    backgroundType === 'color' && backgroundValue === color
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-transparent hover:border-muted-foreground/20'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => onBackgroundChange('color', color)}
                />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="gradient" className="space-y-4">
          <div>
            <Label>{t('gradientPresets', language)}</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {gradientPresets.map((gradient, index) => (
                <button
                  key={index}
                  className={`w-full h-16 rounded-md border-2 transition-all ${
                    backgroundType === 'gradient' && backgroundValue === gradient
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-transparent hover:border-muted-foreground/20'
                  }`}
                  style={{ background: gradient }}
                  onClick={() => onBackgroundChange('gradient', gradient)}
                />
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="custom-gradient">{t('customGradient', language)}</Label>
            <div className={`flex gap-2 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
              <Input
                id="custom-gradient"
                value={customGradient}
                onChange={(e) => setCustomGradient(e.target.value)}
                placeholder="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                className="flex-1"
              />
              <Button onClick={handleGradientSubmit}>{t('apply', language)}</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="image" className="space-y-4">
          <div>
            <Label>{language === 'ar' ? 'رفع صورة' : 'Upload Image'}</Label>
            <div className="mt-2 space-y-3">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
                disabled={isUploading}
              />
              <Button
                onClick={() => document.getElementById('image-upload')?.click()}
                className="w-full"
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {language === 'ar' ? 'جاري الرفع...' : 'Uploading...'}
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    {language === 'ar' ? 'اختر صورة' : 'Choose Image'}
                  </>
                )}
              </Button>
              
              {backgroundType === 'image' && backgroundValue && (
                <div className="flex items-center gap-2">
                  <div 
                    className="w-16 h-16 rounded-md bg-cover bg-center border"
                    style={{ backgroundImage: `url(${backgroundValue})` }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveImage}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    {language === 'ar' ? 'حذف' : 'Remove'}
                  </Button>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' ? 'الأحجام المقترحة: 1200×600 بكسل أو نسبة عرض إلى ارتفاع مشابهة (الحد الأقصى 5 ميجابايت)' : 'Recommended: 1200x600px or similar aspect ratio (max 5MB)'}
            </p>
          </div>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <div>
            <Label htmlFor="ai-prompt">{t('aiPrompt', language)}</Label>
            <Input
              id="ai-prompt"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder={t('aiPromptPlaceholder', language)}
              className="mt-2"
            />
            <Button
              onClick={handleAIGeneration}
              disabled={isGenerating || !aiPrompt.trim()}
              className="mt-2 w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {language === 'ar' ? 'جاري التوليد...' : 'Generating...'}
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  {t('generateImage', language)}
                </>
              )}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('aiImageDescription', language)}
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
};
