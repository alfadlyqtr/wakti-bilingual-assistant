
import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, Loader2 } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { supabase } from '@/integrations/supabase/client';
import { ImageTypeSelector, ImageTypeOption } from './ImageTypeSelector';

export interface SimplifiedUploadedFile {
  id: string;
  name: string;
  url: string;
  publicUrl: string;
  type: string;
  size: number;
  preview?: string;
  imageType?: ImageTypeOption;
}

interface SimplifiedFileUploadProps {
  onFilesUploaded: (files: SimplifiedUploadedFile[]) => void;
  uploadedFiles: SimplifiedUploadedFile[];
  onRemoveFile: (fileId: string) => void;
  isUploading: boolean;
  disabled?: boolean;
  onExamplePromptSelect?: (prompt: string) => void;
}

export function SimplifiedFileUpload({
  onFilesUploaded,
  uploadedFiles,
  onRemoveFile,
  isUploading,
  disabled = false,
  onExamplePromptSelect
}: SimplifiedFileUploadProps) {
  const { language } = useTheme();
  const { showError, showSuccess } = useToastHelper();

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

  const uploadFiles = useCallback(async (files: File[]) => {
    if (!files || files.length === 0) return;

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

          if (!file.type.startsWith('image/') && file.type !== 'text/plain') {
            throw new Error(`File type ${file.type} not supported`);
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

          const uploadedFile: SimplifiedUploadedFile = {
            id: `file_${Date.now()}_${Math.random().toString(36).substring(2)}`,
            name: file.name,
            url: publicUrl,
            publicUrl: publicUrl,
            type: file.type,
            size: file.size,
            preview: preview
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
    }
  }, [generatePreview, showError, showSuccess, onFilesUploaded]);

  const updateFileImageType = (fileId: string, imageType: ImageTypeOption) => {
    const updatedFiles = uploadedFiles.map(file => 
      file.id === fileId ? { ...file, imageType } : file
    );
    onFilesUploaded(updatedFiles);
    
    // Send example prompt to parent
    if (onExamplePromptSelect && imageType.examplePrompt) {
      onExamplePromptSelect(imageType.examplePrompt);
    }
  };

  // Handle file selection from PlusMenu
  React.useEffect(() => {
    const handleFileInput = (event: CustomEvent<{ files: FileList }>) => {
      if (event.detail?.files) {
        const fileArray = Array.from(event.detail.files).filter((file: File) => 
          file.type.startsWith('image/') || file.type === 'text/plain'
        );
        
        if (fileArray.length === 0) {
          showError('Please select valid image or text files');
          return;
        }

        uploadFiles(fileArray);
      }
    };

    window.addEventListener('wakti-file-selected', handleFileInput as EventListener);
    return () => window.removeEventListener('wakti-file-selected', handleFileInput as EventListener);
  }, [uploadFiles, showError]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* Uploaded Files Display */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">
            {language === 'ar' ? 'الملفات المرفوعة' : 'Uploaded Files'}
          </h3>
          <div className="space-y-3">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-white/10 dark:bg-white/5 border border-white/20"
              >
                {/* 80x80 Thumbnail */}
                {file.preview && (
                  <div className="relative">
                    <img 
                      src={file.preview} 
                      alt={file.name}
                      className="w-20 h-20 rounded-lg object-cover flex-shrink-0 border border-white/20"
                    />
                    {/* Delete button on thumbnail */}
                    <Button
                      onClick={() => onRemoveFile(file.id)}
                      variant="ghost"
                      size="sm"
                      className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full bg-red-500 text-white hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                
                {/* File info and controls */}
                <div className="flex-1 min-w-0 space-y-2">
                  {/* File name and size */}
                  <div>
                    <p className="text-sm font-medium text-foreground truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  
                  {/* Type selector and description */}
                  <div className="flex items-start gap-2">
                    <ImageTypeSelector
                      selectedType={file.imageType?.id || null}
                      onTypeSelect={(type) => updateFileImageType(file.id, type)}
                      compact={true}
                    />
                  </div>
                  
                  {/* Show description when type is selected */}
                  {file.imageType && (
                    <div className="text-xs text-muted-foreground bg-primary/5 px-2 py-1 rounded border border-primary/20">
                      <span className="text-primary font-medium">{file.imageType.icon} {file.imageType.name}:</span> {file.imageType.hint}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isUploading && (
        <div className="flex items-center justify-center gap-2 p-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">
            {language === 'ar' ? 'جاري الرفع...' : 'Uploading...'}
          </span>
        </div>
      )}
    </div>
  );
}
