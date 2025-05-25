
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Upload, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { Maw3dService } from '@/services/maw3dService';

interface BackgroundCustomizerProps {
  backgroundType: 'color' | 'gradient' | 'image' | 'ai';
  backgroundValue: string;
  onBackgroundChange: (type: 'color' | 'gradient' | 'image' | 'ai', value: string) => void;
}

export const BackgroundCustomizer: React.FC<BackgroundCustomizerProps> = ({
  backgroundType,
  backgroundValue,
  onBackgroundChange
}) => {
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const predefinedColors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
  ];

  const predefinedGradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
  ];

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        onBackgroundChange('image', imageUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please enter a prompt for AI generation');
      return;
    }

    setIsGenerating(true);
    try {
      const imageUrl = await Maw3dService.generateAIBackground(aiPrompt);
      onBackgroundChange('ai', imageUrl);
      toast.success('AI background generated successfully!');
    } catch (error) {
      console.error('Failed to generate AI background:', error);
      toast.error('Failed to generate AI background. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Background Customization</h3>
      
      <Tabs value={backgroundType} onValueChange={(value) => onBackgroundChange(value as any, backgroundValue)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="color">
            <Palette className="w-4 h-4 mr-1" />
            Color
          </TabsTrigger>
          <TabsTrigger value="gradient">Gradient</TabsTrigger>
          <TabsTrigger value="image">
            <Upload className="w-4 h-4 mr-1" />
            Image
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Sparkles className="w-4 h-4 mr-1" />
            AI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="color" className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {predefinedColors.map((color) => (
              <button
                key={color}
                className={`w-full h-12 rounded-md border-2 ${
                  backgroundValue === color ? 'border-primary' : 'border-gray-300'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => onBackgroundChange('color', color)}
              />
            ))}
          </div>
          <div>
            <Label htmlFor="custom-color">Custom Color</Label>
            <Input
              id="custom-color"
              type="color"
              value={backgroundValue}
              onChange={(e) => onBackgroundChange('color', e.target.value)}
            />
          </div>
        </TabsContent>

        <TabsContent value="gradient" className="space-y-4">
          <div className="grid grid-cols-1 gap-2">
            {predefinedGradients.map((gradient, index) => (
              <button
                key={index}
                className={`w-full h-12 rounded-md border-2 ${
                  backgroundValue === gradient ? 'border-primary' : 'border-gray-300'
                }`}
                style={{ background: gradient }}
                onClick={() => onBackgroundChange('gradient', gradient)}
              />
            ))}
          </div>
          <div>
            <Label htmlFor="custom-gradient">Custom CSS Gradient</Label>
            <Input
              id="custom-gradient"
              placeholder="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
              value={backgroundValue}
              onChange={(e) => onBackgroundChange('gradient', e.target.value)}
            />
          </div>
        </TabsContent>

        <TabsContent value="image" className="space-y-4">
          <div>
            <Label htmlFor="image-upload">Upload Image</Label>
            <Input
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
            />
          </div>
          {backgroundValue && backgroundType === 'image' && (
            <div className="w-full h-32 rounded-md overflow-hidden">
              <img
                src={backgroundValue}
                alt="Background preview"
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <div>
            <Label htmlFor="ai-prompt">AI Prompt</Label>
            <Textarea
              id="ai-prompt"
              placeholder="Describe the background you want (e.g., 'sunset over mountains', 'abstract colorful pattern')"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
            />
          </div>
          <Button 
            onClick={handleGenerateAI}
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? 'Generating...' : 'Generate AI Background'}
          </Button>
          {backgroundValue && backgroundType === 'ai' && (
            <div className="w-full h-32 rounded-md overflow-hidden">
              <img
                src={backgroundValue}
                alt="AI generated background"
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
