
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
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

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

  const uploadFiles = useCallback(async (files: File[], imageType: ImageTypeOption) => {
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
        
        // Clear pending files
        setPendingFiles([]);
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
  };

  const handleTypeSelect = (imageType: ImageTypeOption) => {
    if (pendingFiles.length > 0) {
      uploadFiles(pendingFiles, imageType);
    }
  };

  const handleCancel = () => {
    setPendingFiles([]);
  };

  const updateFileImageType = (fileId: string, imageType: ImageTypeOption) => {
    const updatedFiles = uploadedFiles.map(file => 
      file.id === fileId ? { ...file, imageType } : file
    );
    onFilesUploaded(updatedFiles.filter(f => f.id !== fileId));
    onFilesUploaded([updatedFiles.find(f => f.id === fileId)!]);
  };

  // Expose file selection for PlusMenu
  React.useEffect(() => {
    const handleFileInput = (event: CustomEvent) => {
      if (event.detail?.files) {
        handleFileSelect(event.detail.files);
      }
    };

    window.addEventListener('wakti-file-selected', handleFileInput as EventListener);
    return () => window.removeEventListener('wakti-file-selected', handleFileInput as EventListener);
  }, []);

  return (
    <div className="space-y-4">
      {/* Pending Files & Type Selection */}
      {pendingFiles.length > 0 && (
        <div className="p-4 rounded-xl bg-white/5 dark:bg-black/5 backdrop-blur-xl border border-white/10 dark:border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">
              {language === 'ar' ? 'اختر نوع الصورة' : 'Select Image Type'}
            </h3>
            <Button
              onClick={handleCancel}
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
            selectedType={null}
            onTypeSelect={handleTypeSelect}
          />
        </div>
      )}

      {/* Uploaded Files Display */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">
            {language === 'ar' ? 'الملفات المرفوعة' : 'Uploaded Files'}
          </h3>
          <div className="space-y-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-white/10 dark:bg-white/5 border border-white/20"
              >
                {file.preview && (
                  <img 
                    src={file.preview} 
                    alt={file.name}
                    className="w-8 h-8 rounded object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {file.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {file.imageType ? (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        {file.imageType.icon} {file.imageType.name}
                      </span>
                    ) : (
                      <span className="text-xs text-orange-500">
                        {language === 'ar' ? 'حدد النوع' : 'Select type'}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Inline Type Selector */}
                <ImageTypeSelector
                  selectedType={file.imageType?.id || null}
                  onTypeSelect={(type) => updateFileImageType(file.id, type)}
                  compact={true}
                />
                
                <Button
                  onClick={() => onRemoveFile(file.id)}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-white/10 flex-shrink-0"
                >
                  <X className="h-3 w-3" />
                </Button>
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
