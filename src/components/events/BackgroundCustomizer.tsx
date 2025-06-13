import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Palette, Image, Sparkles, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Maw3dService } from "@/services/maw3dService";

interface BackgroundCustomizerProps {
  onBackgroundChange: (background: {
    type: 'color' | 'gradient' | 'image' | 'ai';
    backgroundColor?: string;
    backgroundGradient?: string;
    backgroundImage?: string;
  }) => void;
  currentBackground: {
    type: 'color' | 'gradient' | 'image' | 'ai';
    backgroundColor?: string;
    backgroundGradient?: string;
    backgroundImage?: string;
  };
  eventTitle?: string;
  eventDescription?: string;
  hidePreview?: boolean;
}

const gradientPresets = [
  { name: 'Ocean Blue', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { name: 'Sunset', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { name: 'Forest', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { name: 'Purple Dream', gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' },
  { name: 'Golden Hour', gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
  { name: 'Night Sky', gradient: 'linear-gradient(135deg, #2c3e50 0%, #000000 100%)' },
];

export default function BackgroundCustomizer({
  onBackgroundChange,
  currentBackground,
  eventTitle = '',
  eventDescription = '',
  hidePreview = false
}: BackgroundCustomizerProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleColorChange = (color: string) => {
    onBackgroundChange({
      type: 'color',
      backgroundColor: color
    });
  };

  const handleGradientSelect = (gradient: string) => {
    onBackgroundChange({
      type: 'gradient',
      backgroundGradient: gradient
    });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      
      // Upload to Supabase storage
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

      // Get public URL
      const { data } = supabase.storage
        .from('event-images')
        .getPublicUrl(filePath);

      onBackgroundChange({
        type: 'image',
        backgroundImage: data.publicUrl
      });

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
      
      // Create a more detailed prompt including event context
      const fullPrompt = `${aiPrompt}. Event: "${eventTitle}"${eventDescription ? `. ${eventDescription}` : ''}. Professional event background, high quality, suitable for text overlay.`;
      
      console.log('Starting AI image generation...');
      console.log('Full prompt:', fullPrompt);

      // Use the working Maw3dService.generateAIBackground method
      const imageUrl = await Maw3dService.generateAIBackground(fullPrompt);

      console.log('AI image generated successfully:', imageUrl);
      onBackgroundChange({
        type: 'ai',
        backgroundImage: imageUrl
      });
      toast.success('Image generated successfully');
      setAiPrompt('');
    } catch (error) {
      console.error('Error generating AI image:', error);
      toast.error('Failed to generate AI image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Background Customization
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="color" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="color">Color</TabsTrigger>
            <TabsTrigger value="gradient">Gradient</TabsTrigger>
            <TabsTrigger value="image">Upload</TabsTrigger>
            <TabsTrigger value="ai">AI Generate</TabsTrigger>
          </TabsList>
          
          <TabsContent value="color" className="space-y-4">
            <div>
              <Label>Background Color</Label>
              <div className="flex items-center gap-3 mt-2">
                <Input
                  type="color"
                  value={currentBackground.backgroundColor || '#3b82f6'}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-12 h-10 p-1 rounded-md cursor-pointer"
                />
                <Input
                  type="text"
                  value={currentBackground.backgroundColor || '#3b82f6'}
                  onChange={(e) => handleColorChange(e.target.value)}
                  placeholder="#3b82f6"
                  className="flex-1"
                />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="gradient" className="space-y-4">
            <div>
              <Label>Gradient Presets</Label>
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
              <Label>Upload Image</Label>
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
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Choose Image
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Recommended: 1200x600px or similar aspect ratio
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="ai" className="space-y-4">
            <div>
              <Label>AI Image Prompt</Label>
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Describe the background you want... (e.g., 'elegant conference hall with soft lighting', 'vibrant outdoor festival scene', 'minimalist modern office space')"
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
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate AI Background
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              AI will create a custom background based on your description and event details.
            </p>
          </TabsContent>
        </Tabs>

        {/* Preview */}
        {!hidePreview && (
          <div className="mt-6">
            <Label>Preview</Label>
            <div 
              className="mt-2 h-32 rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center text-white font-bold"
              style={{
                background: currentBackground.type === 'gradient' 
                  ? currentBackground.backgroundGradient
                  : currentBackground.type === 'image' || currentBackground.type === 'ai'
                  ? `url(${currentBackground.backgroundImage}) center/cover`
                  : currentBackground.backgroundColor || '#3b82f6'
              }}
            >
              <span className="text-shadow-lg">
                {eventTitle || 'Your Event Title'}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
