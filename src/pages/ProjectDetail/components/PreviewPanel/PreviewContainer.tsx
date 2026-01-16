import React, { Suspense, lazy } from 'react';
import { Monitor, Tablet, Smartphone, Sparkles, Loader2, MousePointer2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { MatrixOverlay } from '@/components/projects/MatrixOverlay';
import { SandpackSkeleton } from './SandpackSkeleton';

// Lazy load SandpackStudio
const SandpackStudio = lazy(() => import('@/components/projects/SandpackStudio'));

interface SelectedElementInfo {
  tagName: string;
  className: string;
  id: string;
  innerText: string;
  openingTag: string;
  computedStyle?: {
    color: string;
    backgroundColor: string;
    fontSize: string;
  };
}

interface PreviewContainerProps {
  // Content
  codeContent: string;
  generatedFiles: Record<string, string>;
  sandpackKey: number;
  
  // State
  deviceView: 'desktop' | 'tablet' | 'mobile';
  elementSelectMode: boolean;
  isGenerating: boolean;
  aiEditing: boolean;
  leftPanelMode: 'chat' | 'code';
  
  // Selected element
  selectedElementInfo: SelectedElementInfo | null;
  showElementEditPopover: boolean;
  
  // Handlers
  onDeviceViewChange: (view: 'desktop' | 'tablet' | 'mobile') => void;
  onRefresh: () => void;
  onDownload: () => void;
  onPublish: () => void;
  onRuntimeError: (error: string) => void;
  onElementSelect: (ref: string, info?: SelectedElementInfo) => void;
  onCloseElementSelectMode: () => void;
  onShowEditPopover: () => void;
  onDismissSelectedElement: () => void;
  
  // Publishing
  publishing: boolean;
  isRTL: boolean;
}

export function PreviewContainer({
  codeContent,
  generatedFiles,
  sandpackKey,
  deviceView,
  elementSelectMode,
  isGenerating,
  aiEditing,
  leftPanelMode,
  selectedElementInfo,
  showElementEditPopover,
  onDeviceViewChange,
  onRefresh,
  onDownload,
  onPublish,
  onRuntimeError,
  onElementSelect,
  onCloseElementSelectMode,
  onShowEditPopover,
  onDismissSelectedElement,
  publishing,
  isRTL,
}: PreviewContainerProps) {
  const hasContent = codeContent || Object.keys(generatedFiles).length > 0;

  return (
    <div className="flex-1 min-h-0 sandpack-preview-container relative pt-[70px] md:pt-[112px] pb-0 overflow-hidden">
      <Suspense fallback={<SandpackSkeleton isRTL={isRTL} />}>
        {hasContent ? (
          <div className="w-full h-full flex items-center justify-center relative">
            <MatrixOverlay isVisible={aiEditing && leftPanelMode === 'code'} />
            <motion.div 
              layout
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className={cn(
                "h-full w-full transition-all flex flex-col overflow-hidden",
                deviceView === 'desktop' && "max-w-full",
                deviceView === 'tablet' && "max-w-[768px]",
                deviceView === 'mobile' && "max-w-[390px]"
              )}
            >
              <SandpackStudio 
                key={`sandpack-studio-${sandpackKey}`}
                files={Object.keys(generatedFiles).length > 0 ? generatedFiles : { "/App.js": codeContent || "" }}
                onRuntimeError={onRuntimeError}
                elementSelectMode={elementSelectMode}
                isLoading={isGenerating}
                deviceView={deviceView}
                onDeviceViewChange={onDeviceViewChange}
                onRefresh={onRefresh}
                onDownload={onDownload}
                onPublish={onPublish}
                isPublishing={publishing}
                onElementSelect={(ref, elementInfo) => {
                  onElementSelect(ref, elementInfo);
                }}
                isRTL={isRTL}
              />
            </motion.div>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full h-full flex items-center justify-center bg-zinc-950 text-white"
          >
            <div className="text-center space-y-4">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="w-10 h-10 text-amber-500 mx-auto" />
              </motion.div>
              <p className="text-sm text-zinc-400">
                {isRTL ? 'أدخل وصفاً لإنشاء مشروعك' : 'Enter a prompt to generate your project'}
              </p>
            </div>
          </motion.div>
        )}
      </Suspense>
      
      {/* Visual Edit Mode Banner */}
      <AnimatePresence>
        {elementSelectMode && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-[56px] left-0 right-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2.5 text-sm flex items-center justify-between z-50 shadow-lg pointer-events-none"
          >
            <span className="flex items-center gap-2 font-medium">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <MousePointer2 className="h-4 w-4" />
              </motion.div>
              {isRTL ? 'وضع التحرير المرئي - انقر على عنصر لتحريره' : 'Visual Edit Mode - Click an element to edit'}
            </span>
            <button 
              onClick={onCloseElementSelectMode}
              className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-lg transition-colors pointer-events-auto"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Selected Element Floating Bar */}
      <AnimatePresence>
        {selectedElementInfo && !showElementEditPopover && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900 border border-indigo-500/50 p-3 rounded-xl shadow-2xl flex items-center gap-4 z-50 max-w-md"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-indigo-400 text-xs font-mono bg-indigo-500/20 px-2 py-0.5 rounded font-bold">
                  {selectedElementInfo.tagName}
                </span>
                <span className="text-zinc-400 text-xs">selected</span>
              </div>
              <p className="text-white text-sm truncate mt-1">
                "{selectedElementInfo.innerText.substring(0, 40)}..."
              </p>
            </div>
            <button 
              onClick={onShowEditPopover}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {isRTL ? 'تحرير' : 'Edit'}
            </button>
            <button 
              onClick={onDismissSelectedElement}
              className="p-1.5 text-zinc-500 hover:text-white transition-colors"
              title={isRTL ? 'إغلاق' : 'Dismiss'}
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
