
import React, { useRef } from 'react';
import { Upload, X, Image } from 'lucide-react';
import { toast } from 'sonner';

interface ImageUploaderProps {
  onImagesUpload: (files: File[]) => void;
  uploadedImages: File[];
  onRemoveImage: (index: number) => void;
  maxImages?: number;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImagesUpload,
  uploadedImages,
  onRemoveImage,
  maxImages = 5,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // Validate files
    const validFiles = files.filter(file => {
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      const maxSize = 5 * 1024 * 1024; // 5MB
      
      if (!validTypes.includes(file.type)) {
        toast.error(`${file.name}: Only PNG, JPG, JPEG, and WebP files are allowed`);
        return false;
      }
      
      if (file.size > maxSize) {
        toast.error(`${file.name}: File size must be less than 5MB`);
        return false;
      }
      
      return true;
    });

    if (validFiles.length === 0) return;

    const totalFiles = uploadedImages.length + validFiles.length;
    if (totalFiles > maxImages) {
      toast.error(`You can only upload up to ${maxImages} images`);
      return;
    }

    onImagesUpload([...uploadedImages, ...validFiles]);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        onClick={triggerFileSelect}
        className="border-2 border-dashed border-border hover:border-primary/50 rounded-lg p-8 text-center cursor-pointer transition-colors bg-muted/30 hover:bg-muted/50"
      >
        <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-foreground font-medium mb-1">Tap to upload images</p>
        <p className="text-sm text-muted-foreground">
          PNG, JPG, JPEG, WebP • Max 5MB each • Up to {maxImages} images
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Uploaded Images Grid */}
      {uploadedImages.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {uploadedImages.map((file, index) => (
            <div key={index} className="relative group">
              <div className="aspect-square bg-muted rounded-lg overflow-hidden border border-border">
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                onClick={() => onRemoveImage(index)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              >
                <X className="w-3 h-3" />
              </button>
              <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                {Math.round(file.size / 1024)}KB
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Progress */}
      {uploadedImages.length > 0 && (
        <div className="text-sm text-muted-foreground">
          {uploadedImages.length} of {maxImages} images uploaded
        </div>
      )}
    </div>
  );
};
