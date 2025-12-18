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

/**
 * Read EXIF orientation from a File (JPEG/HEIC).
 * Returns orientation 1-8, or 1 if not found/unsupported.
 */
const getExifOrientation = (file: File): Promise<number> => {
  return new Promise((resolve) => {
    // PNG screenshots and other non-JPEG files don't have EXIF - return 1 immediately
    if (!file.type.includes('jpeg') && !file.type.includes('jpg') && !file.name.toLowerCase().match(/\.(jpe?g|heic|heif)$/)) {
      console.log('📷 Non-JPEG file, skipping EXIF check:', file.name, file.type);
      resolve(1);
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const view = new DataView(e.target?.result as ArrayBuffer);
      // Check for JPEG SOI marker
      if (view.getUint16(0, false) !== 0xFFD8) {
        resolve(1);
        return;
      }
      const length = view.byteLength;
      let offset = 2;
      while (offset < length) {
        if (offset + 2 > length) break;
        const marker = view.getUint16(offset, false);
        offset += 2;
        // APP1 marker (EXIF)
        if (marker === 0xFFE1) {
          if (offset + 2 > length) break;
          const exifLength = view.getUint16(offset, false);
          // Check for "Exif\0\0"
          if (offset + 8 > length) break;
          if (view.getUint32(offset + 2, false) !== 0x45786966 || view.getUint16(offset + 6, false) !== 0x0000) {
            resolve(1);
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
              // Orientation tag
              resolve(view.getUint16(tagOffset + 8, littleEndian));
              return;
            }
          }
          resolve(1);
          return;
        } else if ((marker & 0xFF00) !== 0xFF00) {
          break;
        } else {
          if (offset + 2 > length) break;
          offset += view.getUint16(offset, false);
        }
      }
      resolve(1);
    };
    reader.onerror = () => resolve(1);
    // Only read first 64KB for EXIF (enough for header)
    reader.readAsArrayBuffer(file.slice(0, 65536));
  });
};

/**
 * Normalize image orientation based on EXIF and return a corrected base64 data URL.
 * This ensures mobile photos are upright before sending to image generation APIs.
 */
const normalizeImageOrientation = (file: File): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    try {
      const orientation = await getExifOrientation(file);
      
      // If orientation is 1 (normal) or unsupported format, just return raw base64
      if (orientation === 1) {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      // Load image and apply rotation/flip based on EXIF orientation
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

        let width = img.width;
        let height = img.height;

        // Orientations 5-8 swap width/height
        if (orientation >= 5 && orientation <= 8) {
          canvas.width = height;
          canvas.height = width;
        } else {
          canvas.width = width;
          canvas.height = height;
        }

        // Apply transforms based on orientation
        // See: https://sirv.com/help/articles/rotate-photos-to-be-upright/
        switch (orientation) {
          case 2: ctx.transform(-1, 0, 0, 1, width, 0); break; // flip horizontal
          case 3: ctx.transform(-1, 0, 0, -1, width, height); break; // rotate 180
          case 4: ctx.transform(1, 0, 0, -1, 0, height); break; // flip vertical
          case 5: ctx.transform(0, 1, 1, 0, 0, 0); break; // transpose
          case 6: ctx.transform(0, 1, -1, 0, height, 0); break; // rotate 90 CW
          case 7: ctx.transform(0, -1, -1, 0, height, width); break; // transverse
          case 8: ctx.transform(0, -1, 1, 0, 0, width); break; // rotate 90 CCW
          default: break;
        }

        ctx.drawImage(img, 0, 0);
        
        // Export as same type if possible, fallback to JPEG
        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const quality = mimeType === 'image/jpeg' ? 0.92 : undefined;
        const dataUrl = canvas.toDataURL(mimeType, quality);
        
        console.log(`📐 EXIF: Normalized orientation ${orientation} → upright`);
        resolve(dataUrl);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        // HEIC/HEIF images can't be loaded by Image() in most browsers
        // Fall back to raw FileReader for unsupported formats
        console.warn('Image load failed (possibly HEIC), falling back to raw base64');
        const fallbackReader = new FileReader();
        fallbackReader.onload = () => resolve(fallbackReader.result as string);
        fallbackReader.onerror = () => reject(new Error('Failed to load image'));
        fallbackReader.readAsDataURL(file);
      };

      img.src = objectUrl;
    } catch (err) {
      reject(err);
    }
  });
};

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

    // Helper to check if file is an image (handles iOS empty MIME types)
    const isImageFile = (f: File): boolean => {
      if (f.type.startsWith('image/')) return true;
      // iOS often returns empty type for HEIC/photos - check extension
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tiff', 'svg'].includes(ext);
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      console.log('📁 Processing file:', file.name, 'type:', file.type, 'size:', file.size);
      
      if (!isImageFile(file)) {
        console.warn('❌ File rejected - not an image:', file.name, file.type);
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
        // Use orientation-normalized base64 to fix sideways mobile photos
        const base64 = await normalizeImageOrientation(file);
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
    console.log('📥 File input triggered, files:', e.target.files?.length || 0);
    if (e.target.files) {
      for (let i = 0; i < e.target.files.length; i++) {
        console.log('📥 Raw file from input:', e.target.files[i].name, 'type:', e.target.files[i].type, 'size:', e.target.files[i].size);
      }
    }
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
        accept="image/*,image/heic,image/heif,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.bmp"
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
