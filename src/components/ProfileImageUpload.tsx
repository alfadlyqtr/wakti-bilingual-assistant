
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
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error(language === 'ar' ? 'حجم الملف كبير جداً (الحد الأقصى 5 ميجابايت)' : 'File size too large (max 5MB)');
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error(language === 'ar' ? 'يرجى اختيار ملف صورة' : 'Please select an image file');
        return;
      }
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;
      
      console.log('Uploading avatar file:', { fileName, fileSize: file.size, fileType: file.type });
      
      // Delete old avatar if exists
      if (user?.user_metadata?.avatar_url) {
        try {
          const oldFileName = user.user_metadata.avatar_url.split('/').pop();
          if (oldFileName && oldFileName !== fileName) {
            await supabase.storage
              .from('avatars')
              .remove([oldFileName]);
            console.log('Old avatar deleted:', oldFileName);
          }
        } catch (deleteError) {
          console.warn('Could not delete old avatar:', deleteError);
          // Don't block upload if deletion fails
        }
      }
      
      // Upload the new file to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true // Allow overwriting
        });
        
      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }
      
      // Get the public URL with cache busting
      const { data: storageData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      const newAvatarUrl = `${storageData.publicUrl}?t=${Date.now()}`;
      console.log('New avatar URL with cache busting:', newAvatarUrl);
      
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
        // Don't throw here, as auth update was successful
        console.log('Profile update failed but auth update succeeded');
      } else {
        console.log('Successfully updated profile avatar in both auth and profiles table');
      }
      
      // Update local state immediately for better UX
      setAvatarUrl(newAvatarUrl);
      setImageError(false);
      
      // Force refresh the auth session to get the latest user metadata
      await refreshSession();
      
      toast.success(t("profileImageUpdated", language));
    } catch (error: any) {
      console.error('Avatar upload failed:', error);
      toast.error(`${t("error", language)}: ${error.message}`);
    } finally {
      setUploading(false);
      // Clear the input to allow re-upload of the same file
      if (event.target) {
        event.target.value = '';
      }
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

  // Use the latest avatar URL from user metadata or local state with cache busting
  const currentAvatarUrl = user?.user_metadata?.avatar_url || avatarUrl;
  const cacheBustedUrl = currentAvatarUrl ? `${currentAvatarUrl}${currentAvatarUrl.includes('?') ? '&' : '?'}t=${Date.now()}` : '';
  const shouldShowImage = cacheBustedUrl && !imageError;

  return (
    <div className="flex flex-col items-center space-y-4">
      <Avatar className="w-24 h-24">
        {shouldShowImage ? (
          <AvatarImage 
            src={cacheBustedUrl} 
            alt={t("profileImage", language)}
            onError={handleImageError}
            key={cacheBustedUrl} // Force re-render when URL changes
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
