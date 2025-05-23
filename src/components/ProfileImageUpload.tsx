
import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/providers/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/utils/translations";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

export const ProfileImageUpload = () => {
  const { user, updateProfile } = useAuth();
  const { language } = useTheme();
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || "");
  const [imageError, setImageError] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Simple cropper state
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("");
  const [zoom, setZoom] = useState([1]);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Constants
  const CROP_SIZE = 96; // Final crop size
  const PREVIEW_SIZE = 250; // Preview container size

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    const fullName = user?.user_metadata?.full_name || user?.email || "";
    return fullName
      .split(" ")
      .map(name => name[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files.length) {
      return;
    }
    
    const file = event.target.files[0];
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t("pleaseSelectImageFile", language) || "Please select an image file");
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("fileTooLarge", language) || "File size too large. Please select an image under 5MB");
      return;
    }
    
    setSelectedFile(file);
    const previewUrl = URL.createObjectURL(file);
    setImagePreviewUrl(previewUrl);
    setCropDialogOpen(true);
    
    // Reset position and zoom when selecting a new file
    setPosition({ x: 0, y: 0 });
    setZoom([1]);
    
    // Reset the input
    event.target.value = '';
  };
  
  // Mouse event handlers for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    
    // Calculate new position
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    // Update position state
    setPosition({
      x: newX,
      y: newY
    });
  };
  
  const handleMouseUp = () => {
    setDragging(false);
  };
  
  // Handle crop and upload
  const handleCrop = async () => {
    if (!selectedFile || !canvasRef.current) return;
    
    try {
      setUploading(true);
      
      // Create canvas for cropping
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Set canvas size to our desired output size
      canvas.width = CROP_SIZE;
      canvas.height = CROP_SIZE;
      
      // Create an image element from the file
      const img = new Image();
      img.src = imagePreviewUrl;
      
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      
      // Calculate the scaled dimensions of the image based on zoom
      const zoomValue = zoom[0];
      const scaledWidth = img.width * zoomValue;
      const scaledHeight = img.height * zoomValue;
      
      // Calculate source coordinates for cropping
      // Center the crop in the preview container
      const sourceX = (PREVIEW_SIZE / 2) - position.x - (CROP_SIZE / 2);
      const sourceY = (PREVIEW_SIZE / 2) - position.y - (CROP_SIZE / 2);
      
      // Convert to actual image coordinates
      const imgX = (sourceX / zoomValue) * (img.width / PREVIEW_SIZE);
      const imgY = (sourceY / zoomValue) * (img.height / PREVIEW_SIZE);
      const imgWidth = (CROP_SIZE / zoomValue) * (img.width / PREVIEW_SIZE);
      const imgHeight = (CROP_SIZE / zoomValue) * (img.height / PREVIEW_SIZE);
      
      // Draw the cropped portion
      ctx.drawImage(
        img,
        imgX, imgY, imgWidth, imgHeight,
        0, 0, CROP_SIZE, CROP_SIZE
      );
      
      // Convert to blob
      const croppedBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to create blob"));
        }, 'image/jpeg', 0.9);
      });
      
      await uploadImage(croppedBlob);
      
      // Clean up
      setCropDialogOpen(false);
      setSelectedFile(null);
      URL.revokeObjectURL(imagePreviewUrl);
      
    } catch (error) {
      console.error("Error cropping image:", error);
      toast.error(t("error", language) || "Error cropping image");
    } finally {
      setUploading(false);
    }
  };
  
  // Upload the cropped image to Supabase
  const uploadImage = async (croppedBlob: Blob) => {
    try {
      const fileExt = selectedFile?.name.split('.').pop() || 'jpg';
      const fileName = `${user?.id}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `${fileName}`;
      
      console.log('Uploading cropped avatar:', { fileName, fileSize: croppedBlob.size });
      
      // Upload the cropped file to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedBlob);
        
      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }
      
      // Get the public URL
      const { data: storageData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      const newAvatarUrl = storageData.publicUrl;
      console.log('New avatar URL:', newAvatarUrl);
      
      // Update user metadata
      const { error: authError } = await updateProfile({
        user_metadata: { 
          avatar_url: newAvatarUrl 
        }
      });
      
      if (authError) {
        console.error('Auth update error:', authError);
        throw authError;
      }

      // Also update the profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: newAvatarUrl })
        .eq('id', user?.id);
      
      if (profileError) {
        console.error('Error updating profile avatar:', profileError);
        throw profileError;
      } else {
        console.log('Successfully updated profile avatar in both auth and profiles table');
      }
      
      setAvatarUrl(newAvatarUrl);
      setImageError(false);
      toast.success(t("profileImageUpdated", language) || "Profile image updated");
    } catch (error: any) {
      console.error('Avatar upload failed:', error);
      toast.error(`${t("error", language)}: ${error.message}`);
      throw error;
    }
  };

  // Sync existing avatar from auth to profiles table on component mount
  useEffect(() => {
    const syncAvatarToProfiles = async () => {
      if (user?.user_metadata?.avatar_url) {
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ avatar_url: user.user_metadata.avatar_url })
            .eq('id', user.id);
          
          if (error) {
            console.error('Error syncing avatar to profiles:', error);
          } else {
            console.log('Avatar synced to profiles table');
          }
        } catch (error) {
          console.error('Failed to sync avatar:', error);
        }
      }
    };

    syncAvatarToProfiles();
  }, [user]);

  const handleImageError = () => {
    console.log('Avatar image failed to load:', avatarUrl);
    setImageError(true);
  };

  const shouldShowImage = avatarUrl && !imageError;

  return (
    <div className="flex flex-col items-center space-y-4">
      <Avatar className="w-24 h-24">
        {shouldShowImage ? (
          <AvatarImage 
            src={avatarUrl} 
            alt={t("profileImage", language)}
            onError={handleImageError}
          />
        ) : null}
        <AvatarFallback className="text-lg bg-blue-100 text-blue-700 font-semibold">
          {getUserInitials()}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex items-center space-x-2">
        <Button 
          variant="outline" 
          size="sm"
          disabled={uploading}
          className="relative"
          onClick={() => document.getElementById('avatar-upload')?.click()}
        >
          <Camera className="h-4 w-4 mr-2" />
          {uploading 
            ? t("uploading", language)
            : t("changeImage", language)}
          <input
            id="avatar-upload"
            type="file"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={uploading}
          />
        </Button>
      </div>
      
      {/* Simple Crop Dialog */}
      <Dialog open={cropDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setCropDialogOpen(false);
          setSelectedFile(null);
          URL.revokeObjectURL(imagePreviewUrl);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("cropProfileImage", language) || "Crop Profile Image"}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Preview Container */}
            <div 
              ref={previewContainerRef}
              className="relative mx-auto bg-gray-100 rounded-lg overflow-hidden select-none"
              style={{ 
                width: PREVIEW_SIZE, 
                height: PREVIEW_SIZE,
                cursor: dragging ? 'grabbing' : 'grab'
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Image Preview */}
              {imagePreviewUrl && (
                <div
                  className="absolute top-0 left-0 right-0 bottom-0"
                  style={{
                    backgroundImage: `url(${imagePreviewUrl})`,
                    backgroundPosition: `${position.x}px ${position.y}px`,
                    backgroundSize: `${zoom[0] * 100}%`,
                    backgroundRepeat: 'no-repeat'
                  }}
                />
              )}
              
              {/* Crop Circle Overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-40" />
              <div 
                className="absolute rounded-full border-2 border-white"
                style={{
                  width: CROP_SIZE,
                  height: CROP_SIZE,
                  left: `calc(50% - ${CROP_SIZE/2}px)`,
                  top: `calc(50% - ${CROP_SIZE/2}px)`,
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
                }}
              />
              
              {/* Instructions */}
              <div className="absolute bottom-2 left-0 right-0 text-center text-white text-xs">
                {t("cropInstructions", language) || "Drag to position • Use zoom to adjust"}
              </div>
            </div>
            
            {/* Zoom Controls */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{t("zoom", language) || "Zoom"}</span>
                <span>{Math.round(zoom[0] * 100)}%</span>
              </div>
              <div className="flex items-center space-x-2">
                <ZoomOut className="h-4 w-4" />
                <Slider
                  value={zoom}
                  onValueChange={setZoom}
                  max={3}
                  min={0.5}
                  step={0.1}
                  className="flex-1"
                />
                <ZoomIn className="h-4 w-4" />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setCropDialogOpen(false);
                setSelectedFile(null);
                URL.revokeObjectURL(imagePreviewUrl);
              }}
              disabled={uploading}
            >
              {t("cancel", language)}
            </Button>
            <Button 
              onClick={handleCrop}
              disabled={uploading || !imagePreviewUrl}
            >
              {uploading ? t("uploading", language) : t("cropAndSave", language) || "Crop & Save"}
            </Button>
          </DialogFooter>
          
          {/* Hidden canvas for cropping */}
          <canvas ref={canvasRef} className="hidden" />
        </DialogContent>
      </Dialog>
    </div>
  );
};
