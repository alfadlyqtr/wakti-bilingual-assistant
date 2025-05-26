
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Palette, Image, Wand2 } from 'lucide-react';
import { t } from '@/utils/translations';

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

  const handleGradientSubmit = () => {
    if (customGradient.trim()) {
      onBackgroundChange('gradient', customGradient);
      setCustomGradient('');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">🖼️ {t('backgroundCustomization', language)}</h2>
      
      <Tabs value={backgroundType} onValueChange={(value) => onBackgroundChange(value as any, backgroundValue)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="color" className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            {t('color', language)}
          </TabsTrigger>
          <TabsTrigger value="gradient" className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded" />
            {t('gradient', language)}
          </TabsTrigger>
          <TabsTrigger value="image" className="flex items-center gap-2">
            <Image className="w-4 h-4" />
            {t('image', language)}
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Wand2 className="w-4 h-4" />
            {t('aiGenerated', language)}
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
                  className={`w-full h-12 rounded-md border-2 ${
                    backgroundType === 'color' && backgroundValue === color
                      ? 'border-primary'
                      : 'border-transparent'
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
                  className={`w-full h-16 rounded-md border-2 ${
                    backgroundType === 'gradient' && backgroundValue === gradient
                      ? 'border-primary'
                      : 'border-transparent'
                  }`}
                  style={{ background: gradient }}
                  onClick={() => onBackgroundChange('gradient', gradient)}
                />
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="custom-gradient">{t('customGradient', language)}</Label>
            <div className="flex gap-2">
              <Input
                id="custom-gradient"
                value={customGradient}
                onChange={(e) => setCustomGradient(e.target.value)}
                placeholder="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
              />
              <Button onClick={handleGradientSubmit}>{t('apply', language)}</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="image" className="space-y-4">
          <div>
            <Label htmlFor="image-url">{t('imageUrl', language)}</Label>
            <Input
              id="image-url"
              value={backgroundType === 'image' ? backgroundValue : ''}
              onChange={(e) => onBackgroundChange('image', e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {t('imageUrlDescription', language)}
          </p>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <div>
            <Label htmlFor="ai-prompt">{t('aiPrompt', language)}</Label>
            <Input
              id="ai-prompt"
              placeholder={t('aiPromptPlaceholder', language)}
            />
            <Button className="mt-2 w-full">
              <Wand2 className="w-4 h-4 mr-2" />
              {t('generateImage', language)}
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
