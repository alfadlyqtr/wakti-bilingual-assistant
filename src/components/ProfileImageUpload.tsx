
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTheme } from '@/providers/ThemeProvider';

export function ProfileImageUpload() {
  const { user } = useAuth();
  const { profile, refetch, createProfileIfMissing } = useUserProfile();
  const { language } = useTheme();
  const [isUploading, setIsUploading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ensureProfileExists = async () => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    // Check if profile exists
    const { data: existingProfile, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (error && error.code === 'PGRST116') {
      // Profile doesn't exist, create it
      console.log('Profile missing during upload, creating...');
      await createProfileIfMissing(user.id);
    } else if (error) {
      throw error;
    }
  };

  // Add cache-busting to avatar URL
  const getCacheBustedAvatarUrl = (url: string | null | undefined) => {
    if (!url) return undefined;
    const timestamp = Date.now();
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${timestamp}`;
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(language === 'ar' ? 'يرجى اختيار ملف صورة صحيح' : 'Please select a valid image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(language === 'ar' ? 'حجم الملف كبير جداً (الحد الأقصى 5 ميجابايت)' : 'File size too large (max 5MB)');
      return;
    }

    setIsUploading(true);
    setAvatarError(false);

    try {
      // Ensure profile exists before uploading
      await ensureProfileExists();

      // Create unique filename with user ID folder structure for better organization
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      console.log('Uploading avatar file:', fileName);

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      console.log('Upload successful:', uploadData);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      console.log('Public URL generated:', publicUrl);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Profile update error:', updateError);
        throw updateError;
      }

      // Force refresh profile data to get the latest avatar
      await refetch();

      // Add a small delay to ensure the real-time subscription has processed
      setTimeout(() => {
        // Force a page refresh of avatar components by dispatching a custom event
        window.dispatchEvent(new CustomEvent('avatar-updated', { 
          detail: { avatarUrl: publicUrl, userId: user.id } 
        }));
      }, 500);

      toast.success(language === 'ar' ? 'تم تحديث الصورة الشخصية بنجاح' : 'Profile picture updated successfully');
      
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error(language === 'ar' ? 'فشل في تحديث الصورة الشخصية' : 'Failed to update profile picture');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;

    setIsUploading(true);

    try {
      // Ensure profile exists
      await ensureProfileExists();

      // Update profile to remove avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Profile update error:', updateError);
        throw updateError;
      }

      // Refresh profile data
      await refetch();

      // Force refresh of avatar components
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('avatar-updated', { 
          detail: { avatarUrl: null, userId: user.id } 
        }));
      }, 500);

      toast.success(language === 'ar' ? 'تم حذف الصورة الشخصية' : 'Profile picture removed');
      
    } catch (error) {
      console.error('Avatar removal error:', error);
      toast.error(language === 'ar' ? 'فشل في حذف الصورة الشخصية' : 'Failed to remove profile picture');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAvatarError = () => {
    console.log('Avatar image failed to load');
    setAvatarError(true);
  };

  const getInitials = () => {
    // Try to get initials from profile first, then fallback to user metadata
    const displayName = profile?.display_name || user?.user_metadata?.display_name;
    const email = profile?.email || user?.email;
    
    if (!displayName && !email) return 'U';
    
    const name = displayName || email;
    return name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get avatar URL from profile data with cache-busting
  const avatarUrl = profile?.avatar_url ? getCacheBustedAvatarUrl(profile.avatar_url) : undefined;

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        <Avatar 
          className="h-24 w-24 ring-2 ring-border"
          key={profile?.avatar_url || 'no-avatar'} // Force re-render when avatar changes
        >
          <AvatarImage 
            src={!avatarError && avatarUrl ? avatarUrl : undefined} 
            alt={language === 'ar' ? 'الصورة الشخصية' : 'Profile picture'}
            onError={handleAvatarError}
          />
          <AvatarFallback className="text-lg font-semibold">
            {getInitials()}
          </AvatarFallback>
        </Avatar>
        
        {isUploading && (
          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-2"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          {language === 'ar' ? 'تغيير الصورة' : 'Change Photo'}
        </Button>

        {avatarUrl && !avatarError && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRemoveAvatar}
            disabled={isUploading}
            className="flex items-center gap-2 text-destructive hover:text-destructive"
          >
            <X className="h-4 w-4" />
            {language === 'ar' ? 'حذف' : 'Remove'}
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
        disabled={isUploading}
      />

      <p className="text-xs text-muted-foreground text-center max-w-xs">
        {language === 'ar' 
          ? 'الصيغ المدعومة: JPG, PNG, GIF (حد أقصى 5 ميجابايت)'
          : 'Supported formats: JPG, PNG, GIF (max 5MB)'
        }
      </p>
    </div>
  );
}
