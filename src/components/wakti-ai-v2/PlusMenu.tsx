
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Camera, Upload } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/lib/utils';

interface PlusMenuProps {
  onCamera: () => void;
  onUpload: () => void;
  isLoading?: boolean;
}

export function PlusMenu({ onCamera, onUpload, isLoading }: PlusMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { language } = useTheme();
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleToggle = () => {
    if (!isLoading) {
      setIsOpen(!isOpen);
    }
  };

  const handleCamera = () => {
    cameraInputRef.current?.click();
    setIsOpen(false);
  };

  const handleUpload = () => {
    fileInputRef.current?.click();
    setIsOpen(false);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      // Dispatch custom event to SimplifiedFileUpload
      const customEvent = new CustomEvent('wakti-file-selected', { 
        detail: { files } 
      });
      window.dispatchEvent(customEvent);
    }
    // Reset the input value so the same file can be selected again
    if (event.target) {
      event.target.value = '';
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Main Plus Button */}
      <Button
        onClick={handleToggle}
        disabled={isLoading}
        className={cn(
          "h-9 w-9 rounded-2xl p-0 transition-all duration-200",
          "bg-white/20 dark:bg-white/15 hover:bg-white/30 dark:hover:bg-white/25",
          "border-2 border-white/30 dark:border-white/40 hover:border-white/50 dark:hover:border-white/60",
          "shadow-lg dark:shadow-xl shadow-black/10 dark:shadow-black/30",
          "hover:scale-105 active:scale-95",
          isOpen && "bg-white/40 dark:bg-white/30 border-white/60 dark:border-white/70"
        )}
      >
        <Plus 
          className={cn(
            "h-5 w-5 transition-all duration-200",
            "text-gray-700 dark:text-white",
            isOpen && "rotate-45"
          )} 
        />
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className={cn(
            // Anchor based on language: RTL -> right edge with stronger leftward shift (responsive) to avoid clipping, LTR -> left edge
            `absolute ${language === 'ar' ? 'right-0 translate-x-[-56px] sm:translate-x-[-40px]' : 'left-0'} top-12 z-50 min-w-[140px] max-w-[80vw]`,
            "bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl",
            "border border-white/20 dark:border-white/10",
            "rounded-2xl shadow-2xl dark:shadow-2xl",
            "shadow-black/10 dark:shadow-black/40",
            "animate-in fade-in-0 zoom-in-95 duration-200"
          )}
        >
          <div className="p-2 space-y-1">
            <button
              onClick={handleCamera}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-all duration-200",
                "hover:bg-blue-50 dark:hover:bg-blue-900/30",
                "text-gray-700 dark:text-gray-200 hover:text-blue-700 dark:hover:text-blue-300",
                "border border-transparent hover:border-blue-200/50 dark:hover:border-blue-700/50"
              )}
            >
              <Camera className="h-4 w-4" />
              <span className="font-medium">
                {language === 'ar' ? 'كاميرا' : 'Camera'}
              </span>
            </button>
            
            <button
              onClick={handleUpload}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-all duration-200",
                "hover:bg-green-50 dark:hover:bg-green-900/30",
                "text-gray-700 dark:text-gray-200 hover:text-green-700 dark:hover:text-green-300",
                "border border-transparent hover:border-green-200/50 dark:hover:border-green-700/50"
              )}
            >
              <Upload className="h-4 w-4" />
              <span className="font-medium">
                {language === 'ar' ? 'تحميل' : 'Upload'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.txt"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
