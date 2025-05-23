
import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/providers/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/utils/translations";
import { ImageCropper } from "./ImageCropper";

export const ProfileImageUpload = () => {
  const { user, updateProfile } = useAuth();
  const { language } = useTheme();
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || "");
  const [imageError, setImageError] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);

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
    setCropperOpen(true);
    
    // Reset the input
    event.target.value = '';
  };

  const uploadCroppedImage = async (croppedBlob: Blob) => {
    try {
      setUploading(true);
      setCropperOpen(false);
      
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
      
      // Update user metadata with the correct structure expected by Supabase Auth
      const { error: authError } = await updateProfile({
        user_metadata: { 
          avatar_url: newAvatarUrl 
        }
      });
      
      if (authError) {
        console.error('Auth update error:', authError);
        throw authError;
      }

      // CRITICAL FIX: Also update the profiles table so ContactList can see the avatar
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: newAvatarUrl })
        .eq('id', user?.id);
      
      if (profileError) {
        console.error('Error updating profile avatar:', profileError);
        throw profileError; // Throw error to ensure both updates succeed
      } else {
        console.log('Successfully updated profile avatar in both auth and profiles table');
      }
      
      setAvatarUrl(newAvatarUrl);
      setImageError(false); // Reset error state on successful upload
      toast.success(t("profileImageUpdated", language));
    } catch (error: any) {
      console.error('Avatar upload failed:', error);
      toast.error(`${t("error", language)}: ${error.message}`);
    } finally {
      setUploading(false);
      setSelectedFile(null);
    }
  };

  // Sync existing avatar from auth to profiles table on component mount
  React.useEffect(() => {
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

      {/* Image Cropper Modal */}
      {selectedFile && (
        <ImageCropper
          isOpen={cropperOpen}
          onClose={() => {
            setCropperOpen(false);
            setSelectedFile(null);
          }}
          imageFile={selectedFile}
          onCropComplete={uploadCroppedImage}
        />
      )}
    </div>
  );
};
