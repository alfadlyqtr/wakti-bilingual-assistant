
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Viewport-fixed positioning via portal to avoid clipping by parent overflow
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const computeViewportPos = (): { top: number; left: number } | null => {
    const el = (triggerRef.current as unknown as HTMLElement) || menuRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const menuWidth = 160;
    const padding = 8;
    const offsetX = -140; // move menu much further left so it sits closer to/inside the text area
    const left = language === 'ar'
      ? Math.max(padding, Math.min(window.innerWidth - menuWidth - padding, rect.right - menuWidth + offsetX))
      : Math.max(padding, Math.min(window.innerWidth - menuWidth - padding, rect.left + offsetX));
    const top = Math.min(window.innerHeight - 200, rect.bottom + 8);
    return { top, left };
  };

  const handleToggle = () => {
    if (isLoading) return;
    if (!isOpen) {
      const pos = computeViewportPos();
      if (pos) setMenuPos(pos);
      setIsOpen(true);
      // Recompute after paint for safety
      requestAnimationFrame(() => {
        const pos2 = computeViewportPos();
        if (pos2) setMenuPos(pos2);
      });
    } else {
      setIsOpen(false);
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

  // Keep menu anchored on scroll/resize when open
  useEffect(() => {
    if (!isOpen) return;
    const onUpd = () => {
      const pos = computeViewportPos();
      if (pos) setMenuPos(pos);
    };
    window.addEventListener('scroll', onUpd, true);
    window.addEventListener('resize', onUpd);
    onUpd();
    return () => {
      window.removeEventListener('scroll', onUpd, true);
      window.removeEventListener('resize', onUpd);
    };
  }, [isOpen, language]);

  // Close on global overlay close events to avoid stuck full-screen overlay
  useEffect(() => {
    const closeAll = () => setIsOpen(false);
    window.addEventListener('wakti-close-all-overlays', closeAll as EventListener);
    return () => window.removeEventListener('wakti-close-all-overlays', closeAll as EventListener);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      {/* Main Plus Button */}
      <Button
        ref={triggerRef}
        onPointerUp={(e) => { e.preventDefault(); e.stopPropagation(); handleToggle(); }}
        disabled={isLoading}
        className={cn(
          "h-9 w-9 rounded-2xl p-0 transition-all duration-200 touch-manipulation",
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

      {/* Dropdown Menu via portal (position: fixed) */}
      {isOpen && menuPos && createPortal(
        <div 
          className={cn(
            "fixed z-[9999] min-w-[160px] max-w-[80vw]",
            "bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl",
            "border border-white/20 dark:border-white/10",
            "rounded-2xl shadow-2xl dark:shadow-2xl",
            "shadow-black/10 dark:shadow-black/40",
            "animate-in fade-in-0 zoom-in-95 duration-200"
          )}
          style={{ top: menuPos.top, left: menuPos.left }}
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
        </div>,
        document.body
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[700]" 
          onPointerUp={() => setIsOpen(false)}
        />
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,image/heic,image/heif,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.bmp,.tiff,.txt"
        onChange={handleFileSelect}
        className="hidden"
        aria-hidden="true"
        title={language === 'ar' ? 'تحميل ملف' : 'Upload file'}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,image/heic,image/heif,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.bmp,.tiff"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
        aria-hidden="true"
        title={language === 'ar' ? 'التقاط صورة' : 'Capture photo'}
      />
    </div>
  );
}
