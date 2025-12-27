
import React, { useState, useRef, useEffect } from 'react';
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
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Helper: map MIME type to extension
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/gif': 'gif'
  };

  const getSafeExt = (f: File) => {
    const fromName = f.name && f.name.includes('.') ? f.name.split('.').pop()?.toLowerCase() : undefined;
    if (fromName) return fromName;
    return mimeToExt[f.type] || 'bin';
  };

  const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
    new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode image'))), type, quality)
    );

  const loadBitmapOrImage = async (
    file: File
  ): Promise<{ draw: (ctx: CanvasRenderingContext2D) => void; width: number; height: number }> => {
    if ('createImageBitmap' in window) {
      try {
        // @ts-ignore - imageOrientation may not exist in older TS lib
        const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
        return {
          width: bmp.width,
          height: bmp.height,
          draw: (ctx) => ctx.drawImage(bmp, 0, 0, bmp.width, bmp.height)
        };
      } catch {}
    }
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to load image for processing'));
        image.src = url;
      });
      return {
        width: img.naturalWidth,
        height: img.naturalHeight,
        draw: (ctx) => ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight)
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const processImage = async (
    file: File
  ): Promise<{ blob: Blob; ext: string; type: string }> => {
    const type = file.type;
    const allowedPassThrough = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedPassThrough.includes(type) && file.size <= 5 * 1024 * 1024) {
      return { blob: file, ext: getSafeExt(file), type };
    }

    const { draw, width, height } = await loadBitmapOrImage(file);
    const maxDim = 1280;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas context unavailable');
    draw(ctx);

    let quality = 0.85;
    let blob = await toBlob(canvas, 'image/jpeg', quality);
    while (blob.size > 5 * 1024 * 1024 && quality > 0.5) {
      quality -= 0.1;
      blob = await toBlob(canvas, 'image/jpeg', quality);
    }
    if (blob.size > 5 * 1024 * 1024) {
      throw new Error('Compressed image still too large (max 5MB)');
    }
    return { blob, ext: 'jpg', type: 'image/jpeg' };
  };

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

  // State to force avatar re-render
  const [avatarKey, setAvatarKey] = useState(Date.now());
  // Local override for immediate avatar display before refetch completes
  const [immediateAvatarUrl, setImmediateAvatarUrl] = useState<string | null | undefined>(undefined);

  // Add cache-busting to avatar URL
  const getCacheBustedAvatarUrl = (url: string | null | undefined) => {
    if (!url) return undefined;
    const timestamp = avatarKey;
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

    setIsUploading(true);
    setAvatarError(false);

    try {
      // Ensure profile exists before uploading
      await ensureProfileExists();

      // Process/convert image if needed (handles HEIC/large files)
      const processed = await processImage(file);

      // Create unique filename with user ID folder structure for better organization
      const fileExt = processed.ext || getSafeExt(file);
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      console.log('Uploading avatar file:', fileName);

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, processed.blob, {
          contentType: processed.type,
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      console.log('Upload successful:', uploadData);

      // Get signed URL (more reliable than public URL for CORS)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('avatars')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year expiry

      if (signedUrlError) {
        console.error('Signed URL error:', signedUrlError);
        // Fallback to public URL
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);
        console.log('Fallback to public URL:', publicUrl);
        var avatarUrlToSave = publicUrl;
      } else {
        console.log('Signed URL generated:', signedUrlData.signedUrl);
        var avatarUrlToSave = signedUrlData.signedUrl;
      }

      // Update profile with new avatar URL (trim to prevent leading/trailing spaces)
      const cleanUrl = avatarUrlToSave.trim();
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: cleanUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Profile update error:', updateError);
        throw updateError;
      }

      // Force immediate avatar refresh - set local state immediately
      setImmediateAvatarUrl(cleanUrl);
      setAvatarKey(Date.now());
      setAvatarError(false); // Reset error state for new image
      
      // Force refresh profile data to get the latest avatar
      await refetch();

      // Dispatch event to update avatars across the app
      window.dispatchEvent(new CustomEvent('avatar-updated', { 
        detail: { avatarUrl: cleanUrl, userId: user.id, timestamp: Date.now() } 
      }));

      toast.success(language === 'ar' ? 'تم تحديث الصورة الشخصية بنجاح' : 'Profile picture updated successfully');
      
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      const msg = error?.message ? `: ${error.message}` : '';
      toast.error((language === 'ar' ? 'فشل في تحديث الصورة الشخصية' : 'Failed to update profile picture') + msg);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
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

      // Force immediate avatar refresh - clear local state
      setImmediateAvatarUrl(null);
      setAvatarKey(Date.now());
      
      // Refresh profile data
      await refetch();

      // Dispatch event to update avatars across the app
      window.dispatchEvent(new CustomEvent('avatar-updated', { 
        detail: { avatarUrl: null, userId: user.id, timestamp: Date.now() } 
      }));

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

  // Convert public URL to signed URL to bypass CORS issues
  const [signedAvatarUrl, setSignedAvatarUrl] = useState<string | undefined>(undefined);
  
  // Function to extract file path from avatar URL and get signed URL
  const getSignedUrlFromPublicUrl = async (publicUrl: string) => {
    try {
      // Extract file path from public URL
      // Format: https://xxx.supabase.co/storage/v1/object/public/avatars/{path}
      const match = publicUrl.match(/\/avatars\/(.+)$/);
      if (!match) return publicUrl; // Return original if can't parse
      
      const filePath = match[1].split('?')[0]; // Remove any query params
      
      const { data, error } = await supabase.storage
        .from('avatars')
        .createSignedUrl(filePath, 60 * 60); // 1 hour expiry
      
      if (error || !data?.signedUrl) {
        console.error('Failed to get signed URL:', error);
        return publicUrl; // Fallback to public URL
      }
      
      return data.signedUrl;
    } catch (err) {
      console.error('Error getting signed URL:', err);
      return publicUrl;
    }
  };

  // Get signed URL when avatar URL changes
  useEffect(() => {
    const rawUrl = immediateAvatarUrl !== undefined ? immediateAvatarUrl : profile?.avatar_url;
    
    if (!rawUrl) {
      setSignedAvatarUrl(undefined);
      return;
    }
    
    // If it's already a signed URL, use it directly
    if (rawUrl.includes('token=')) {
      setSignedAvatarUrl(getCacheBustedAvatarUrl(rawUrl));
      return;
    }
    
    // Convert public URL to signed URL
    getSignedUrlFromPublicUrl(rawUrl).then(signedUrl => {
      setSignedAvatarUrl(getCacheBustedAvatarUrl(signedUrl));
    });
  }, [immediateAvatarUrl, profile?.avatar_url, avatarKey]);

  const avatarUrl = signedAvatarUrl;

  // Clear immediate override once profile is updated with the new URL
  useEffect(() => {
    if (immediateAvatarUrl !== undefined && profile?.avatar_url === immediateAvatarUrl) {
      setImmediateAvatarUrl(undefined);
    }
  }, [profile?.avatar_url, immediateAvatarUrl]);

  // Reset error when avatar URL changes so new images render after a previous load error
  useEffect(() => {
    setAvatarError(false);
  }, [avatarUrl]);

  // Listen for avatar updates from other components
  useEffect(() => {
    const handleAvatarUpdate = () => {
      setAvatarKey(Date.now());
      refetch();
    };
    window.addEventListener('avatar-updated', handleAvatarUpdate);
    return () => window.removeEventListener('avatar-updated', handleAvatarUpdate);
  }, [refetch]);

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        <Avatar 
          className="h-24 w-24 ring-2 ring-border"
          key={`${profile?.avatar_url || 'no-avatar'}-${avatarKey}`} // Force re-render when avatar changes
        >
          <AvatarImage 
            src={!avatarError && avatarUrl ? avatarUrl : undefined} 
            alt={language === 'ar' ? 'الصورة الشخصية' : 'Profile picture'}
            onError={handleAvatarError}
          />
          <AvatarFallback className="text-lg font-semibold" delayMs={600}>
            {getInitials()}
          </AvatarFallback>
        </Avatar>
        
        {isUploading && (
          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 w-full">
        <Button
          variant="outline"
          size="sm"
          onClick={() => cameraInputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          {language === 'ar' ? 'التقاط صورة' : 'Take Photo'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {language === 'ar' ? 'رفع من الملفات' : 'Upload from Files'}
        </Button>

        {avatarUrl && !avatarError && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRemoveAvatar}
            disabled={isUploading}
            className="flex items-center justify-center gap-2 w-full sm:w-auto text-destructive hover:text-destructive"
          >
            <X className="h-4 w-4" />
            {language === 'ar' ? 'حذف' : 'Remove'}
          </Button>
        )}
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,image/heic,image/heif,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.bmp,.tiff"
        capture="environment"
        onChange={handleImageUpload}
        className="hidden"
        disabled={isUploading}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,image/heic,image/heif,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.bmp,.tiff"
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
