
import React from 'react';
import { X, Camera } from 'lucide-react';

interface ScreenshotUploadProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ScreenshotUpload: React.FC<ScreenshotUploadProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500 rounded-lg text-white">
              <Camera className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Screenshot AI</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-muted-foreground text-center">
            Screenshot AI feature coming soon...
          </p>
        </div>
      </div>
    </div>
  );
};
