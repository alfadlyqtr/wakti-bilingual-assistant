import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, FileType, RotateCcw, Upload, Camera } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { supabase } from '@/integrations/supabase/client';

// Define the structure for image type options
interface ImageTypeOption {
  id: string;
  name: string;
  icon: string;
  description: string;
}

// Predefined image types
const imageTypes: ImageTypeOption[] = [
  {
    id: 'general',
    name: 'General',
    icon: '🖼️',
    description: 'General image with no specific category',
  },
  {
    id: 'ids',
    name: 'IDs / Documents',
    icon: '🆔',
    description: 'Identity cards, passports, and official documents',
  },
  {
    id: 'bills',
    name: 'Bills / Receipts',
    icon: '🧾',
    description: 'Invoices, receipts, and expense tracking',
  },
  {
    id: 'food',
    name: 'Food / Nutrition',
    icon: '🍎',
    description: 'Photos of food for calorie tracking or ingredient analysis',
  },
  {
    id: 'docs',
    name: 'Charts / Reports',
    icon: '📊',
    description: 'Graphs, data visualizations, and business reports',
  },
  {
    id: 'screens',
    name: 'Screenshots / Errors',
    icon: '💻',
    description: 'Application screenshots and error messages',
  },
  {
    id: 'photos',
    name: 'People / Places',
    icon: '🌍',
    description: 'Photos of people, landscapes, and travel destinations',
  },
];

// Define the structure for uploaded files
export interface SimplifiedUploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  preview: string;
  imageType?: ImageTypeOption;
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
  const { showError } = useToastHelper();
  const [showImageTypeSelector, setShowImageTypeSelector] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState<number>(0);

  // Listen for custom event dispatched from PlusMenu
  useEffect(() => {
    const handleFileSelect = (event: any) => {
      if (event.detail && event.detail.files) {
        handleFilesSelected(Array.from(event.detail.files));
      }
    };

    window.addEventListener('wakti-file-selected', handleFileSelect);

    return () => {
      window.removeEventListener('wakti-file-selected', handleFileSelect);
    };
  }, []);

  // Convert file to base64 for preview
  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Handle file selection and convert to SimplifiedUploadedFile format
  async function handleFilesSelected(files: File[]) {
    if (!files || files.length === 0) {
      console.log('No files selected');
      return;
    }

    const newFiles: SimplifiedUploadedFile[] = [];

    for (const file of files) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        showError(language === 'ar' ? 'الملف كبير جداً. الحد الأقصى هو 10 ميجابايت.' : 'File is too large. Max size is 10MB.');
        continue; // Skip to the next file
      }

      try {
        const base64String = await convertToBase64(file);
        const newFile: SimplifiedUploadedFile = {
          id: Math.random().toString(36).substring(7), // Generate a unique ID
          name: file.name,
          size: file.size,
          type: file.type,
          url: base64String,
          preview: base64String,
        };
        newFiles.push(newFile);

        // Auto-switch mode based on file type
        if (onAutoSwitchMode) {
          if (file.type.startsWith('image/')) {
            onAutoSwitchMode('vision');
          } else if (file.type.startsWith('video/')) {
            onAutoSwitchMode('video');
          }
        }
      } catch (error) {
        console.error('Error converting file to base64:', error);
        showError(language === 'ar' ? 'فشل في معالجة الملف.' : 'Failed to process file.');
      }
    }

    // Update the state with the new files
    if (newFiles.length > 0) {
      const updatedFiles = [...uploadedFiles, ...newFiles];
      onUpdateFiles(updatedFiles);
      onFilesUploaded(updatedFiles);
      console.log('✅ UPLOAD: Files uploaded successfully', { count: updatedFiles.length });
    }
  }

  // Handle image type change
  const handleImageTypeChange = (fileId: string | undefined, imageType: ImageTypeOption) => {
    if (!fileId) {
      console.warn('No file ID provided for image type change.');
      return;
    }

    const updatedFiles = uploadedFiles.map(file => {
      if (file.id === fileId) {
        return { ...file, imageType: imageType };
      }
      return file;
    });

    onUpdateFiles(updatedFiles);
    setShowImageTypeSelector(false);
    console.log('🖼️ IMAGE TYPE: Updated image type', { fileId, imageType });
  };

  // Reset image type to default
  const resetImageType = (fileId: string) => {
    const updatedFiles = uploadedFiles.map(file => {
      if (file.id === fileId) {
        return { ...file, imageType: undefined };
      }
      return file;
    });

    onUpdateFiles(updatedFiles);
    console.log('🔄 IMAGE TYPE: Reset image type', { fileId });
  };

  return (
    <>
      {/* Files Grid - Only show if files exist */}
      {uploadedFiles.length > 0 && (
        <div className="px-3 pb-2">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {uploadedFiles.map((file, index) => (
                <div key={file.id} className="relative group">
                  <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600">
                    <img
                      src={file.preview || file.url}
                      alt={file.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error('Image load error:', e);
                        e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIxIDEyQzIxIDEyLjU1MjMgMjAuNTUyMyAxMyAyMCAxM0M0LjQgMTMgNCAxMi41NTIzIDQgMTJDNCA2LjQ3NzE1IDguNDc3MTUgMiAxNCAyQzE5LjUyMjggMiAyNCA2LjQ3NzE1IDI0IDEyWiIgZmlsbD0iI0Y5RkFGQiIvPgo8L3N2Zz4K';
                      }}
                    />
                  </div>

                  {/* File Controls */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-200 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex gap-1">
                      <Button
                        onClick={() => {
                          setCurrentFileIndex(index);
                          setShowImageTypeSelector(true);
                        }}
                        size="sm"
                        className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm h-8 w-8 p-0"
                        disabled={disabled || isUploading}
                      >
                        <FileType className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => onRemoveFile(file.id)}
                        size="sm"
                        className="bg-red-500/80 hover:bg-red-600/80 text-white border-0 backdrop-blur-sm h-8 w-8 p-0"
                        disabled={disabled || isUploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Image Type Badge */}
                  <div className="absolute bottom-1 left-1 right-1">
                    <div className="bg-black/70 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm">
                      <div className="flex items-center gap-1">
                        <span>{file.imageType?.name || 'General'}</span>
                        {file.imageType?.id !== 'general' && (
                          <Button
                            onClick={() => resetImageType(file.id)}
                            className="p-0 h-4 w-4 bg-transparent hover:bg-white/20 text-white border-0"
                            disabled={disabled || isUploading}
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* File Size */}
                  <div className="absolute top-1 right-1">
                    <div className="bg-black/70 text-white text-xs px-1.5 py-0.5 rounded backdrop-blur-sm">
                      {(file.size / 1024).toFixed(0)}KB
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Image Type Selector Modal */}
      {showImageTypeSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {language === 'ar' ? 'نوع الصورة' : 'Image Type'}
              </h3>
              <Button
                onClick={() => setShowImageTypeSelector(false)}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              {imageTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleImageTypeChange(uploadedFiles[currentFileIndex]?.id, type)}
                  className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{type.icon}</span>
                    <div>
                      <div className="font-medium">{type.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {type.description}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
