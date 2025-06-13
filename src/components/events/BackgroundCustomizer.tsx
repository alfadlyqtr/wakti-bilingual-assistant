
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Palette, Image, Sparkles, Upload, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

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
  const [uploadingImage, setUploadingImage] = useState(false);
  const navigate = useNavigate();

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

  const handleAIImageRedirect = () => {
    // Create a prompt suggestion based on event details
    const promptSuggestion = eventTitle 
      ? `Professional background for "${eventTitle}" event${eventDescription ? `, ${eventDescription}` : ''}`
      : 'Professional event background, elegant and suitable for text overlay';
    
    // Redirect to Wakti AI in image mode with return parameter
    const params = new URLSearchParams({
      mode: 'image',
      return: 'maw3d',
      prompt: promptSuggestion
    });
    
    navigate(`/wakti-ai?${params.toString()}`);
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
            <div className="text-center space-y-4">
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
                <Sparkles className="h-12 w-12 mx-auto mb-4 text-purple-600" />
                <h3 className="text-lg font-semibold mb-2">Generate AI Background</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Use our powerful AI image generator to create the perfect background for your event.
                </p>
                <Button
                  onClick={handleAIImageRedirect}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Go to AI Image Generator
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                You'll be redirected to the AI image generator. After creating your image, you can easily apply it as your event background.
              </p>
            </div>
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
