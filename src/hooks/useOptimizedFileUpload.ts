
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToastHelper } from './use-toast-helper';

export interface OptimizedFile {
  id: string;
  name: string;
  url: string;
  publicUrl: string;
  type: string;
  size: number;
  thumbnail?: string;
  preview?: string;
}

export function useOptimizedFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<OptimizedFile[]>([]);
  const { showError, showSuccess } = useToastHelper();

  // Generate base64 preview for images
  const generatePreview = useCallback((file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve(undefined);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const result = e.target?.result as string;
          resolve(result);
        } catch (error) {
          console.error('Preview generation failed:', error);
          resolve(undefined);
        }
      };
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(file);
    });
  }, []);

  const uploadFiles = useCallback(async (files: FileList) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      console.log('📁 Starting upload for', files.length, 'files');

      const uploadPromises = Array.from(files).map(async (file) => {
        try {
          // Validate file
          if (file.size > 10 * 1024 * 1024) {
            throw new Error(`File ${file.name} is too large (max 10MB)`);
          }

          // Generate preview
          const preview = await generatePreview(file);
          
          // Create unique filename
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

          console.log('⬆️ Uploading file:', file.name, 'Size:', file.size);

          // Upload to Supabase storage
          const { data, error } = await supabase.storage
            .from('wakti-ai-v2')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (error) {
            console.error('Upload error for', file.name, ':', error);
            throw new Error(`Upload failed for ${file.name}: ${error.message}`);
          }

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('wakti-ai-v2')
            .getPublicUrl(fileName);

          console.log('✅ Upload successful:', file.name, 'URL:', publicUrl);

          const optimizedFile: OptimizedFile = {
            id: `file_${Date.now()}_${Math.random().toString(36).substring(2)}`,
            name: file.name,
            url: publicUrl,
            publicUrl: publicUrl,
            type: file.type,
            size: file.size,
            thumbnail: preview,
            preview: preview
          };

          return optimizedFile;
        } catch (error) {
          console.error('Individual file upload failed:', error);
          showError(`Failed to upload ${file.name}: ${error.message}`);
          return null;
        }
      });

      const results = await Promise.allSettled(uploadPromises);
      const successfulUploads = results
        .filter((result): result is PromiseFulfilledResult<OptimizedFile> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value);

      if (successfulUploads.length > 0) {
        setUploadedFiles(prev => [...prev, ...successfulUploads]);
        showSuccess(`Successfully uploaded ${successfulUploads.length} file(s)`);
        console.log('🎉 All uploads completed. Total files:', successfulUploads.length);
      }

      const failedUploads = results.filter(result => result.status === 'rejected').length;
      if (failedUploads > 0) {
        showError(`${failedUploads} file(s) failed to upload`);
      }

    } catch (error) {
      console.error('❌ Upload process failed:', error);
      showError('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [generatePreview, showError, showSuccess]);

  const removeFile = useCallback((fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
  }, []);

  const clearFiles = useCallback(() => {
    setUploadedFiles([]);
  }, []);

  return {
    isUploading,
    uploadedFiles,
    uploadFiles,
    removeFile,
    clearFiles
  };
}
