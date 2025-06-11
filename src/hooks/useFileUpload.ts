import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToastHelper } from './use-toast-helper';

export interface UploadedFile {
  name: string;
  url: string;
  type: string;
  size: number;
  thumbnail?: string; // Base64 thumbnail for images
  preview?: string; // Local preview URL
}

export interface FileUploadState {
  isUploading: boolean;
  uploadedFiles: UploadedFile[];
  error: string | null;
}

export function useFileUpload() {
  const [state, setState] = useState<FileUploadState>({
    isUploading: false,
    uploadedFiles: [],
    error: null
  });

  const { showError, showSuccess } = useToastHelper();

  // Generate thumbnail for image files
  const generateThumbnail = useCallback((file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve(undefined);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Set thumbnail size (max 150px)
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
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = () => resolve(undefined);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(file);
    });
  }, []);

  // Validate file type and size
  const validateFile = useCallback((file: File): string | null => {
    // Explicitly check and reject PDFs
    if (file.type === 'application/pdf') {
      return 'PDF files are not supported. Please use images or text files only.';
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      return `File type ${file.type} not supported. Allowed: images, text files`;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return 'File size must be less than 10MB';
    }

    return null;
  }, []);

  const uploadFiles = useCallback(async (files: FileList) => {
    if (!files.length) return;

    setState(prev => ({ ...prev, isUploading: true, error: null }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // First check for any PDF files in the selection
      const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
      if (pdfFiles.length > 0) {
        const errorMessage = 'PDF files are not supported. Please use images or text files only.';
        showError(errorMessage);
        setState(prev => ({ ...prev, isUploading: false, error: errorMessage }));
        return null;
      }

      const uploadPromises = Array.from(files).map(async (file) => {
        // Validate file
        const validationError = validateFile(file);
        if (validationError) {
          throw new Error(validationError);
        }

        // Generate thumbnail for images
        const thumbnail = await generateThumbnail(file);

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
          size: file.size,
          thumbnail,
          preview: thumbnail || (file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined)
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
  }, [validateFile, generateThumbnail, showError, showSuccess]);

  const removeFile = useCallback((index: number) => {
    setState(prev => {
      const fileToRemove = prev.uploadedFiles[index];
      // Clean up object URL if it exists
      if (fileToRemove?.preview && fileToRemove.preview.startsWith('blob:')) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      
      return {
        ...prev,
        uploadedFiles: prev.uploadedFiles.filter((_, i) => i !== index)
      };
    });
  }, []);

  const clearFiles = useCallback(() => {
    setState(prev => {
      // Clean up all object URLs
      prev.uploadedFiles.forEach(file => {
        if (file.preview && file.preview.startsWith('blob:')) {
          URL.revokeObjectURL(file.preview);
        }
      });
      
      return { ...prev, uploadedFiles: [] };
    });
  }, []);

  return {
    ...state,
    uploadFiles,
    removeFile,
    clearFiles
  };
}
