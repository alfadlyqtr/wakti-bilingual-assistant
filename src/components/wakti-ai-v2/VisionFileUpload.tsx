
import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, X, Upload, Loader2 } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useVisionFileUpload, VisionUploadedFile } from '@/hooks/useVisionFileUpload';

interface VisionFileUploadProps {
  onFilesChange: (files: VisionUploadedFile[]) => void;
  disabled?: boolean;
}

export function VisionFileUpload({ onFilesChange, disabled }: VisionFileUploadProps) {
  const { language } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isUploading, uploadedFiles, uploadFiles, removeFile, clearFiles } = useVisionFileUpload();

  React.useEffect(() => {
    onFilesChange(uploadedFiles);
  }, [uploadedFiles, onFilesChange]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      uploadFiles(files);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = (fileId: string) => {
    removeFile(fileId);
  };

  const handleClearAll = () => {
    clearFiles();
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />
      
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleButtonClick}
        disabled={disabled || isUploading}
        className="flex items-center gap-2"
      >
        {isUploading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Camera className="w-4 h-4" />
        )}
        {language === 'ar' ? 'رفع صورة' : 'Upload Image'}
      </Button>

      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          {uploadedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 p-2 bg-muted rounded-lg border"
            >
              <img
                src={file.publicUrl}
                alt={file.name}
                className="w-12 h-12 object-cover rounded border"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveFile(file.id)}
                className="w-8 h-8 p-0 hover:bg-red-100 hover:text-red-600"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
