
import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/providers/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/utils/translations";

export const ProfileImageUpload = () => {
  const { user, refreshSession } = useAuth();
  const { language } = useTheme();
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || "");
  const [imageError, setImageError] = useState(false);

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

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      
      if (!event.target.files || !event.target.files.length) {
        return;
      }
      
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `${fileName}`;
      
      console.log('Uploading avatar file:', { fileName, fileSize: file.size, fileType: file.type });
      
      // Upload the file to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);
        
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
      const { data: authData, error: authError } = await supabase.auth.updateUser({
        data: { 
          avatar_url: newAvatarUrl 
        }
      });
      
      if (authError) {
        console.error('Auth update error:', authError);
        throw authError;
      }

      console.log('Auth update successful:', authData);

      // Update the profiles table so ContactList can see the avatar
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
      
      // Force refresh the auth session to get the latest user metadata
      await refreshSession();
      
      setAvatarUrl(newAvatarUrl);
      setImageError(false);
      toast.success(t("profileImageUpdated", language));
    } catch (error: any) {
      console.error('Avatar upload failed:', error);
      toast.error(`${t("error", language)}: ${error.message}`);
    } finally {
      setUploading(false);
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

  // Add cache-busting to avatar URL
  const getCacheBustedAvatarUrl = (url: string) => {
    if (!url) return url;
    const timestamp = Date.now();
    return `${url}?t=${timestamp}`;
  };

  const shouldShowImage = avatarUrl && !imageError;
  const displayAvatarUrl = shouldShowImage ? getCacheBustedAvatarUrl(avatarUrl) : "";

  return (
    <div className="flex flex-col items-center space-y-4">
      <Avatar className="w-24 h-24">
        {shouldShowImage ? (
          <AvatarImage 
            src={displayAvatarUrl} 
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
            onChange={uploadAvatar}
            disabled={uploading}
          />
        </Button>
      </div>
    </div>
  );
};
