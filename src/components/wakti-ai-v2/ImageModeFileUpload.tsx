import React, { useRef } from 'react';
import { X, Image as ImageIcon } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';

export interface ImageModeUploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  preview?: string;
  base64?: string;
}

interface ImageModeFileUploadProps {
  onFilesUploaded: (files: ImageModeUploadedFile[]) => void;
  onRemoveFile: (fileId: string) => void;
  uploadedFiles: ImageModeUploadedFile[];
  isUploading: boolean;
  disabled?: boolean;
  maxFiles?: number;
}

export function ImageModeFileUpload({
  onFilesUploaded,
  onRemoveFile,
  uploadedFiles,
  isUploading,
  disabled = false,
  maxFiles = 1,
}: ImageModeFileUploadProps) {
  const { language } = useTheme();
  const { showError } = useToastHelper();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    if (uploadedFiles.length + files.length > maxFiles) {
      showError(
        language === 'ar' 
          ? `يمكنك تحميل بحد أقصى ${maxFiles} ملف` 
          : `You can upload up to ${maxFiles} file${maxFiles > 1 ? 's' : ''}`
      );
      return;
    }

    const validFiles: ImageModeUploadedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (!file.type.startsWith('image/')) {
        showError(
          language === 'ar' 
            ? `${file.name} ليس ملف صورة صالح` 
            : `${file.name} is not a valid image file`
        );
        continue;
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB
        showError(
          language === 'ar'
            ? `${file.name} حجم الملف كبير جدًا (الحد الأقصى 10 ميجابايت)`
            : `${file.name} is too large (max 10MB)`
        );
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        const fileObj: ImageModeUploadedFile = {
          id: `img-${Date.now()}-${i}`,
          name: file.name,
          type: file.type,
          size: file.size,
          url: URL.createObjectURL(file),
          preview: base64,
          base64: base64.split(',')[1] // Remove data URL prefix
        };
        validFiles.push(fileObj);
      } catch (error) {
        console.error('Error processing file:', file.name, error);
        showError(
          language === 'ar'
            ? `خطأ في معالجة الملف: ${file.name}`
            : `Error processing file: ${file.name}`
        );
      }
    }

    if (validFiles.length > 0) {
      onFilesUploaded(validFiles);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    // Reset input so same file can be chosen again
    if (e.target) e.target.value = '';
  };


  return (
    <div className="w-full relative z-[120] isolate pointer-events-auto px-0 md:px-6 max-w-6xl mx-auto">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/*"
        multiple={maxFiles > 1}
        className="hidden"
        aria-label="Image mode file input"
        title="Image mode file input"
        disabled={disabled || isUploading}
      />

      {uploadedFiles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {uploadedFiles.map((file, index) => (
            <div
              key={file.id}
              className="relative group rounded-lg border border-border/50 bg-white/70 dark:bg-neutral-900/40 backdrop-blur-md shadow-sm overflow-hidden"
            >
              {/* Large image preview */}
              <img
                src={file.preview || file.url}
                alt={file.name}
                className="w-full h-32 object-cover"
                onError={(e) => {
                  // Fallback to icon if image fails
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
              {/* Image number badge */}
              <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md">
                {index + 1}
              </div>
              {/* Remove button */}
              <button
                type="button"
                onClick={() => {
                  try { if (file.url) URL.revokeObjectURL(file.url); } catch {}
                  onRemoveFile(file.id);
                }}
                className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={disabled || isUploading}
                aria-label={language === 'ar' ? 'حذف الصورة' : 'Remove image'}
              >
                <X className="h-4 w-4" />
              </button>              {/* File name at bottom */}
              <div className="p-2 bg-gradient-to-t from-black/60 to-transparent absolute bottom-0 left-0 right-0">
                <span className="text-xs text-white truncate block">
                  {file.name}
                </span>
              </div>
            </div>
          ))}
          
          {/* Add more button if under max */}
          {uploadedFiles.length < maxFiles && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
              className="h-32 rounded-lg border-2 border-dashed border-border/50 bg-white/40 dark:bg-neutral-900/20 hover:bg-white/60 dark:hover:bg-neutral-900/40 flex flex-col items-center justify-center gap-2 transition-colors"
            >
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {language === 'ar' ? 'إضافة صورة' : 'Add image'}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
