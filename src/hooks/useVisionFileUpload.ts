
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToastHelper } from '@/hooks/use-toast-helper';

export interface VisionUploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  publicUrl: string;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

export function useVisionFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<VisionUploadedFile[]>([]);
  const { showError, showSuccess } = useToastHelper();

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Please upload only JPG, PNG, or WebP images';
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return 'File size must be less than 5MB';
    }
    
    return null;
  };

  const uploadFiles = async (files: FileList) => {
    if (files.length > 1) {
      showError('Please upload only one image at a time');
      return;
    }

    const file = files[0];
    const validationError = validateFile(file);
    
    if (validationError) {
      showError(validationError);
      return;
    }

    setIsUploading(true);
    
    try {
      const uploadedFile = await uploadSingleFile(file);
      if (uploadedFile) {
        setUploadedFiles([uploadedFile]); // Replace existing file
        showSuccess('Image uploaded successfully');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showError('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const uploadSingleFile = async (file: File): Promise<VisionUploadedFile | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const filePath = `${user.id}/${fileId}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('vision_uploads')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('vision_uploads')
        .getPublicUrl(filePath);

      return {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        url: filePath,
        publicUrl
      };
    } catch (error) {
      console.error('Single file upload error:', error);
      throw error;
    }
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const clearFiles = () => {
    setUploadedFiles([]);
  };

  return {
    isUploading,
    uploadedFiles,
    uploadFiles,
    removeFile,
    clearFiles,
    validateFile
  };
}
