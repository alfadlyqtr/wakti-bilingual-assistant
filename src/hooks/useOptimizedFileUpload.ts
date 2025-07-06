
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
  optimized: boolean; // CRITICAL: Add this flag for consistent handling
}

export function useOptimizedFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<OptimizedUploadedFile[]>([]);
  const { showError, showSuccess } = useToastHelper();

  const uploadFiles = async (files: FileList) => {
    setIsUploading(true);
    const uploadPromises = Array.from(files).map(uploadSingleFile);
    
    try {
      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter(Boolean) as OptimizedUploadedFile[];
      
      if (successfulUploads.length > 0) {
        setUploadedFiles(prev => [...prev, ...successfulUploads]);
        showSuccess(`Successfully uploaded ${successfulUploads.length} file(s)`);
      }
      
      if (successfulUploads.length < files.length) {
        showError(`Failed to upload ${files.length - successfulUploads.length} file(s)`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      showError('Failed to upload files');
    } finally {
      setIsUploading(false);
    }
  };

  const uploadSingleFile = async (file: File): Promise<OptimizedUploadedFile | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const filePath = `${user.id}/${fileId}-${file.name}`;

      console.log(`📤 Uploading file: ${file.name} (${file.type}) to path: ${filePath}`);

      const { error: uploadError } = await supabase.storage
        .from('ai-temp-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('ai-temp-images')
        .getPublicUrl(filePath);

      const optimizedFile: OptimizedUploadedFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        url: filePath,
        publicUrl,
        optimized: true // CRITICAL: Set this flag for AI processing
      };

      console.log(`✅ Successfully uploaded: ${file.name} -> ${publicUrl}`);
      return optimizedFile;
    } catch (error) {
      console.error(`❌ Single file upload error for ${file.name}:`, error);
      showError(`Failed to upload ${file.name}`);
      return null;
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
    clearFiles
  };
}
