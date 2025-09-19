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

  const fileToBase64 = async (file: File): Promise<string> => {
    const mime = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';
    try {
      if (typeof createImageBitmap === 'function') {
        // @ts-ignore options may not be typed
        const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const canvas = document.createElement('canvas');
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no-ctx');
        ctx.drawImage(bmp, 0, 0);
        // @ts-ignore close may exist
        try { (bmp as any)?.close?.(); } catch {}
        return canvas.toDataURL(mime, 0.95);
      }
    } catch {}
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
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
        <div className="space-y-2">
          {uploadedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-2 rounded-md border border-border/50 bg-white/70 dark:bg-neutral-900/40 backdrop-blur-md shadow-sm"
            >
              <div className="flex items-center space-x-2">
                {/* Small image preview (prefer base64 preview, fallback to object URL) */}
                <img
                  src={file.preview || file.url}
                  alt={file.name}
                  className="w-12 h-12 rounded-md object-cover border border-border/50"
                  onError={(e) => {
                    // Fallback to icon if image fails
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
                <span className="text-sm truncate max-w-[200px]">
                  {file.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  try { if (file.url) URL.revokeObjectURL(file.url); } catch {}
                  onRemoveFile(file.id);
                }}
                className="text-muted-foreground hover:text-foreground"
                disabled={disabled || isUploading}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
