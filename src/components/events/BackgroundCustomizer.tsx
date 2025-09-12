
import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Palette, Image, Sparkles, Paintbrush } from 'lucide-react';
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
  onApplyGradient?: (css: string) => void;
}

export default function BackgroundCustomizer({
  backgroundColor,
  backgroundImage,
  imageBlur,
  onBackgroundColorChange,
  onBackgroundImageChange,
  onImageBlurChange,
  onApplyGradient,
}: BackgroundCustomizerProps) {
  const { language } = useTheme();
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Custom gradient builder state
  const [gradientAngle, setGradientAngle] = useState<number>(135);
  const [gradientStops, setGradientStops] = useState<Array<{ color: string; pos: number }>>([
    { color: '#667eea', pos: 0 },
    { color: '#764ba2', pos: 100 },
  ]);

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
    setSelectedFileName(file.name);

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
    } finally {
      // Reset input so selecting the same file again still triggers onChange (mobile-friendly)
      if (fileInputRef.current) {
        try { fileInputRef.current.value = ''; } catch {}
      }
    }
  };

  // Programmatic chooser to improve mobile behavior and allow camera capture
  const handleUploadClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    // Prefer back camera on mobile if available
    // Note: not all browsers honor capture; harmless when ignored
    (input as any).capture = 'environment';
    input.onchange = (e: any) => handleImageUpload(e as any);
    input.click();
  };

  const generateAIBackground = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    // Build a system-style prompt to bias models away from putting any text on the image
    const systemPrompt = `Generate a beautiful, high-quality background image for an event card.
    Requirements:
    - No text, words, watermarks, logos, captions, or typography in any language
    - Modern, vibrant, visually appealing
    - Works well behind overlaid UI text (good contrast, no clutter)
    - 16:9 composition if possible
    Description: ${aiPrompt}`;

    console.log('[AI BG] User prompt:', aiPrompt);
    console.log('[AI BG] Final prompt sent:', systemPrompt);

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-event-image', {
        body: {
          prompt: systemPrompt,
          // Hints some providers support
          no_text: true,
          negative_prompt: 'text, watermark, caption, logo, words, letters, typography, subtitles, arabic text, english text',
          width: 1280,
          height: 720,
        }
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
      {/* Inline CSS for brush animation (scoped by class names) */}
      <style>{`
        @keyframes wakti-brush-move { 0% { transform: translateX(-10%) rotate(-12deg); } 50% { transform: translateX(110%) rotate(8deg); } 100% { transform: translateX(-10%) rotate(-12deg); } }
        @keyframes wakti-stroke-sheen { 0% { left: -40%; } 50% { left: 140%; } 100% { left: -40%; } }
        .wakti-brush-anim { animation: wakti-brush-move 1.6s ease-in-out infinite; }
        .wakti-stroke-anim { animation: wakti-stroke-sheen 1.6s ease-in-out infinite; }
      `}</style>
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
                    onClick={() => (onApplyGradient ? onApplyGradient(gradient) : onBackgroundColorChange(gradient))}
                  />
                ))}
              </div>
            </div>

            {/* Custom Gradient Builder */}
            <div className="border-t pt-4 space-y-3">
              <Label className="text-enhanced-heading">{t('customGradient', language)}</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">{t('angle', language)}: {gradientAngle}°</span>
                  <Slider
                    value={[gradientAngle]}
                    onValueChange={(v) => setGradientAngle(v[0])}
                    min={0}
                    max={360}
                    step={1}
                    className="w-2/3"
                  />
                </div>

                {/* Stops list */}
                <div className="space-y-2">
                  {gradientStops.map((stop, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <input
                        type="color"
                        value={stop.color}
                        onChange={(e) => {
                          const next = [...gradientStops];
                          next[i] = { ...next[i], color: e.target.value };
                          setGradientStops(next);
                        }}
                        className="w-10 h-10 rounded border"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{t('position', language)}: {stop.pos}%</span>
                          {gradientStops.length > 2 && (
                            <button
                              type="button"
                              className="text-destructive hover:underline"
                              onClick={() => setGradientStops(gradientStops.filter((_, idx) => idx !== i))}
                            >
                              {t('delete', language)}
                            </button>
                          )}
                        </div>
                        <Slider
                          value={[stop.pos]}
                          onValueChange={(v) => {
                            const next = [...gradientStops];
                            next[i] = { ...next[i], pos: v[0] };
                            setGradientStops(next);
                          }}
                          min={0}
                          max={100}
                          step={1}
                        />
                      </div>
                    </div>
                  ))}

                  {/* Add stop */}
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={gradientStops.length >= 3}
                      onClick={() => setGradientStops([...gradientStops, { color: '#ffffff', pos: 50 }])}
                    >
                      {t('addColorStop', language)}
                    </Button>
                  </div>
                </div>

                {/* Preview */}
                <div className="rounded-md border border-border/40 h-16"
                     style={{
                       background: `linear-gradient(${gradientAngle}deg, ${[...gradientStops]
                         .sort((a,b) => a.pos - b.pos)
                         .map(s => `${s.color} ${s.pos}%`) 
                         .join(', ')})`
                     }}
                />

                {/* Apply */}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => {
                      const css = `linear-gradient(${gradientAngle}deg, ${[...gradientStops]
                        .sort((a,b) => a.pos - b.pos)
                        .map(s => `${s.color} ${s.pos}%`)
                        .join(', ')})`;
                      if (onApplyGradient) { onApplyGradient(css); } else { onBackgroundColorChange(css); }
                    }}
                  >
                    {t('applyGradient', language)}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="image" className="space-y-4">
            <div>
              <Label>{t('uploadImage', language)}</Label>
              {/* Hidden native input for accessibility; we control UI for localization */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                // Hint for mobile devices to use back camera when possible
                // Some browsers ignore this attribute; safe to include
                capture="environment"
                onChange={handleImageUpload}
                className="hidden"
              />
              <div className="mt-2 flex items-center gap-3">
                <Button type="button" variant="secondary" onClick={handleUploadClick}>
                  {t('chooseImage', language)}
                </Button>
                <span className="text-xs text-muted-foreground truncate max-w-[60%]">
                  {selectedFileName || t('noFileChosen', language)}
                </span>
              </div>
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
                className="relative overflow-hidden w-full mt-2"
              >
                {isGenerating && (
                  <>
                    <span className="pointer-events-none absolute inset-0">
                      {/* subtle shimmering stroke under the brush */}
                      <span className="absolute top-1/2 -translate-y-1/2 h-[2px] w-1/2 rounded-full bg-gradient-to-r from-transparent via-primary/40 to-transparent wakti-stroke-anim" />
                    </span>
                    <Paintbrush className="w-4 h-4 mr-2 wakti-brush-anim relative z-[1]" />
                  </>
                )}
                {!isGenerating && <Sparkles className="w-4 h-4 mr-2" />}
                {isGenerating ? t('generating', language) : t('generateAIBackground', language)}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
