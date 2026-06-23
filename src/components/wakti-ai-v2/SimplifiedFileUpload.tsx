import React, { useRef, useState, useEffect } from 'react';
import { Upload, Camera, X, Image, Eye } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { UploadedFile, FileUploadProps } from '@/types/fileUpload';

interface SimplifiedFileUploadProps extends Omit<FileUploadProps, 'maxFiles'> {
  onUpdateFiles: (files: UploadedFile[]) => void;
  onAutoSwitchMode?: (mode: string) => void;
  isStudyMode?: boolean; // Hide Vision-specific UI when in Study mode
}

const imageTypes = [
  { id: 'user_prompt', name: '💬 User Prompt', description: 'Use image as context for my question' },
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
  onAutoSwitchMode,
  isStudyMode = false
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
    return new Promise(async (resolve, reject) => {
      try {
        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const quality = mimeType === 'image/jpeg' ? 0.92 : undefined;

        // Prefer browser-native orientation handling first (safer on iOS/Safari)
        if (typeof createImageBitmap === 'function') {
          try {
            const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (ctx) {
              canvas.width = bitmap.width;
              canvas.height = bitmap.height;
              ctx.drawImage(bitmap, 0, 0);
              if (typeof bitmap.close === 'function') {
                bitmap.close();
              }
              resolve(canvas.toDataURL(mimeType, quality));
              return;
            }

            if (typeof bitmap.close === 'function') {
              bitmap.close();
            }
          } catch {
            // Fall back to explicit EXIF parsing below
          }
        }

        const orientation = await new Promise<number>((res) => {
          if (!file.type.includes('jpeg') && !file.type.includes('jpg') && !file.name.toLowerCase().match(/\.(jpe?g|heic|heif)$/)) {
            res(1);
            return;
          }

          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const view = new DataView(e.target?.result as ArrayBuffer);
              if (view.getUint16(0, false) !== 0xFFD8) {
                res(1);
                return;
              }

              const length = view.byteLength;
              let offset = 2;

              while (offset < length) {
                if (offset + 2 > length) break;
                const marker = view.getUint16(offset, false);
                offset += 2;

                if (marker === 0xFFE1) {
                  if (offset + 8 > length) break;
                  if (view.getUint32(offset + 2, false) !== 0x45786966 || view.getUint16(offset + 6, false) !== 0x0000) {
                    res(1);
                    return;
                  }

                  const tiffOffset = offset + 8;
                  if (tiffOffset + 8 > length) break;
                  const littleEndian = view.getUint16(tiffOffset, false) === 0x4949;
                  const ifdOffset = view.getUint32(tiffOffset + 4, littleEndian) + tiffOffset;
                  if (ifdOffset + 2 > length) break;
                  const tags = view.getUint16(ifdOffset, littleEndian);

                  for (let i = 0; i < tags; i++) {
                    const tagOffset = ifdOffset + 2 + i * 12;
                    if (tagOffset + 12 > length) break;
                    if (view.getUint16(tagOffset, littleEndian) === 0x0112) {
                      res(view.getUint16(tagOffset + 8, littleEndian));
                      return;
                    }
                  }

                  res(1);
                  return;
                }

                if ((marker & 0xFF00) !== 0xFF00) {
                  break;
                }

                if (offset + 2 > length) break;
                offset += view.getUint16(offset, false);
              }

              res(1);
            } catch {
              res(1);
            }
          };
          reader.onerror = () => res(1);
          reader.readAsArrayBuffer(file.slice(0, 65536));
        });

        if (orientation === 1) {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
          return;
        }

        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
          URL.revokeObjectURL(objectUrl);

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          const width = img.width;
          const height = img.height;

          if (orientation >= 5 && orientation <= 8) {
            canvas.width = height;
            canvas.height = width;
          } else {
            canvas.width = width;
            canvas.height = height;
          }

          switch (orientation) {
            case 2: ctx.transform(-1, 0, 0, 1, width, 0); break;
            case 3: ctx.transform(-1, 0, 0, -1, width, height); break;
            case 4: ctx.transform(1, 0, 0, -1, 0, height); break;
            case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
            case 6: ctx.transform(0, 1, -1, 0, height, 0); break;
            case 7: ctx.transform(0, -1, -1, 0, height, width); break;
            case 8: ctx.transform(0, -1, 1, 0, 0, width); break;
            default: break;
          }

          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL(mimeType, quality));
        };

        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
        };

        img.src = objectUrl;
      } catch (error) {
        reject(error);
      }
    });
  };

  const handleFileSelect = async (files: FileList | null, options?: { suppressAutoSwitch?: boolean }) => {
    if (!files || files.length === 0) return;

    const MAX_VISION_IMAGES = 4;
    const existingCount = Array.isArray(uploadedFiles) ? uploadedFiles.length : 0;
    const remainingSlots = Math.max(0, MAX_VISION_IMAGES - existingCount);
    if (remainingSlots <= 0) {
      showError(language === 'ar' ? 'الحد الأقصى للصور هو 4' : 'Max images is 4');
      return;
    }

    console.log('🔄 TRUE CLAUDE WAY: Processing', files.length, 'files as pure base64');
    
    const validFiles: UploadedFile[] = [];
    
    // Helper to check if file is an image (handles iOS empty MIME types)
    const isImageFile = (f: File): boolean => {
      if (f.type.startsWith('image/')) return true;
      // iOS often returns empty type for HEIC/photos - check extension
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tiff', 'svg'].includes(ext);
    };

    const maxToProcess = Math.min(files.length, remainingSlots);
    if (files.length > maxToProcess) {
      showError(language === 'ar' ? 'الحد الأقصى للصور هو 4' : 'Max images is 4');
    }

    for (let i = 0; i < maxToProcess; i++) {
      const file = files[i];
      
      // Validate file type - use helper for iOS compatibility
      if (!isImageFile(file)) {
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
        const uploadedFile: UploadedFile = {
          id: `${Date.now()}-${i}`,
          name: file.name,
          type: file.type,
          size: file.size,
          url: base64DataUrl,           // ✅ PURE BASE64 DATA URL
          preview: base64DataUrl,       // ✅ PURE BASE64 DATA URL  
          base64: base64DataUrl,        // ✅ PURE BASE64 DATA URL
          imageType: imageTypes[0]      // ✅ DEFAULT TO USER PROMPT
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
      // Also skip auto-switch if in Study mode - Study handles images for tutoring
      if (onAutoSwitchMode && !options?.suppressAutoSwitch && !isStudyMode) {
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
        accept="image/*,image/heic,image/heif,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.bmp,.tiff"
        multiple
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
        disabled={disabled}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,image/heic,image/heif,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.bmp,.tiff"
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

          {/* Image Type Selectors - HIDE in Study mode (Study just needs the image, no Vision categories) */}
          {!isStudyMode && (
          <div className="space-y-2">
            {uploadedFiles.map((file, index) => (
              <div key={file.id} className="p-2 bg-background/50 rounded-lg border border-border/50">
                <div className="flex items-center gap-2">
                  <Image className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground/80 min-w-0 flex-shrink-0">
                    {language === 'ar' ? `صورة ${index + 1}` : `Image ${index + 1}`}
                  </span>
                </div>
                <div className="mt-2">
                  <select
                    value={file.imageType?.id || 'user_prompt'}
                    onChange={(e) => {
                      const selectedType = imageTypes.find(type => type.id === e.target.value);
                      if (selectedType) {
                        updateFileImageType(file.id, { id: selectedType.id, name: selectedType.name });
                      }
                    }}
                    dir={language === 'ar' ? 'rtl' : 'ltr'}
                    className="w-full min-w-0 bg-background text-foreground border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 dark:bg-popover dark:text-popover-foreground touch-manipulation pointer-events-auto"
                  >
                    {imageTypes.map((type) => (
                      <option key={type.id} value={type.id} className="bg-background text-foreground dark:bg-popover dark:text-popover-foreground">
                        {language === 'ar' ? (
                          type.id === 'user_prompt' ? '💬 سؤال المستخدم - استخدم الصورة كسياق' :
                          type.id === 'general' ? '🔍 عام - حلل أي شيء' :
                          type.id === 'ids' ? '🆔 هويات ومستندات - استخراج النص والمعلومات' :
                          type.id === 'bills' ? '💰 فواتير وإيصالات - حساب المصاريف' :
                          type.id === 'food' ? '🍕 طعام وتغذية - السعرات والمكونات' :
                          type.id === 'docs' ? '📚 أكاديمي وتقارير - أجب عن الأسئلة' :
                          type.id === 'screens' ? '💻 لقطات الشاشة والأخطاء - تصحيح وإصلاح' :
                          type.id === 'photos' ? '📸 صور وأشخاص - وصف وتعرف' :
                          `${type.name}`
                        ) : (
                          `${type.name} - ${type.description}`
                        )}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
          )}
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
