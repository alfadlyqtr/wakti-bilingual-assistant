import React from 'react';
import { ArrowLeft, Camera } from 'lucide-react';

interface ScannerOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  isRTL: boolean;
}

export function ScannerOverlay({ isOpen, onClose, isRTL }: ScannerOverlayProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Camera Feed Container */}
      <div className="relative w-full h-full">
        {/* Scanner Frame */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="relative w-full max-w-[500px] aspect-[3/4]">
            {/* Scanner Border with Cutout */}
            <div className="scanner-frame absolute inset-0 rounded-2xl">
              {/* Corner Markers */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-2xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-2xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-2xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-2xl" />
            </div>
            
            {/* Scanning Line Animation */}
            <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-scan" />
          </div>
        </div>

        {/* Controls */}
        <div className="absolute bottom-0 inset-x-0 p-8 flex items-center justify-between">
          <button
            onClick={onClose}
            className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            aria-label={isRTL ? 'رجوع' : 'Back'}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div className="text-white text-sm font-medium">
            {isRTL ? 'ضع المستند داخل الإطار' : 'Position document within frame'}
          </div>
          
          <button
            onClick={() => {
              // Trigger the hidden file input
              const input = document.querySelector('input[capture="environment"]') as HTMLInputElement;
              if (input) {
                // Try to trigger haptic feedback if available
                if ('vibrate' in navigator) {
                  navigator.vibrate(50);
                }
                input.click();
              }
            }}
            className="w-16 h-16 rounded-full bg-white flex items-center justify-center hover:bg-blue-50 active:scale-95 transition-all"
            aria-label={isRTL ? 'التقاط صورة' : 'Take Photo'}
          >
            <div className="w-14 h-14 rounded-full border-4 border-blue-500 flex items-center justify-center">
              <Camera className="w-8 h-8 text-blue-500" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
