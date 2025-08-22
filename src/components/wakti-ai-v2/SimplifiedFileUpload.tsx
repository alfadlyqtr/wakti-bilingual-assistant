import React, { useRef, useState, useEffect } from 'react';
import { Upload, Camera, X, Image, Eye } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { useToastHelper } from '@/hooks/use-toast-helper';

export interface SimplifiedUploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  preview?: string;
  base64?: string;
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

const imageTypes = [
  { id: 'general', name: '🔍 General', description: 'Analyze anything' },
  { id: 'ids', name: '🆔 IDs & Documents', description: 'Extract text and info' },
  { id: 'bills', name: '💰 Bills & Receipts', description: 'Calculate expenses' },
  { id: 'food', name: '🍕 Food & Nutrition', description: 'Calories and ingredients' },
  { id: 'docs', name: '📚 Academic & Reports', description: 'Answer questions' },
  { id: 'screens', name: '💻 Screenshots & Errors', description: 'Debug and fix' },
  { id: 'photos', name: '📸 Photos & People', description: 'Describe and identify' }
];

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Event listener for wakti-file-selected event from PlusMenu or Image seed upload
  useEffect(() => {
    const handleWaktiFileSelected = (evt: Event) => {
      const event = evt as CustomEvent<{ files: FileList | null; suppressAutoSwitch?: boolean }>;
      const { files, suppressAutoSwitch } = event.detail || { files: null, suppressAutoSwitch: false };
      if (files && (files as FileList).length > 0) {
        console.log('📁 SimplifiedFileUpload: Received files from PlusMenu/Seed:', (files as FileList).length, 'suppressAutoSwitch:', !!suppressAutoSwitch);
        handleFileSelect(files, { suppressAutoSwitch });
      }
    };

    window.addEventListener('wakti-file-selected', handleWaktiFileSelected as EventListener);
    
    return () => {
      window.removeEventListener('wakti-file-selected', handleWaktiFileSelected as EventListener);
    };
  }, []);

  // Convert File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result); // Return full data URL
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileSelect = async (files: FileList | null, options?: { suppressAutoSwitch?: boolean }) => {
    if (!files || files.length === 0) return;
    
    console.log('🔄 TRUE CLAUDE WAY: Processing', files.length, 'files as pure base64');
    
    const validFiles: SimplifiedUploadedFile[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showError(`${file.name} ${language === 'ar' ? 'ليس ملف صورة صالح' : 'is not a valid image file'}`);
        continue;
      }
      
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        showError(`${file.name} ${language === 'ar' ? 'كبير جداً (أقصى حد 5 ميجابايت)' : 'is too large (max 5MB)'}`);
        continue;
      }
      
      try {
        // TRUE CLAUDE WAY: Convert to base64 data URL
        const base64DataUrl = await fileToBase64(file);
        
        console.log('✅ CLAUDE WAY: Pure base64 data URL created for', file.name);
        
        // PURE BASE64 PROCESSING - TRUE CLAUDE WAY
        const uploadedFile: SimplifiedUploadedFile = {
          id: `${Date.now()}-${i}`,
          name: file.name,
          type: file.type,
          size: file.size,
          url: base64DataUrl,           // ✅ PURE BASE64 DATA URL
          preview: base64DataUrl,       // ✅ PURE BASE64 DATA URL  
          base64: base64DataUrl,        // ✅ PURE BASE64 DATA URL
          imageType: imageTypes[0]      // ✅ DEFAULT TO GENERAL
        };
        
        validFiles.push(uploadedFile);
        console.log('📄 CLAUDE WAY File processed:', {
          name: file.name,
          size: file.size,
          type: file.type,
          hasBase64DataUrl: !!base64DataUrl,
          imageType: imageTypes[0].name
        });
      } catch (error) {
        console.error('❌ Error processing file:', file.name, error);
        showError(`${language === 'ar' ? 'فشل في معالجة' : 'Failed to process'} ${file.name}`);
      }
    }
    
    if (validFiles.length > 0) {
      console.log('✅ TRUE CLAUDE WAY SUCCESS: Successfully processed', validFiles.length, 'files as pure base64');
      onFilesUploaded(validFiles);
      
      // Auto-switch to vision mode when images are uploaded, unless suppressed (e.g., Image mode seed upload)
      if (onAutoSwitchMode && !options?.suppressAutoSwitch) {
        console.log('🔄 Auto-switching to vision mode');
        onAutoSwitchMode('vision');
      }
    }
  };

  const updateFileImageType = (fileId: string, imageType: { id: string; name: string }) => {
    const updatedFiles = uploadedFiles.map(file => 
      file.id === fileId ? { ...file, imageType } : file
    );
    onUpdateFiles(updatedFiles);
    console.log('🏷️ Image type updated:', imageType.name, 'for file:', fileId);
  };

  const triggerFileInput = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  const triggerCameraInput = () => {
    if (disabled) return;
    cameraInputRef.current?.click();
  };

  return (
    <div className="w-full">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
        disabled={disabled}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
        disabled={disabled}
      />

      {/* Uploaded Files Display */}
      {uploadedFiles.length > 0 && (
        <div className="px-3 pb-3 space-y-3">
          {/* File Previews */}
          <div className="flex flex-wrap gap-2">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="relative group">
                <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-primary/30 bg-background">
                  <img
                    src={file.url}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  onClick={() => onRemoveFile(file.id)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-destructive hover:bg-destructive/80 text-destructive-foreground rounded-full flex items-center justify-center text-xs transition-colors"
                  title={language === 'ar' ? 'حذف الصورة' : 'Remove image'}
                >
                  <X className="h-3 w-3" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-1 py-0.5 rounded-b-lg">
                  {(file.size / 1024).toFixed(0)}KB
                </div>
              </div>
            ))}
          </div>

          {/* Image Type Selectors */}
          <div className="space-y-2">
            {uploadedFiles.map((file, index) => (
              <div key={file.id} className="flex items-center gap-2 p-2 bg-background/50 rounded-lg border border-border/50">
                <Image className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground/80 min-w-0 flex-shrink-0">
                  {language === 'ar' ? `صورة ${index + 1}` : `Image ${index + 1}`}
                </span>
                <select
                  value={file.imageType?.id || 'general'}
                  onChange={(e) => {
                    const selectedType = imageTypes.find(type => type.id === e.target.value);
                    if (selectedType) {
                      updateFileImageType(file.id, { id: selectedType.id, name: selectedType.name });
                    }
                  }}
                  className="flex-1 bg-background text-foreground border border-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 dark:bg-popover dark:text-popover-foreground"
                >
                  {imageTypes.map((type) => (
                    <option key={type.id} value={type.id} className="bg-background text-foreground dark:bg-popover dark:text-popover-foreground">
                      {type.name} - {type.description}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isUploading && (
        <div className="px-3 pb-2">
          <div className="h-1 bg-background/20 rounded-full overflow-hidden">
            <div className="h-full bg-primary animate-pulse rounded-full"></div>
          </div>
          <p className="text-xs text-center text-foreground/60 mt-1">
            {language === 'ar' ? 'جاري المعالجة...' : 'Processing...'}
          </p>
        </div>
      )}
    </div>
  );
}
