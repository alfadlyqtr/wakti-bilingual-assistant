
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToastHelper } from './use-toast-helper';

export interface FileUploadState {
  isUploading: boolean;
  uploadedFiles: Array<{
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
  error: string | null;
}

export function useFileUpload() {
  const [state, setState] = useState<FileUploadState>({
    isUploading: false,
    uploadedFiles: [],
    error: null
  });

  const { showError, showSuccess } = useToastHelper();

  const uploadFiles = useCallback(async (files: FileList) => {
    if (!files.length) return;

    setState(prev => ({ ...prev, isUploading: true, error: null }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const uploadPromises = Array.from(files).map(async (file) => {
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'];
        if (!allowedTypes.includes(file.type)) {
          throw new Error(`File type ${file.type} not supported`);
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error('File size must be less than 10MB');
        }

        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

        // Upload to Supabase storage
        const { data, error } = await supabase.storage
          .from('message-media')
          .upload(fileName, file);

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('message-media')
          .getPublicUrl(fileName);

        return {
          name: file.name,
          url: publicUrl,
          type: file.type,
          size: file.size
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      
      setState(prev => ({ 
        ...prev, 
        uploadedFiles: [...prev.uploadedFiles, ...uploadedFiles],
        isUploading: false
      }));

      showSuccess(`${uploadedFiles.length} file(s) uploaded successfully`);
      return uploadedFiles;

    } catch (error: any) {
      console.error('Error uploading files:', error);
      setState(prev => ({ 
        ...prev, 
        error: error.message,
        isUploading: false
      }));
      showError(error.message || 'Failed to upload files');
      return null;
    }
  }, [showError, showSuccess]);

  const removeFile = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      uploadedFiles: prev.uploadedFiles.filter((_, i) => i !== index)
    }));
  }, []);

  const clearFiles = useCallback(() => {
    setState(prev => ({ ...prev, uploadedFiles: [] }));
  }, []);

  return {
    ...state,
    uploadFiles,
    removeFile,
    clearFiles
  };
}
