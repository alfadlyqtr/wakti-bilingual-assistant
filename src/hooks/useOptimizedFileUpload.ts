
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToastHelper } from '@/hooks/use-toast-helper';

export interface OptimizedUploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  publicUrl: string;
  optimized: boolean;
  thumbnail?: string;
  // CRITICAL: Vision API compatible format
  image_url: {
    url: string;
    detail: string;
  };
}

export function useOptimizedFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<OptimizedUploadedFile[]>([]);
  const { showError, showSuccess } = useToastHelper();

  const uploadFiles = async (files: FileList) => {
    setIsUploading(true);
    console.log('📤 ENHANCED VISION UPLOAD: Starting upload of', files.length, 'files');
    
    const uploadPromises = Array.from(files).map(uploadSingleFile);
    
    try {
      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter(Boolean) as OptimizedUploadedFile[];
      
      if (successfulUploads.length > 0) {
        setUploadedFiles(prev => [...prev, ...successfulUploads]);
        showSuccess(`Successfully uploaded ${successfulUploads.length} file(s) for enhanced Vision processing`);
        console.log('✅ ENHANCED VISION UPLOAD: Successfully uploaded', successfulUploads.length, 'files with enhanced Vision format');
      }
      
      if (successfulUploads.length < files.length) {
        showError(`Failed to upload ${files.length - successfulUploads.length} file(s)`);
      }
    } catch (error) {
      console.error('❌ ENHANCED VISION UPLOAD: Upload error:', error);
      showError('Failed to upload files for Vision processing');
    } finally {
      setIsUploading(false);
    }
  };

  const uploadSingleFile = async (file: File): Promise<OptimizedUploadedFile | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ ENHANCED VISION UPLOAD: User not authenticated');
        throw new Error('User not authenticated');
      }

      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const filePath = `${user.id}/${fileId}-${file.name}`;

      console.log(`📤 ENHANCED VISION UPLOAD: Processing file: ${file.name} (${file.type}) -> ${filePath}`);

      // Upload to ai-temp-images bucket
      const { error: uploadError } = await supabase.storage
        .from('ai-temp-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ ENHANCED VISION UPLOAD: Storage upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('ai-temp-images')
        .getPublicUrl(filePath);

      console.log(`📤 ENHANCED VISION UPLOAD: Generated URL for enhanced processing: ${publicUrl}`);

      // Create thumbnail for images if needed
      let thumbnail = undefined;
      if (file.type.startsWith('image/')) {
        try {
          thumbnail = await createImageThumbnail(file);
        } catch (thumbError) {
          console.warn('⚠️ ENHANCED VISION UPLOAD: Thumbnail creation failed:', thumbError);
        }
      }

      // ENHANCED Vision API format - exactly what OpenAI expects
      const optimizedFile: OptimizedUploadedFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        url: filePath,
        publicUrl,
        optimized: true,
        thumbnail,
        // CRITICAL: Enhanced Vision API format with proper structure
        image_url: {
          url: publicUrl,
          detail: 'high' // Always use high detail for enhanced Vision
        }
      };

      console.log(`✅ ENHANCED VISION UPLOAD: File ready for enhanced Vision API: ${file.name}`);
      console.log(`🔗 ENHANCED VISION URL: ${publicUrl}`);
      
      return optimizedFile;
    } catch (error) {
      console.error(`❌ ENHANCED VISION UPLOAD: Single file upload error for ${file.name}:`, error);
      showError(`Failed to upload ${file.name} for Vision processing: ${error.message}`);
      return null;
    }
  };

  const createImageThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate thumbnail size (max 150px)
        const maxSize = 150;
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };

      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const removeFile = (fileId: string) => {
    console.log('🗑️ VISION UPLOAD: Removing file:', fileId);
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const clearFiles = () => {
    console.log('🗑️ VISION UPLOAD: Clearing all files');
    setUploadedFiles([]);
  };

  return {
    isUploading,
    uploadedFiles,
    uploadFiles,
    removeFile,
    clearFiles
  };
}
