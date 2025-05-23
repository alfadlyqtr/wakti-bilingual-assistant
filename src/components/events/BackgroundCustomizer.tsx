
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Wand2, Palette, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface BackgroundCustomizerProps {
  onBackgroundChange: (backgroundData: {
    type: 'color' | 'gradient' | 'image' | 'ai';
    backgroundColor?: string;
    backgroundGradient?: string;
    backgroundImage?: string;
  }) => void;
  currentBackground?: {
    type: 'color' | 'gradient' | 'image' | 'ai';
    backgroundColor?: string;
    backgroundGradient?: string;
    backgroundImage?: string;
  };
  eventTitle?: string;
  eventDescription?: string;
}

export default function BackgroundCustomizer({ 
  onBackgroundChange, 
  currentBackground,
  eventTitle = '',
  eventDescription = ''
}: BackgroundCustomizerProps) {
  const [activeTab, setActiveTab] = useState<'color' | 'gradient' | 'image' | 'ai'>(currentBackground?.type || 'color');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  // Color state
  const [solidColor, setSolidColor] = useState(currentBackground?.backgroundColor || '#3b82f6');
  
  // Gradient state
  const [gradientStart, setGradientStart] = useState('#3b82f6');
  const [gradientEnd, setGradientEnd] = useState('#8b5cf6');
  const [gradientDirection, setGradientDirection] = useState('135deg');
  
  // Image state
  const [imageUrl, setImageUrl] = useState(currentBackground?.backgroundImage || '');
  
  // AI prompt state
  const [aiPrompt, setAiPrompt] = useState('');

  const handleColorChange = (color: string) => {
    setSolidColor(color);
    onBackgroundChange({
      type: 'color',
      backgroundColor: color
    });
  };

  const handleGradientChange = () => {
    const gradient = `linear-gradient(${gradientDirection}, ${gradientStart}, ${gradientEnd})`;
    onBackgroundChange({
      type: 'gradient',
      backgroundGradient: gradient
    });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB');
      return;
    }

    try {
      setIsUploadingImage(true);
      
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `event-backgrounds/${fileName}`;

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('events')
        .upload(filePath, file);

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('events')
        .getPublicUrl(data.path);

      setImageUrl(publicUrl);
      onBackgroundChange({
        type: 'image',
        backgroundImage: publicUrl
      });

      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const generateSmartPrompt = (): string => {
    // If user provided a custom prompt, use it
    if (aiPrompt.trim()) {
      return aiPrompt.trim();
    }
    
    // If event has description, use it
    if (eventDescription.trim()) {
      return `Beautiful background image for event: ${eventDescription}. Professional, elegant, and visually appealing.`;
    }
    
    // If event has title, use it
    if (eventTitle.trim()) {
      return `Professional background image for "${eventTitle}" event. Modern, elegant design.`;
    }
    
    // Fallback prompt
    return 'Beautiful event background, elegant and modern design, professional atmosphere';
  };

  const generateAIImage = async () => {
    try {
      setIsGeneratingImage(true);
      
      const prompt = generateSmartPrompt();
      console.log('Generating AI image with prompt:', prompt);
      
      const response = await supabase.functions.invoke('generate-event-image', {
        body: { prompt }
      });

      if (response.error) {
        console.error('AI generation error:', response.error);
        throw response.error;
      }

      const generatedImageUrl = response.data?.imageURL;
      if (generatedImageUrl) {
        setImageUrl(generatedImageUrl);
        onBackgroundChange({
          type: 'ai',
          backgroundImage: generatedImageUrl
        });
        toast.success('AI image generated successfully');
      } else {
        throw new Error('No image URL returned from AI generation');
      }
    } catch (error) {
      console.error('AI generation error:', error);
      toast.error('Failed to generate AI image. Please try again.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const clearImage = () => {
    setImageUrl('');
    onBackgroundChange({ type: 'color', backgroundColor: solidColor });
  };

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Event Background</Label>
      
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="color" className="flex items-center gap-1">
            <Palette className="h-4 w-4" />
            Color
          </TabsTrigger>
          <TabsTrigger value="gradient" className="flex items-center gap-1">
            <Zap className="h-4 w-4" />
            Gradient
          </TabsTrigger>
          <TabsTrigger value="image" className="flex items-center gap-1">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-1">
            <Wand2 className="h-4 w-4" />
            AI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="color" className="space-y-4">
          <div className="flex items-center space-x-3">
            <Input
              type="color"
              value={solidColor}
              onChange={(e) => handleColorChange(e.target.value)}
              className="w-12 h-10 p-1 rounded cursor-pointer"
            />
            <Input
              type="text"
              value={solidColor}
              onChange={(e) => handleColorChange(e.target.value)}
              placeholder="#000000"
              className="flex-1"
            />
          </div>
          <div 
            className="w-full h-20 rounded-md border-2 border-dashed border-gray-300"
            style={{ backgroundColor: solidColor }}
          />
        </TabsContent>

        <TabsContent value="gradient" className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Start Color</Label>
              <div className="flex items-center space-x-2">
                <Input
                  type="color"
                  value={gradientStart}
                  onChange={(e) => {
                    setGradientStart(e.target.value);
                    setTimeout(handleGradientChange, 100);
                  }}
                  className="w-8 h-8 p-1 rounded cursor-pointer"
                />
                <Input
                  type="text"
                  value={gradientStart}
                  onChange={(e) => {
                    setGradientStart(e.target.value);
                    setTimeout(handleGradientChange, 100);
                  }}
                  className="flex-1 text-xs"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">End Color</Label>
              <div className="flex items-center space-x-2">
                <Input
                  type="color"
                  value={gradientEnd}
                  onChange={(e) => {
                    setGradientEnd(e.target.value);
                    setTimeout(handleGradientChange, 100);
                  }}
                  className="w-8 h-8 p-1 rounded cursor-pointer"
                />
                <Input
                  type="text"
                  value={gradientEnd}
                  onChange={(e) => {
                    setGradientEnd(e.target.value);
                    setTimeout(handleGradientChange, 100);
                  }}
                  className="flex-1 text-xs"
                />
              </div>
            </div>
          </div>
          
          <div>
            <Label className="text-xs text-muted-foreground">Direction</Label>
            <select 
              className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={gradientDirection}
              onChange={(e) => {
                setGradientDirection(e.target.value);
                setTimeout(handleGradientChange, 100);
              }}
            >
              <option value="to right">Horizontal →</option>
              <option value="to bottom">Vertical ↓</option>
              <option value="135deg">Diagonal ↘</option>
              <option value="45deg">Diagonal ↗</option>
            </select>
          </div>
          
          <div 
            className="w-full h-20 rounded-md border-2 border-dashed border-gray-300"
            style={{ background: `linear-gradient(${gradientDirection}, ${gradientStart}, ${gradientEnd})` }}
          />
        </TabsContent>

        <TabsContent value="image" className="space-y-4">
          <div>
            <Label htmlFor="image-upload" className="cursor-pointer">
              <div className="flex items-center justify-center w-full h-24 bg-muted rounded-md border-2 border-dashed hover:bg-muted/80 transition-colors">
                <div className="flex flex-col items-center space-y-2">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {isUploadingImage ? "Uploading..." : "Click to upload image"}
                  </span>
                </div>
              </div>
            </Label>
            <Input
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              disabled={isUploadingImage}
            />
          </div>
          
          {imageUrl && (
            <div className="relative">
              <img 
                src={imageUrl} 
                alt="Background preview" 
                className="w-full h-20 object-cover rounded-md"
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-1 right-1 h-6 w-6 p-0"
                onClick={clearImage}
              >
                ×
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <div className="space-y-3">
            <div>
              <Label htmlFor="ai-prompt" className="text-sm">Custom Prompt (Optional)</Label>
              <Textarea
                id="ai-prompt"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Describe your ideal background image, or leave blank to auto-generate from event details..."
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                If left blank, will use event title and description to generate the image
              </p>
            </div>
            
            <Button
              type="button"
              className="w-full"
              disabled={isGeneratingImage}
              onClick={generateAIImage}
            >
              {isGeneratingImage ? (
                <>Generating...</>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate AI Background
                </>
              )}
            </Button>
          </div>
          
          {imageUrl && activeTab === 'ai' && (
            <div className="relative">
              <img 
                src={imageUrl} 
                alt="AI generated preview" 
                className="w-full h-20 object-cover rounded-md"
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-1 right-1 h-6 w-6 p-0"
                onClick={clearImage}
              >
                ×
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
