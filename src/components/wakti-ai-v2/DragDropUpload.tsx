
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Image } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/lib/utils';

interface DragDropUploadProps {
  onFilesSelected: (files: FileList) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

export function DragDropUpload({ onFilesSelected, disabled, children }: DragDropUploadProps) {
  const { language } = useTheme();
  const [isDragActive, setIsDragActive] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      // Convert File[] to FileList
      const dt = new DataTransfer();
      acceptedFiles.forEach(file => dt.items.add(file));
      onFilesSelected(dt.files);
    }
    setIsDragActive(false);
  }, [onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive: dropzoneActive } = useDropzone({
    onDrop,
    disabled,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'text/plain': ['.txt']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    noClick: !!children, // Don't trigger click if children are provided
    multiple: true
  });

  if (children) {
    return (
      <div {...getRootProps()} className="w-full h-full">
        <input {...getInputProps()} />
        {children}
        
        {/* Drag Overlay */}
        {(isDragActive || dropzoneActive) && (
          <div className="fixed inset-0 z-50 bg-primary/10 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-background border-2 border-dashed border-primary rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-primary mb-2">
                {language === 'ar' ? 'إفلات الملفات هنا' : 'Drop files here'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {language === 'ar' 
                  ? 'يدعم: الصور، ملفات النص'
                  : 'Supports: Images, Text files'
                }
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
        dropzoneActive || isDragActive
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <input {...getInputProps()} />
      
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Upload className="h-5 w-5" />
          <Image className="h-5 w-5" />
          <FileText className="h-5 w-5" />
        </div>
        
        <div>
          <p className="text-sm font-medium">
            {language === 'ar' 
              ? 'اسحب الملفات هنا أو انقر للتحديد'
              : 'Drag files here or click to select'
            }
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {language === 'ar' 
              ? 'يدعم: الصور، ملفات النص (حد أقصى 10 ميجابايت)'
              : 'Supports: Images, Text files (max 10MB)'
            }
          </p>
        </div>
      </div>
    </div>
  );
}
