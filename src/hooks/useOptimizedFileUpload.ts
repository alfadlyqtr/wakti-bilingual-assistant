
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
  // PHASE 1: Vision API compatible format with base64
  image_url: {
    url: string;
    detail: string;
  };
  base64Data?: string; // Add base64 data for Vision API
}

export function useOptimizedFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<OptimizedUploadedFile[]>([]);
  const { showError, showSuccess } = useToastHelper();

  // PHASE 1: Convert image file to base64 with ENHANCED compression and validation
  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        try {
          // PHASE 1: Calculate compressed size (max 1024px on longest side for Vision)
          const maxSize = 1024;
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
          
          // Draw and convert to JPEG with quality 0.8 for Vision processing
          ctx?.drawImage(img, 0, 0, width, height);
          const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          
          // Extract base64 data (remove data:image/jpeg;base64, prefix)
          const base64Data = jpegDataUrl.split(',')[1];
          
          // Validate base64 result
          if (!base64Data || base64Data.length < 100) {
            throw new Error('Base64 conversion produced invalid result');
          }
          
          console.log(`🔄 BASE64 CONVERSION: ${file.name} -> ${width}x${height} -> ${base64Data.length} chars`);
          resolve(base64Data);
        } catch (conversionError) {
          reject(new Error(`Image processing failed: ${conversionError.message}`));
        }
      };

      img.onerror = () => reject(new Error('Failed to load image - invalid image file'));
      img.src = URL.createObjectURL(file);
    });
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

  const uploadFiles = async (files: FileList) => {
    setIsUploading(true);
    console.log('📤 VISION UPLOAD: Starting COMPLETE REPAIR upload of', files.length, 'files');
    
    const uploadPromises = Array.from(files).map(uploadSingleFile);
    
    try {
      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter(Boolean) as OptimizedUploadedFile[];
      
      if (successfulUploads.length > 0) {
        setUploadedFiles(prev => [...prev, ...successfulUploads]);
        showSuccess(`Successfully uploaded ${successfulUploads.length} file(s) for Vision processing`);
        console.log('✅ VISION UPLOAD: Successfully uploaded', successfulUploads.length, 'files with COMPLETE REPAIR base64 encoding');
      }
      
      if (successfulUploads.length < files.length) {
        showError(`Failed to upload ${files.length - successfulUploads.length} file(s)`);
      }
    } catch (error) {
      console.error('❌ VISION UPLOAD: Upload error:', error);
      showError('❌ Unable to upload files for Vision processing. Please try again with valid JPEG or PNG files.');
    } finally {
      setIsUploading(false);
    }
  };

  const uploadSingleFile = async (file: File): Promise<OptimizedUploadedFile | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ VISION UPLOAD: User not authenticated');
        throw new Error('User not authenticated');
      }

      // PHASE 1: Validate file type
      if (!file.type.startsWith('image/')) {
        console.error('❌ VISION UPLOAD: Invalid file type:', file.type);
        throw new Error('Only image files are supported for Vision processing');
      }

      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const filePath = `${user.id}/${fileId}-${file.name}`;

      console.log(`📤 VISION UPLOAD: Processing file: ${file.name} (${file.type}) -> ${filePath}`);

      // Upload to ai-temp-images bucket for backup
      const { error: uploadError } = await supabase.storage
        .from('ai-temp-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ VISION UPLOAD: Storage upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL for backup
      const { data: { publicUrl } } = supabase.storage
        .from('ai-temp-images')
        .getPublicUrl(filePath);

      console.log(`📤 VISION UPLOAD: Generated backup URL: ${publicUrl}`);

      // PHASE 1: Convert image to base64 for Vision API - ENHANCED with validation
      let base64Data = '';
      try {
        base64Data = await convertImageToBase64(file);
        console.log(`🔄 VISION UPLOAD: Converted ${file.name} to base64 (${base64Data.length} chars) - COMPLETE REPAIR`);
        
        // Validate base64 data
        if (!base64Data || base64Data.length < 100) {
          throw new Error('Invalid base64 conversion result');
        }
      } catch (base64Error) {
        console.error('❌ VISION UPLOAD: Base64 conversion failed:', base64Error);
        throw new Error(`❌ Unable to process image ${file.name}. Please upload a valid JPEG or PNG file.`);
      }

      // Create thumbnail for images if needed
      let thumbnail = undefined;
      try {
        thumbnail = await createImageThumbnail(file);
      } catch (thumbError) {
        console.warn('⚠️ VISION UPLOAD: Thumbnail creation failed:', thumbError);
      }

      // PHASE 1: Vision API format with validated base64 data
      const optimizedFile: OptimizedUploadedFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        url: filePath,
        publicUrl,
        optimized: true,
        thumbnail,
        base64Data, // Store base64 data
        // CRITICAL: Vision API format with base64
        image_url: {
          url: `data:${file.type};base64,${base64Data}`,
          detail: 'auto' // Optimal for gpt-4-vision-preview
        }
      };

      console.log(`✅ VISION UPLOAD: File ready for COMPLETE REPAIR Vision API: ${file.name}`);
      console.log(`🔗 BASE64 LENGTH: ${base64Data.length} characters`);
      console.log(`🔗 VISION URL FORMAT: ${optimizedFile.image_url.url.substring(0, 50)}...`);
      
      return optimizedFile;
    } catch (error) {
      console.error(`❌ VISION UPLOAD: Single file upload error for ${file.name}:`, error);
      showError(`❌ Failed to upload ${file.name}: ${error.message}`);
      return null;
    }
  };

  const removeFile = (fileId: string) => {
    console.log('🗑️ VISION UPLOAD: Removing file:', fileId);
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const clearFiles = () => {
    console.log('🗑️ VISION UPLOAD: Clearing all files - COMPLETE REPAIR');
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
