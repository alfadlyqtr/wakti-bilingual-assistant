
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
  const { user, updateProfile } = useAuth();
  const { language } = useTheme();
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || "");

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
      
      // Upload the file to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);
        
      if (uploadError) {
        throw uploadError;
      }
      
      // Get the public URL
      const { data: storageData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      const avatarUrl = storageData.publicUrl;
      
      // Update user metadata with the correct structure expected by Supabase Auth
      const { error: authError } = await updateProfile({
        user_metadata: { 
          avatar_url: avatarUrl 
        }
      });
      
      if (authError) {
        throw authError;
      }

      // Also update the profiles table so ContactList can see the avatar
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user?.id);
      
      if (profileError) {
        console.error('Error updating profile avatar:', profileError);
        // Don't throw here as auth update was successful
      }
      
      setAvatarUrl(avatarUrl);
      toast.success(t("profileImageUpdated", language));
    } catch (error: any) {
      toast.error(`${t("error", language)}: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <Avatar className="w-24 h-24">
        <AvatarImage src={avatarUrl} alt={t("profileImage", language)} />
        <AvatarFallback className="text-lg">{getUserInitials()}</AvatarFallback>
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
