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
  // FIXED: Enhanced Vision API compatible format with proper base64 handling
  image_url: {
    url: string;
    detail: string;
  };
  base64Data?: string; // Store base64 data for Vision API
}

export function useOptimizedFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<OptimizedUploadedFile[]>([]);
  const { showError, showSuccess } = useToastHelper();

  // FIXED: Enhanced image to base64 conversion with better validation
  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        try {
          console.log(`🔄 VISION UPLOAD: Converting ${file.name} to base64 - Original: ${img.width}x${img.height}`);
          
          // FIXED: Calculate optimal size for Vision API (max 1024px on longest side)
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
          
          // FIXED: Clear canvas and draw with proper scaling
          ctx?.clearRect(0, 0, width, height);
          ctx?.drawImage(img, 0, 0, width, height);
          
          // FIXED: Convert to JPEG with optimal quality for Vision processing
          const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.90);
          
          // FIXED: Validate the data URL format
          if (!jpegDataUrl.startsWith('data:image/jpeg;base64,')) {
            throw new Error('Invalid data URL format generated');
          }
          
          // Extract base64 data (remove data:image/jpeg;base64, prefix)
          const base64Data = jpegDataUrl.split(',')[1];
          
          // FIXED: Enhanced validation
          if (!base64Data || base64Data.length < 100) {
            throw new Error('Base64 conversion produced invalid result');
          }
          
          // FIXED: Additional validation - test decode a portion
          try {
            const testDecode = atob(base64Data.substring(0, 100));
            if (!testDecode || testDecode.length === 0) {
              throw new Error('Base64 validation failed');
            }
          } catch {
            throw new Error('Invalid base64 data generated');
          }
          
          console.log(`✅ VISION UPLOAD: ${file.name} -> ${width}x${height} -> ${base64Data.length} chars base64`);
          resolve(base64Data);
        } catch (conversionError: any) {
          console.error(`❌ VISION UPLOAD: Conversion failed for ${file.name}:`, conversionError);
          reject(new Error(`Image processing failed: ${conversionError.message}`));
        }
      };

      img.onerror = () => {
        console.error(`❌ VISION UPLOAD: Failed to load image ${file.name}`);
        reject(new Error('Failed to load image - invalid image file'));
      };
      
      // FIXED: Create object URL for reliable image loading
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
      
      // Clean up object URL after loading
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
      };
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
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
      };
    });
  };

  const uploadFiles = async (files: FileList) => {
    setIsUploading(true);
    console.log('📤 VISION UPLOAD: Starting upload of', files.length, 'files with ENHANCED processing');
    
    const uploadPromises = Array.from(files).map(uploadSingleFile);
    
    try {
      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter(Boolean) as OptimizedUploadedFile[];
      
      if (successfulUploads.length > 0) {
        setUploadedFiles(prev => [...prev, ...successfulUploads]);
        showSuccess(`✅ Successfully uploaded ${successfulUploads.length} file(s) for Vision processing`);
        console.log('✅ VISION UPLOAD: Successfully uploaded', successfulUploads.length, 'files with ENHANCED base64 encoding');
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

      // FIXED: Enhanced file type validation
      if (!file.type.startsWith('image/')) {
        console.error('❌ VISION UPLOAD: Invalid file type:', file.type);
        throw new Error('Only image files are supported for Vision processing');
      }

      // FIXED: Validate file size (max 10MB for Vision processing)
      if (file.size > 10 * 1024 * 1024) {
        console.error('❌ VISION UPLOAD: File too large:', file.size);
        throw new Error('Image file must be smaller than 10MB for Vision processing');
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

      // FIXED: Enhanced base64 conversion with comprehensive error handling
      let base64Data = '';
      try {
        base64Data = await convertImageToBase64(file);
        console.log(`🔄 VISION UPLOAD: Converted ${file.name} to base64 (${base64Data.length} chars)`);
        
        // FIXED: Additional validation - ensure base64 is valid for Claude Vision
        if (!base64Data || base64Data.length < 100) {
          throw new Error('Invalid base64 conversion result');
        }
        
        // FIXED: Test the base64 data is valid by attempting to decode a portion
        try {
          const testDecode = atob(base64Data.substring(0, 100));
          if (!testDecode || testDecode.length === 0) {
            throw new Error('Base64 data validation failed');
          }
        } catch {
          throw new Error('Generated base64 data is invalid');
        }
        
      } catch (base64Error: any) {
        console.error('❌ VISION UPLOAD: Base64 conversion failed:', base64Error);
        throw new Error(`❌ Unable to process image ${file.name}. Please upload a valid JPEG or PNG file.`);
      }

      // Create thumbnail for images
      let thumbnail = undefined;
      try {
        thumbnail = await createImageThumbnail(file);
      } catch (thumbError) {
        console.warn('⚠️ VISION UPLOAD: Thumbnail creation failed:', thumbError);
      }

      // FIXED: Enhanced Vision API format with validated base64 data
      const optimizedFile: OptimizedUploadedFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        url: filePath,
        publicUrl,
        optimized: true,
        thumbnail,
        base64Data, // Store base64 data directly
        // FIXED: Properly formatted Vision API data for Claude
        image_url: {
          url: `data:${file.type};base64,${base64Data}`,
          detail: 'auto' // Optimal for Claude Vision
        }
      };

      console.log(`✅ VISION UPLOAD: File ready for Claude Vision API: ${file.name}`);
      console.log(`🔗 BASE64 LENGTH: ${base64Data.length} characters`);
      console.log(`🔗 VISION URL FORMAT: ${optimizedFile.image_url.url.substring(0, 50)}...`);
      
      return optimizedFile;
    } catch (error: any) {
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
