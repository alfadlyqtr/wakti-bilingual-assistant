
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Palette, Image, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { t } from '@/utils/translations';
import { useTheme } from '@/providers/ThemeProvider';

interface BackgroundCustomizerProps {
  backgroundColor: string;
  backgroundImage: string | null;
  imageBlur: number;
  onBackgroundColorChange: (color: string) => void;
  onBackgroundImageChange: (image: string | null) => void;
  onImageBlurChange: (blur: number) => void;
}

export default function BackgroundCustomizer({
  backgroundColor,
  backgroundImage,
  imageBlur,
  onBackgroundColorChange,
  onBackgroundImageChange,
  onImageBlurChange,
}: BackgroundCustomizerProps) {
  const { language } = useTheme();
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const gradientPresets = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  ];

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const fileName = `event-bg-${Date.now()}.${file.name.split('.').pop()}`;
      const { data, error } = await supabase.storage
        .from('event-images')
        .upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('event-images')
        .getPublicUrl(data.path);

      onBackgroundImageChange(urlData.publicUrl);
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Error uploading image');
    }
  };

  const generateAIBackground = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-event-image', {
        body: { prompt: aiPrompt }
      });

      if (error) throw error;

      onBackgroundImageChange(data.imageUrl);
      toast.success('Background generated successfully');
    } catch (error) {
      console.error('Error generating background:', error);
      toast.error('Error generating background');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="w-4 h-4" />
          {t('backgroundCustomization', language)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="color" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="color">{t('color', language)}</TabsTrigger>
            <TabsTrigger value="gradient">{t('gradient', language)}</TabsTrigger>
            <TabsTrigger value="image">{t('image', language)}</TabsTrigger>
          </TabsList>

          <TabsContent value="color" className="space-y-4">
            <div>
              <Label>{t('backgroundColor', language)}</Label>
              <input
                type="color"
                value={backgroundColor}
                onChange={(e) => onBackgroundColorChange(e.target.value)}
                className="w-full h-10 rounded border mt-2"
              />
            </div>
          </TabsContent>

          <TabsContent value="gradient" className="space-y-4">
            <div>
              <Label>{t('gradientPresets', language)}</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {gradientPresets.map((gradient, index) => (
                  <div
                    key={index}
                    className="h-12 rounded cursor-pointer border-2 border-transparent hover:border-primary"
                    style={{ background: gradient }}
                    onClick={() => onBackgroundColorChange(gradient)}
                  />
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="image" className="space-y-4">
            <div>
              <Label>{t('uploadImage', language)}</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="mt-2"
              />
            </div>

            {backgroundImage && (
              <div>
                <Label>{t('imageBlur', language)}</Label>
                <Slider
                  value={[imageBlur]}
                  onValueChange={(value) => onImageBlurChange(value[0])}
                  min={0}
                  max={20}
                  step={1}
                  className="mt-2"
                />
                <span className="text-sm text-muted-foreground">{imageBlur}px</span>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('adjustBlurForReadability', language)}
                </p>
              </div>
            )}

            <div className="border-t pt-4">
              <Label>{t('aiImagePrompt', language)}</Label>
              <Input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={t('describeBackground', language)}
                className="mt-2"
              />
              <Button 
                onClick={generateAIBackground}
                disabled={isGenerating}
                className="w-full mt-2"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {isGenerating ? t('generating', language) : t('generateAIBackground', language)}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
