
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Image, Upload, Wand2 } from "lucide-react";
import { useState } from "react";
import { UseFormReturn } from "react-hook-form";

interface BackgroundSelectorProps {
  type: "color" | "gradient" | "image" | "ai";
  form: UseFormReturn<any>;
  generateImage: () => void;
  isGeneratingImage: boolean;
  aiPrompt: string;
  setAiPrompt: (value: string) => void;
}

export default function BackgroundSelector({
  type,
  form,
  generateImage,
  isGeneratingImage,
  aiPrompt,
  setAiPrompt
}: BackgroundSelectorProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [gradientStart, setGradientStart] = useState("#3b82f6");
  const [gradientEnd, setGradientEnd] = useState("#2dd4bf");
  const [gradientDirection, setGradientDirection] = useState("135deg");
  
  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      
      // Create a preview URL for the image
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        form.setValue("backgroundImage", result, { shouldDirty: true });
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Update gradient when components change
  const updateGradient = () => {
    const gradient = `linear-gradient(${gradientDirection}, ${gradientStart} 0%, ${gradientEnd} 100%)`;
    form.setValue("backgroundGradient", gradient, { shouldDirty: true });
  };
  
  const handleGradientStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGradientStart(e.target.value);
    updateGradient();
  };
  
  const handleGradientEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGradientEnd(e.target.value);
    updateGradient();
  };
  
  const handleGradientDirectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setGradientDirection(e.target.value);
    updateGradient();
  };

  if (type === "color") {
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Input
            type="color"
            value={form.watch("backgroundColor")}
            onChange={(e) => form.setValue("backgroundColor", e.target.value, { shouldDirty: true })}
            className="w-12 h-10 p-1"
          />
          <Input
            type="text"
            value={form.watch("backgroundColor")}
            onChange={(e) => form.setValue("backgroundColor", e.target.value, { shouldDirty: true })}
            className="flex-1"
            placeholder="#000000"
          />
        </div>
        
        <div 
          className="w-full h-24 rounded-md border" 
          style={{ backgroundColor: form.watch("backgroundColor") }}
        ></div>
      </div>
    );
  }
  
  if (type === "gradient") {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Start Color</label>
            <div className="flex items-center space-x-2">
              <Input
                type="color"
                value={gradientStart}
                onChange={handleGradientStartChange}
                className="w-12 h-10 p-1"
              />
              <Input
                type="text"
                value={gradientStart}
                onChange={handleGradientStartChange}
                className="flex-1"
                placeholder="#000000"
              />
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">End Color</label>
            <div className="flex items-center space-x-2">
              <Input
                type="color"
                value={gradientEnd}
                onChange={handleGradientEndChange}
                className="w-12 h-10 p-1"
              />
              <Input
                type="text"
                value={gradientEnd}
                onChange={handleGradientEndChange}
                className="flex-1"
                placeholder="#000000"
              />
            </div>
          </div>
        </div>
        
        <div>
          <label className="text-sm font-medium mb-1 block">Direction</label>
          <select 
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            value={gradientDirection}
            onChange={handleGradientDirectionChange}
          >
            <option value="to right">Horizontal →</option>
            <option value="to bottom">Vertical ↓</option>
            <option value="135deg">Diagonal ↘</option>
            <option value="45deg">Diagonal ↗</option>
            <option value="to top">Vertical ↑</option>
            <option value="to left">Horizontal ←</option>
          </select>
        </div>
        
        <div 
          className="w-full h-24 rounded-md border" 
          style={{ background: form.watch("backgroundGradient") }}
        ></div>
      </div>
    );
  }
  
  if (type === "image") {
    return (
      <div className="space-y-4">
        <label className="block w-full">
          <div className="flex items-center justify-center w-full h-32 bg-muted rounded-md border-2 border-dashed cursor-pointer hover:bg-muted/80 transition-colors">
            <div className="flex flex-col items-center justify-center space-y-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {imageFile ? imageFile.name : "Click to upload image"}
              </span>
            </div>
            <Input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
        </label>
        
        {form.watch("backgroundImage") && (
          <div className="relative">
            <img 
              src={form.watch("backgroundImage")} 
              alt="Background preview" 
              className="w-full h-32 object-cover rounded-md"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-6 w-6"
              onClick={() => {
                form.setValue("backgroundImage", "", { shouldDirty: true });
                setImageFile(null);
              }}
            >
              <Image className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    );
  }
  
  if (type === "ai") {
    return (
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Describe your event background</label>
          <Textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="E.g., A tropical beach party with palm trees and sunset"
            className="resize-none"
            rows={3}
          />
        </div>
        
        <Button
          type="button"
          className="w-full"
          disabled={isGeneratingImage || !aiPrompt}
          onClick={generateImage}
        >
          {isGeneratingImage ? (
            <>Generating...</>
          ) : (
            <>
              <Wand2 className="h-4 w-4 mr-2" />
              Generate Image
            </>
          )}
        </Button>
        
        {form.watch("backgroundImage") && (
          <div className="relative">
            <img 
              src={form.watch("backgroundImage")} 
              alt="AI generated preview" 
              className="w-full h-32 object-cover rounded-md"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-6 w-6"
              onClick={() => form.setValue("backgroundImage", "", { shouldDirty: true })}
            >
              <Image className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    );
  }
  
  return null;
}
