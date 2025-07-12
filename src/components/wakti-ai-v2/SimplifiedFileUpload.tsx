
import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Camera, X, FileImage, Eye, FileText, Receipt, Utensils, Monitor, User, Image } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';

export interface SimplifiedUploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  preview?: string;
  imageType?: {
    id: string;
    name: string;
  };
}

interface SimplifiedFileUploadProps {
  onFilesUploaded: (files: SimplifiedUploadedFile[]) => void;
  onUpdateFiles: (files: SimplifiedUploadedFile[]) => void;
  uploadedFiles: SimplifiedUploadedFile[];
  onRemoveFile: (fileId: string) => void;
  isUploading: boolean;
  disabled?: boolean;
  onAutoSwitchMode?: (mode: string) => void;
}

export function SimplifiedFileUpload({
  onFilesUploaded,
  onUpdateFiles,
  uploadedFiles,
  onRemoveFile,
  isUploading,
  disabled = false,
  onAutoSwitchMode
}: SimplifiedFileUploadProps) {
  const { language } = useTheme();
  const { showSuccess, showError } = useToastHelper();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Image type categories for vision mode
  const imageTypes = [
    { id: 'general', name: language === 'ar' ? 'عام' : 'General', icon: Image },
    { id: 'ids', name: language === 'ar' ? 'هويات ووثائق' : 'IDs & Documents', icon: FileText },
    { id: 'bills', name: language === 'ar' ? 'فواتير وإيصالات' : 'Bills & Receipts', icon: Receipt },
    { id: 'food', name: language === 'ar' ? 'طعام وشراب' : 'Food & Drinks', icon: Utensils },
    { id: 'docs', name: language === 'ar' ? 'مستندات وتقارير' : 'Documents & Reports', icon: FileImage },
    { id: 'screens', name: language === 'ar' ? 'لقطات شاشة' : 'Screenshots', icon: Monitor },
    { id: 'photos', name: language === 'ar' ? 'صور شخصية' : 'Personal Photos', icon: User }
  ];

  // Convert file to base64
  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Handle file selection
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    try {
      const newFiles: SimplifiedUploadedFile[] = [];
      
      for (let i = 0; i < Math.min(files.length, 5); i++) { // Max 5 files
        const file = files[i];
        
        if (!file.type.startsWith('image/')) {
          showError(`${file.name} ${language === 'ar' ? 'ليس ملف صورة صالح' : 'is not a valid image file'}`);
          continue;
        }
        
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
          showError(`${file.name} ${language === 'ar' ? 'كبير جداً (أقصى حد 5 ميجابايت)' : 'is too large (max 5MB)'}`);
          continue;
        }

        const base64 = await convertToBase64(file);
        const uploadedFile: SimplifiedUploadedFile = {
          id: `${Date.now()}-${i}`,
          name: file.name,
          type: file.type,
          size: file.size,
          url: base64,
          preview: base64,
          imageType: imageTypes[0] // Default to general
        };
        
        newFiles.push(uploadedFile);
      }
      
      onFilesUploaded(newFiles);
      showSuccess(`${newFiles.length} ${language === 'ar' ? 'صور تم تحميلها' : 'images uploaded'}`);
      
      // Auto-switch to vision mode when images are uploaded
      if (newFiles.length > 0 && onAutoSwitchMode) {
        onAutoSwitchMode('vision');
      }
      
    } catch (error) {
      console.error('Upload error:', error);
      showError(language === 'ar' ? 'فشل في تحميل الصور' : 'Failed to upload images');
    }
  };

  // Update file image type
  const updateFileImageType = (fileId: string, imageType: { id: string; name: string }) => {
    const updatedFiles = uploadedFiles.map(file => 
      file.id === fileId ? { ...file, imageType } : file
    );
    onUpdateFiles(updatedFiles);
  };

  return (
    <div className="space-y-4">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
      />

      {/* Upload buttons for vision mode */}
      {uploadedFiles.length === 0 && (
        <div className="flex gap-2 justify-center">
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
          >
            <Upload className="h-4 w-4" />
            {language === 'ar' ? 'رفع صور' : 'Upload Images'}
          </Button>
          <Button
            onClick={() => cameraInputRef.current?.click()}
            disabled={disabled || isUploading}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
          >
            <Camera className="h-4 w-4" />
            {language === 'ar' ? 'كاميرا' : 'Camera'}
          </Button>
        </div>
      )}

      {/* Uploaded files display */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="grid gap-3">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-3">
                  {/* Image preview */}
                  <div className="relative flex-shrink-0">
                    <img 
                      src={file.preview || file.url} 
                      className="w-16 h-16 object-cover rounded-lg border" 
                      alt={file.name}
                    />
                    <button 
                      onClick={() => onRemoveFile(file.id)} 
                      className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs transition-colors"
                      title={language === 'ar' ? 'حذف الملف' : 'Remove file'}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  
                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>

                {/* Image type selector for vision mode */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {language === 'ar' ? 'نوع الصورة:' : 'Image Type:'}
                  </label>
                  <select
                    value={file.imageType?.id || 'general'}
                    onChange={(e) => {
                      const selectedType = imageTypes.find(type => type.id === e.target.value);
                      if (selectedType) {
                        updateFileImageType(file.id, selectedType);
                      }
                    }}
                    className="w-full text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {imageTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* Add more files button */}
          {uploadedFiles.length < 5 && (
            <div className="flex gap-2 justify-center">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isUploading}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <Upload className="h-4 w-4" />
                {language === 'ar' ? 'إضافة المزيد' : 'Add More'}
              </Button>
              <Button
                onClick={() => cameraInputRef.current?.click()}
                disabled={disabled || isUploading}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 text-green-600 border-green-200 hover:bg-green-50"
              >
                <Camera className="h-4 w-4" />
                {language === 'ar' ? 'كاميرا' : 'Camera'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Loading state */}
      {isUploading && (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          {language === 'ar' ? 'جاري الرفع...' : 'Uploading...'}
        </div>
      )}
    </div>
  );
}
