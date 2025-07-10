
import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Camera, X, Loader2 } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { supabase } from '@/integrations/supabase/client';
import { ImageTypeSelector, ImageType } from './ImageTypeSelector';

export interface SimplifiedUploadedFile {
  id: string;
  name: string;
  url: string;
  publicUrl: string;
  type: string;
  size: number;
  preview?: string;
  imageType?: ImageType;
}

interface SimplifiedFileUploadProps {
  onFilesUploaded: (files: SimplifiedUploadedFile[]) => void;
  uploadedFiles: SimplifiedUploadedFile[];
  onRemoveFile: (fileId: string) => void;
  isUploading: boolean;
  disabled?: boolean;
}

export function SimplifiedFileUpload({
  onFilesUploaded,
  uploadedFiles,
  onRemoveFile,
  isUploading,
  disabled = false
}: SimplifiedFileUploadProps) {
  const { language } = useTheme();
  const { showError, showSuccess } = useToastHelper();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [selectedImageType, setSelectedImageType] = useState<ImageType | null>(null);

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

  const uploadFiles = useCallback(async (files: File[], imageType: ImageType) => {
    if (!files || files.length === 0) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      console.log('📁 Starting simplified upload for', files.length, 'files with type:', imageType.name);

      const uploadPromises = Array.from(files).map(async (file) => {
        try {
          // Validate file
          if (file.size > 10 * 1024 * 1024) {
            throw new Error(`File ${file.name} is too large (max 10MB)`);
          }

          if (!file.type.startsWith('image/') && file.type !== 'text/plain') {
            throw new Error(`File type ${file.type} not supported`);
          }

          // Generate preview
          const preview = await generatePreview(file);
          
          // Create unique filename
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

          console.log('⬆️ Uploading file:', file.name, 'Size:', file.size, 'Type:', imageType.name);

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

          const uploadedFile: SimplifiedUploadedFile = {
            id: `file_${Date.now()}_${Math.random().toString(36).substring(2)}`,
            name: file.name,
            url: publicUrl,
            publicUrl: publicUrl,
            type: file.type,
            size: file.size,
            preview: preview,
            imageType: imageType
          };

          return uploadedFile;
        } catch (error) {
          console.error('Individual file upload failed:', error);
          showError(`Failed to upload ${file.name}: ${error.message}`);
          return null;
        }
      });

      const results = await Promise.allSettled(uploadPromises);
      const successfulUploads = results
        .filter((result): result is PromiseFulfilledResult<SimplifiedUploadedFile> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value);

      if (successfulUploads.length > 0) {
        onFilesUploaded(successfulUploads);
        showSuccess(`Successfully uploaded ${successfulUploads.length} file(s) as ${imageType.name}`);
        console.log('🎉 All uploads completed. Total files:', successfulUploads.length);
        
        // Clear pending files and selection
        setPendingFiles([]);
        setSelectedImageType(null);
      }

      const failedUploads = results.filter(result => result.status === 'rejected').length;
      if (failedUploads > 0) {
        showError(`${failedUploads} file(s) failed to upload`);
      }

    } catch (error) {
      console.error('❌ Upload process failed:', error);
      showError('Upload failed. Please try again.');
    }
  }, [generatePreview, showError, showSuccess, onFilesUploaded]);

  const handleFileSelect = (files: FileList) => {
    const fileArray = Array.from(files).filter(file => 
      file.type.startsWith('image/') || file.type === 'text/plain'
    );
    
    if (fileArray.length === 0) {
      showError('Please select valid image or text files');
      return;
    }

    setPendingFiles(fileArray);
    setSelectedImageType(null);
  };

  const handleUploadConfirm = () => {
    if (pendingFiles.length > 0 && selectedImageType) {
      uploadFiles(pendingFiles, selectedImageType);
    }
  };

  const handleUploadCancel = () => {
    setPendingFiles([]);
    setSelectedImageType(null);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const triggerCamera = () => {
    cameraInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* File Upload Buttons */}
      {pendingFiles.length === 0 && (
        <div className="flex gap-2">
          <Button
            onClick={triggerFileInput}
            disabled={disabled || isUploading}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 h-9 px-3 rounded-xl bg-white/10 dark:bg-white/5 hover:bg-white/20 border-white/20 dark:border-white/10"
          >
            <Upload className="h-4 w-4" />
            <span className="text-sm">{language === 'ar' ? 'تحميل' : 'Upload'}</span>
          </Button>
          
          <Button
            onClick={triggerCamera}
            disabled={disabled || isUploading}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 h-9 px-3 rounded-xl bg-white/10 dark:bg-white/5 hover:bg-white/20 border-white/20 dark:border-white/10"
          >
            <Camera className="h-4 w-4" />
            <span className="text-sm">{language === 'ar' ? 'كاميرا' : 'Camera'}</span>
          </Button>
        </div>
      )}

      {/* Pending Files & Type Selection */}
      {pendingFiles.length > 0 && (
        <div className="p-4 rounded-xl bg-white/5 dark:bg-black/5 backdrop-blur-xl border border-white/10 dark:border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">
              {language === 'ar' ? 'ملفات جاهزة للرفع' : 'Files Ready to Upload'}
            </h3>
            <Button
              onClick={handleUploadCancel}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {pendingFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 dark:bg-white/5 border border-white/20">
                <span className="text-xs font-medium text-foreground truncate max-w-24">
                  {file.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({(file.size / 1024 / 1024).toFixed(1)}MB)
                </span>
              </div>
            ))}
          </div>

          <ImageTypeSelector
            selectedType={selectedImageType?.id || null}
            onTypeSelect={setSelectedImageType}
          />

          {selectedImageType && (
            <div className="flex gap-2">
              <Button
                onClick={handleUploadConfirm}
                disabled={isUploading}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                <span className="text-sm">
                  {language === 'ar' ? 'رفع الملفات' : 'Upload Files'}
                </span>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Uploaded Files Display */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">
            {language === 'ar' ? 'الملفات المرفوعة' : 'Uploaded Files'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-white/10 dark:bg-white/5 border border-white/20 max-w-xs"
              >
                {file.imageType && (
                  <span className="text-sm">{file.imageType.icon}</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {file.name}
                  </p>
                  {file.imageType && (
                    <p className="text-xs text-muted-foreground">
                      {file.imageType.name}
                    </p>
                  )}
                </div>
                <Button
                  onClick={() => onRemoveFile(file.id)}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-white/10"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.txt"
        onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
        className="hidden"
      />
    </div>
  );
}
