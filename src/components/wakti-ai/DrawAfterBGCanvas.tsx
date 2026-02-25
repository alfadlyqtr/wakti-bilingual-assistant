import React, { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Undo2, Redo2, Download, Sparkles, ChevronDown, ImagePlus, Move, RotateCcw, ZoomIn, ZoomOut, Settings2, Check } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDrawAfterBG } from '@/hooks/useDrawAfterBG';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DrawAfterBGCanvasProps {
  prompt: string;
}

export interface DrawAfterBGCanvasRef {
  triggerManualGeneration: () => void;
}

export const DrawAfterBGCanvas = forwardRef<DrawAfterBGCanvasRef, DrawAfterBGCanvasProps>(({ prompt }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const bgImageSrcRef = useRef<string | null>(null);
  const isPanningBgRef = useRef(false);
  const skipDrawBgRef = useRef(false);
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();
  const lastGenerationTimeRef = useRef<number>(0);
  const { language } = useTheme();
  const isArabic = language === 'ar';
  const isMobile = useIsMobile();
  const [hasBackground, setHasBackground] = useState(false);
  const [isEditingBackground, setIsEditingBackground] = useState(false);
  const [bgOpacity, setBgOpacity] = useState(1);
  const [bgScale, setBgScale] = useState(1);
  const [bgRotationDeg, setBgRotationDeg] = useState(0);
  const [bgOffset, setBgOffset] = useState({ x: 0, y: 0 });

  // Bilingual prompt suggestions by category
  const promptCategories = isArabic ? {
    "🎨 تحسينات": [
      "تحسين",
      "أضف المزيد من التفاصيل",
      "أضف الظلال والإضاءة",
      "أضف الملمس والعمق",
      "اجعلها أكثر واقعية",
      "أضف التظليل",
      "حسّن النسب",
      "أضف تفاصيل دقيقة",
      "حسّن الإضاءة"
    ],
    "👤 شخصيات وأشياء": [
      "أضف شخصاً",
      "أضف حيوانات",
      "أضف أشجار ونباتات",
      "أضف مباني",
      "أضف مركبات",
      "أضف أثاث",
      "أضف زخارف",
      "أضف أشخاصاً في المشهد"
    ],
    "⚡ إجراءات سريعة": [
      "اجعلها أكبر",
      "أضف ضبابية الحركة",
      "أضف لمعان",
      "أضف تأثيرات النار",
      "أضف تأثيرات الماء",
      "اجعلها متماثلة",
      "أضف انعكاسات",
      "أضف تأثيرات سحرية"
    ],
    "✨ الأنماط والتأثيرات": [
      "أضف ألواناً نابضة بالحياة",
      "اجعلها ثلاثية الأبعاد وواقعية",
      "أضف نمط الكرتون",
      "اجعلها لوحة مائية",
      "أضف تأثيرات النيون المتوهجة",
      "اجعلها بأسلوب الرسم",
      "أضف نمط البكسل",
      "اجعلها بأسلوب الأنمي",
      "أضف ملمس اللوحة الزيتية",
      "اجعلها بسيطة"
    ],
    "🌍 الخلفية والمشهد": [
      "أضف خلفية جميلة",
      "أضف سماء غروب الشمس",
      "أضف خلفية مدينة",
      "أضف مناظر طبيعية",
      "أضف السحب والسماء",
      "أضف مشهد شاطئ",
      "أضف جبال في الخلفية",
      "أضف الفضاء والنجوم",
      "أضف غابة"
    ]
  } : {
    "🎨 Enhancements": [
      "enhance",
      "add more details",
      "add shadows and highlights",
      "add texture and depth",
      "make it more realistic",
      "add shading",
      "improve proportions",
      "add fine details",
      "enhance the lighting"
    ],
    "👤 Characters & Objects": [
      "add a person",
      "add animals",
      "add trees and plants",
      "add buildings",
      "add vehicles",
      "add furniture",
      "add decorations",
      "add people in the scene"
    ],
    "⚡ Quick Actions": [
      "make it bigger",
      "add motion blur",
      "add sparkles",
      "add fire effects",
      "add water effects",
      "make it symmetrical",
      "add reflections",
      "add magical effects"
    ],
    "✨ Style & Effects": [
      "add vibrant colors",
      "make it 3D and realistic",
      "add cartoon style",
      "make it watercolor painting",
      "add neon glow effects",
      "make it sketch art style",
      "add pixel art style",
      "make it anime style",
      "add oil painting texture",
      "make it minimalist"
    ],
    "🌍 Background & Scene": [
      "add a beautiful background",
      "add a sunset sky",
      "add a city background",
      "add nature scenery",
      "add clouds and sky",
      "add a beach scene",
      "add mountains in background",
      "add space and stars",
      "add a forest setting"
    ]
  };

  const generationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Undo/Redo history management
  const [history, setHistory] = useState<string[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);

  const { isConnected, isGenerating, lastGeneratedImage, sendGenerationRequest, resetImage } = useDrawAfterBG();

  const drawBackground = useCallback(() => {
    const bgCanvas = bgCanvasRef.current;
    const img = bgImageRef.current;
    if (!bgCanvas) return;
    const ctx = bgCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    if (!img) return;

    ctx.save();
    ctx.globalAlpha = bgOpacity;
    const cx = bgCanvas.width / 2 + bgOffset.x;
    const cy = bgCanvas.height / 2 + bgOffset.y;
    ctx.translate(cx, cy);
    ctx.rotate((bgRotationDeg * Math.PI) / 180);
    ctx.scale(bgScale, bgScale);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  }, [bgOpacity, bgOffset.x, bgOffset.y, bgRotationDeg, bgScale]);

  const fitBackgroundToCanvas = useCallback(() => {
    const bgCanvas = bgCanvasRef.current;
    const img = bgImageRef.current;
    if (!bgCanvas || !img) return;
    if (img.width === 0 || img.height === 0) return;

    // Smart fit: only downscale if image is larger than canvas, otherwise keep original size
    const needsDownscale = img.width > bgCanvas.width || img.height > bgCanvas.height;
    const scale = needsDownscale
      ? Math.min(bgCanvas.width / img.width, bgCanvas.height / img.height)
      : 1;
    setBgScale(scale);
    setBgRotationDeg(0);
    setBgOffset({ x: 0, y: 0 });
    setBgOpacity(1);
  }, []);

  const loadBackgroundFromUrl = useCallback((url: string, opts?: { keepTransform?: boolean }) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      bgImageRef.current = img;
      bgImageSrcRef.current = url;
      setHasBackground(true);
      if (!opts?.keepTransform) {
        fitBackgroundToCanvas();
      } else {
        drawBackground();
      }
    };
    img.onerror = (err) => {
      console.error('Failed to load background image:', err);
      toast.error(isArabic ? 'فشل تحميل الصورة' : 'Failed to load image');
    };
    img.src = url;
  }, [drawBackground, fitBackgroundToCanvas, isArabic]);

  const importFileAsBackground = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error(isArabic ? 'الملف ليس صورة' : 'File is not an image');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      if (!url) {
        toast.error(isArabic ? 'فشل تحميل الصورة' : 'Failed to load image');
        return;
      }
      loadBackgroundFromUrl(url);
      toast.success(isArabic ? 'تم استيراد الصورة' : 'Image imported');
    };
    reader.onerror = () => {
      toast.error(isArabic ? 'فشل تحميل الصورة' : 'Failed to load image');
    };
    reader.readAsDataURL(file);
  }, [isArabic, loadBackgroundFromUrl]);

  const clearDrawingLayer = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    try {
      const initialState = canvas.toDataURL();
      setHistory([initialState]);
      setHistoryStep(0);
    } catch (err) {
      console.error('Failed to save initial canvas state:', err);
      setHistory([]);
      setHistoryStep(-1);
    }
  }, []);

  // Initialize canvases
  useEffect(() => {
    const canvas = canvasRef.current;
    const bgCanvas = bgCanvasRef.current;
    if (!canvas || !bgCanvas) return;

    const rect = canvas.parentElement?.getBoundingClientRect();
    const width = rect?.width || 800;
    const height = 600;

    canvas.width = width;
    canvas.height = height;
    bgCanvas.width = width;
    bgCanvas.height = height;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (ctx) {
      // Clear with transparency
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000000';

      // Save initial blank state to history so undo works from first stroke
      try {
        const initialState = canvas.toDataURL();
        setHistory([initialState]);
        setHistoryStep(0);
      } catch (err) {
        console.error('Failed to save initial canvas state:', err);
      }
    }
  }, []);

  // Repaint background when background transform changes
  useEffect(() => {
    if (skipDrawBgRef.current) {
      skipDrawBgRef.current = false;
      return;
    }
    drawBackground();
  }, [drawBackground]);

  // Render generated image as the new background (keeps drawing layer separate)
  useEffect(() => {
    console.log('🔄 lastGeneratedImage changed:', lastGeneratedImage ? 'HAS URL' : 'NO URL', lastGeneratedImage);

    if (!lastGeneratedImage || !bgCanvasRef.current) return;

    console.log('🔄 Setting background src to:', lastGeneratedImage);

    // Paint the AI result directly onto the background canvas.
    // We bypass the loadBackgroundFromUrl → fitBackgroundToCanvas → drawBackground chain
    // because on 2nd+ generation the state values don't change, so drawBackground never re-fires.
    const bgCanvas = bgCanvasRef.current;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      bgImageRef.current = img;
      bgImageSrcRef.current = lastGeneratedImage;
      setHasBackground(true);

      // Fit & paint directly
      const ctx = bgCanvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);

      const needsDownscale = img.width > bgCanvas.width || img.height > bgCanvas.height;
      const scale = needsDownscale
        ? Math.min(bgCanvas.width / img.width, bgCanvas.height / img.height)
        : 1;
      setBgScale(scale);
      setBgRotationDeg(0);
      setBgOffset({ x: 0, y: 0 });
      setBgOpacity(1);

      ctx.save();
      const cx = bgCanvas.width / 2;
      const cy = bgCanvas.height / 2;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();

      // Skip the next drawBackground useEffect cycle — we just painted directly
      // and the setBgScale/setBgOffset calls will trigger it with stale closure values.
      skipDrawBgRef.current = true;

      console.log('✅ AI result painted to background canvas');
    };
    img.src = lastGeneratedImage;

    clearDrawingLayer();
    toast.success(isArabic ? 'تم تحسين الصورة! ارسم وأرسل مرة أخرى للبناء.' : 'AI enhanced! Draw and send again to keep building.');
  }, [lastGeneratedImage]);

  // Save current canvas state to history
  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const dataUrl = canvas.toDataURL();
      setHistory(prev => {
        // Remove any future history if we're not at the end
        const newHistory = prev.slice(0, historyStep + 1);
        // Add current state
        newHistory.push(dataUrl);
        // Limit history to 20 states to prevent memory issues
        if (newHistory.length > 20) {
          newHistory.shift();
          return newHistory;
        }
        return newHistory;
      });
      setHistoryStep(prev => Math.min(prev + 1, 19));
    } catch (err) {
      console.error('Failed to save canvas state:', err);
    }
  }, [historyStep]);

  // Restore canvas from history
  const restoreFromHistory = useCallback((dataUrl: string) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
  }, []);

  // Undo last drawing action
  const handleUndo = useCallback(() => {
    if (historyStep <= 0) {
      toast.info('Nothing to undo');
      return;
    }

    const newStep = historyStep - 1;
    setHistoryStep(newStep);
    restoreFromHistory(history[newStep]);
    toast.success('Undo');
  }, [historyStep, history, restoreFromHistory]);

  // Redo last undone action
  const handleRedo = useCallback(() => {
    if (historyStep >= history.length - 1) {
      toast.info('Nothing to redo');
      return;
    }

    const newStep = historyStep + 1;
    setHistoryStep(newStep);
    restoreFromHistory(history[newStep]);
    toast.success('Redo');
  }, [historyStep, history, restoreFromHistory]);

  const captureCanvasAsBase64 = useCallback((): string | null => {
    const canvas = canvasRef.current;
    const bgCanvas = bgCanvasRef.current;
    if (!canvas || !bgCanvas) return null;

    try {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const exportCtx = exportCanvas.getContext('2d');
      if (!exportCtx) return null;

      exportCtx.fillStyle = '#ffffff';
      exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      exportCtx.drawImage(bgCanvas, 0, 0);
      exportCtx.drawImage(canvas, 0, 0);

      return exportCanvas.toDataURL('image/jpeg', 0.9);
    } catch (err) {
      console.error('Failed to capture canvas:', err);
      return null;
    }
  }, []);

  const triggerGeneration = useCallback(() => {
    const now = Date.now();
    if (now - lastGenerationTimeRef.current < 200) {
      console.log('⏸️ Throttled generation (200ms cooldown)');
      return;
    }

    if (!prompt.trim()) {
      console.log('⏸️ No prompt provided');
      toast.error('Please enter a prompt to enhance your drawing');
      return;
    }

    console.log('🎨 DRAW FEATURE: Starting generation with prompt:', prompt);

    const imageBase64 = captureCanvasAsBase64();
    if (!imageBase64) {
      console.error('❌ DRAW FEATURE: Failed to capture canvas');
      toast.error('Failed to capture drawing');
      return;
    }

    console.log('✅ DRAW FEATURE: Canvas captured, base64 length:', imageBase64.length);
    lastGenerationTimeRef.current = now;
    sendGenerationRequest(imageBase64, prompt, 0.5);
  }, [prompt, captureCanvasAsBase64, sendGenerationRequest]);

  // Expose triggerGeneration to parent via ref
  useImperativeHandle(ref, () => ({
    triggerManualGeneration: triggerGeneration
  }), [triggerGeneration]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isEditingBackground) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    // Scale coordinates based on canvas internal size vs display size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    ctx.beginPath();
    ctx.moveTo(x, y);
    // Draw a dot immediately so single taps register
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isEditingBackground) return;
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    // Scale coordinates based on canvas internal size vs display size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleMouseUp = () => {
    if (isEditingBackground) return;
    if (isDrawing) {
      setIsDrawing(false);
      // Save to history after stroke completion
      saveToHistory();
      // Don't auto-generate - user will click Send button when ready
    }
  };

  const handleMouseLeave = () => {
    if (isEditingBackground) return;
    if (isDrawing) {
      setIsDrawing(false);
      saveToHistory();
    }
  };

  // Touch event handlers for mobile/tablet support
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (isEditingBackground) return;
    e.preventDefault(); // Prevent scrolling while drawing
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const touch = e.touches[0];
    if (!touch) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;

    ctx.beginPath();
    ctx.moveTo(x, y);
    // Draw a dot immediately so single taps register
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (isEditingBackground) return;
    e.preventDefault(); // Prevent scrolling while drawing
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const touch = e.touches[0];
    if (!touch) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleTouchEnd = () => {
    if (isEditingBackground) return;
    if (isDrawing) {
      setIsDrawing(false);
      // Save to history after stroke completion
      saveToHistory();
      // Don't auto-generate - user will click Send button when ready
    }
  };

  const clearCanvas = () => {
    clearDrawingLayer();
    bgImageRef.current = null;
    bgImageSrcRef.current = null;
    setHasBackground(false);
    setIsEditingBackground(false);
    setBgOpacity(1);
    setBgScale(1);
    setBgRotationDeg(0);
    setBgOffset({ x: 0, y: 0 });
    drawBackground();
    resetImage();
    toast.success(isArabic ? 'تم مسح اللوحة - جاهز للرسم!' : 'Canvas cleared - ready to draw!');
  };

  const removeBackground = useCallback(() => {
    bgImageRef.current = null;
    bgImageSrcRef.current = null;
    setHasBackground(false);
    setIsEditingBackground(false);
    setBgOpacity(1);
    setBgScale(1);
    setBgRotationDeg(0);
    setBgOffset({ x: 0, y: 0 });
    drawBackground();
  }, [drawBackground]);

  const getCanvasPoint = useCallback((evt: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = evt.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  }, []);

  const handleBgPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isEditingBackground) return;
    e.preventDefault();
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    isPanningBgRef.current = true;
    lastPanPointRef.current = getCanvasPoint(e);
  };

  const handleBgPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isEditingBackground) return;
    if (!isPanningBgRef.current) return;
    const pt = getCanvasPoint(e);
    const prev = lastPanPointRef.current;
    if (!prev) {
      lastPanPointRef.current = pt;
      return;
    }
    const dx = pt.x - prev.x;
    const dy = pt.y - prev.y;
    lastPanPointRef.current = pt;
    setBgOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  };

  const handleBgPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isEditingBackground) return;
    e.preventDefault();
    try {
      (e.currentTarget as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    isPanningBgRef.current = false;
    lastPanPointRef.current = null;
  };

  // Cleanup interval ref on unmount (no longer used for auto-generation)
  useEffect(() => {
    return () => {
      if (generationIntervalRef.current) {
        clearInterval(generationIntervalRef.current);
      }
    };
  }, []);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z for Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Y or Cmd+Y or Ctrl+Shift+Z for Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  return (
    <div className="flex flex-col gap-4 w-full h-full p-4 pb-20">
      {/* Status Banner */}
      <div className="flex items-center justify-between bg-muted p-3 rounded-lg">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-muted-foreground">
            {isConnected
              ? (isArabic ? 'متصل • الرسم في الوقت الفعلي نشط' : 'Connected • Real-time drawing active')
              : (isArabic ? 'جاري الاتصال...' : 'Connecting...')}
          </span>
        </div>
        {isGenerating && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{isArabic ? 'جاري التحسين...' : 'Enhancing...'}</span>
          </div>
        )}
      </div>

      {/* Canvas Container */}
      <div className="relative flex-1 border-2 border-border rounded-lg overflow-hidden bg-white">
        {/* Background canvas (imported sketch/photo or AI result) */}
        <canvas
          ref={bgCanvasRef}
          className={"absolute inset-0 w-full h-full select-none"}
          style={{
            backgroundColor: 'white',
            touchAction: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none',
            WebkitTouchCallout: 'none',
            cursor: isEditingBackground ? 'grab' : 'default'
          }}
          onPointerDown={handleBgPointerDown}
          onPointerMove={handleBgPointerMove}
          onPointerUp={handleBgPointerUp}
          onPointerCancel={handleBgPointerUp}
        />

        {/* Drawing canvas (strokes) */}
        <canvas
          ref={canvasRef}
          className={"absolute inset-0 w-full h-full select-none"}
          style={{
            backgroundColor: 'transparent',
            touchAction: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none',
            WebkitTouchCallout: 'none',
            cursor: isEditingBackground ? 'not-allowed' : 'crosshair',
            pointerEvents: isEditingBackground ? 'none' : 'auto'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      </div>

      {/* Quick Prompts Dropdown */}
      <div className="mb-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>{isArabic ? 'اقتراحات سريعة' : 'Quick Prompts'}</span>
              </div>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[300px] max-h-[400px] overflow-y-auto">
            {Object.entries(promptCategories).map(([category, prompts], categoryIndex) => (
              <div key={categoryIndex}>
                <DropdownMenuLabel>{category}</DropdownMenuLabel>
                {prompts.map((prompt, promptIndex) => (
                  <DropdownMenuItem
                    key={promptIndex}
                    onClick={() => {
                      const event = new CustomEvent('quickPromptSelected', { detail: prompt });
                      window.dispatchEvent(event);
                    }}
                    className="cursor-pointer"
                  >
                    {prompt}
                  </DropdownMenuItem>
                ))}
                {categoryIndex < Object.entries(promptCategories).length - 1 && (
                  <DropdownMenuSeparator />
                )}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Controls */}
      <div className={isMobile ? "flex items-center gap-1.5 overflow-x-auto pb-2 -mx-2 px-2" : "flex items-center gap-2 flex-wrap"}>
        <div className={isMobile ? "flex items-center gap-1.5 flex-nowrap" : "flex items-center gap-2"}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            aria-label={isArabic ? 'رفع صورة للرسم' : 'Upload image for drawing'}
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importFileAsBackground(file);
              e.currentTarget.value = '';
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            aria-label={isArabic ? 'التقاط صورة للرسم' : 'Capture photo for drawing'}
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importFileAsBackground(file);
              e.currentTarget.value = '';
            }}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                title={isArabic ? 'استيراد صورة / رسم' : 'Import sketch/photo'}
              >
                <ImagePlus className="w-4 h-4" />
                {!isMobile && (isArabic ? 'استيراد' : 'Import')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" sideOffset={8}>
              <DropdownMenuLabel>{isArabic ? 'استيراد' : 'Import'}</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => {
                  cameraInputRef.current?.click();
                }}
              >
                {isArabic ? 'الكاميرا' : 'Camera'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  fileInputRef.current?.click();
                }}
              >
                {isArabic ? 'رفع صورة' : 'Upload'}
              </DropdownMenuItem>
              {hasBackground && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      removeBackground();
                    }}
                    className="text-red-600"
                  >
                    {isArabic ? 'إزالة الخلفية' : 'Remove background'}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile: group background controls in a dropdown */}
          {isMobile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={!hasBackground}
                  title={isArabic ? 'أدوات الخلفية' : 'Background tools'}
                >
                  <Settings2 className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" sideOffset={8} className="min-w-[180px]">
                <DropdownMenuLabel>{isArabic ? 'أدوات الخلفية' : 'Background Tools'}</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setIsEditingBackground((v) => !v)}>
                  <Move className="w-4 h-4 mr-2" />
                  {isEditingBackground ? (isArabic ? 'إيقاف التحريك' : 'Stop Move') : (isArabic ? 'تحريك' : 'Move')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fitBackgroundToCanvas()}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {isArabic ? 'ملاءمة' : 'Fit'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setBgScale((s) => s * 1.1)}>
                  <ZoomIn className="w-4 h-4 mr-2" />
                  {isArabic ? 'تكبير' : 'Zoom In'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBgScale((s) => s / 1.1)}>
                  <ZoomOut className="w-4 h-4 mr-2" />
                  {isArabic ? 'تصغير' : 'Zoom Out'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setBgRotationDeg((r) => r - 15)}>
                  ⟲ {isArabic ? 'تدوير يسار' : 'Rotate Left'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBgRotationDeg((r) => r + 15)}>
                  ⟳ {isArabic ? 'تدوير يمين' : 'Rotate Right'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5">
                  <span className="text-xs text-muted-foreground block mb-1">{isArabic ? 'شفافية' : 'Opacity'}</span>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={bgOpacity}
                    onChange={(e) => setBgOpacity(Number(e.target.value))}
                    aria-label={isArabic ? 'شفافية الخلفية' : 'Background opacity'}
                    className="w-full"
                  />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            /* Desktop: show all buttons inline */
            <>
              <Button
                variant={isEditingBackground ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIsEditingBackground((v) => !v)}
                disabled={!hasBackground}
                className="gap-2"
                title={isArabic ? 'تحريك الخلفية' : 'Move background'}
              >
                <Move className="w-4 h-4" />
                {isArabic ? 'تحريك' : 'Move'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  fitBackgroundToCanvas();
                }}
                disabled={!hasBackground}
                className="gap-2"
                title={isArabic ? 'ملء اللوحة' : 'Fit to canvas'}
              >
                <RotateCcw className="w-4 h-4" />
                {isArabic ? 'ملاءمة' : 'Fit'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setBgScale((s) => s * 1.1)}
                disabled={!hasBackground}
                className="gap-2"
                title={isArabic ? 'تكبير الخلفية' : 'Zoom in background'}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setBgScale((s) => s / 1.1)}
                disabled={!hasBackground}
                className="gap-2"
                title={isArabic ? 'تصغير الخلفية' : 'Zoom out background'}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setBgRotationDeg((r) => r - 15)}
                disabled={!hasBackground}
                className="gap-2"
                title={isArabic ? 'تدوير يسار' : 'Rotate left'}
              >
                ⟲
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setBgRotationDeg((r) => r + 15)}
                disabled={!hasBackground}
                className="gap-2"
                title={isArabic ? 'تدوير يمين' : 'Rotate right'}
              >
                ⟳
              </Button>

              <div className="flex items-center gap-2 px-2">
                <span className="text-xs text-muted-foreground">{isArabic ? 'شفافية' : 'Opacity'}</span>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={bgOpacity}
                  onChange={(e) => setBgOpacity(Number(e.target.value))}
                  disabled={!hasBackground}
                  aria-label={isArabic ? 'شفافية الخلفية' : 'Background opacity'}
                  style={{ width: 110 }}
                />
              </div>
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={historyStep <= 0}
            className={isMobile ? "p-2 min-w-[36px]" : "gap-2"}
            title={isArabic ? 'تراجع' : 'Undo (Ctrl+Z)'}
          >
            <Undo2 className="w-4 h-4" />
            {!isMobile && (isArabic ? 'تراجع' : 'Undo')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRedo}
            disabled={historyStep >= history.length - 1}
            className={isMobile ? "p-2 min-w-[36px]" : "gap-2"}
            title={isArabic ? 'إعادة' : 'Redo (Ctrl+Y)'}
          >
            <Redo2 className="w-4 h-4" />
            {!isMobile && (isArabic ? 'إعادة' : 'Redo')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={clearCanvas}
            className={isMobile ? "p-2 min-w-[36px]" : "gap-2"}
            title={isArabic ? 'مسح اللوحة' : 'Clear canvas'}
          >
            <Trash2 className="w-4 h-4" />
            {!isMobile && (isArabic ? 'مسح' : 'Clear')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const canvas = canvasRef.current;
              const bgCanvas = bgCanvasRef.current;
              if (!canvas) return;
              if (!bgCanvas) return;

              try {
                // Create an offscreen canvas with white background for proper export
                const exportCanvas = document.createElement('canvas');
                exportCanvas.width = canvas.width;
                exportCanvas.height = canvas.height;
                const exportCtx = exportCanvas.getContext('2d');
                if (!exportCtx) {
                  toast.error(isArabic ? 'فشل في حفظ الرسم' : 'Failed to save drawing');
                  return;
                }

                // Fill with white background
                exportCtx.fillStyle = '#ffffff';
                exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
                exportCtx.drawImage(bgCanvas, 0, 0);
                exportCtx.drawImage(canvas, 0, 0);

                // Convert to blob for better mobile compatibility
                exportCanvas.toBlob((blob) => {
                  if (!blob) {
                    toast.error(isArabic ? 'فشل في حفظ الرسم' : 'Failed to save drawing');
                    return;
                  }

                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.download = `wakti-drawing-${Date.now()}.png`;
                  link.href = url;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);

                  toast.success(isArabic ? 'تم حفظ الرسم!' : 'Drawing saved!');
                }, 'image/png');
              } catch (err) {
                console.error('Save failed:', err);
                toast.error(isArabic ? 'فشل في حفظ الرسم' : 'Failed to save drawing');
              }
            }}
            className={isMobile ? "p-2 min-w-[36px]" : "gap-2"}
            title={isArabic ? 'حفظ الرسم' : 'Save drawing'}
          >
            <Download className="w-4 h-4" />
            {!isMobile && (isArabic ? 'تنزيل' : 'Download')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={isSaving}
            onClick={async () => {
              const canvas = canvasRef.current;
              const bgCanvas = bgCanvasRef.current;
              if (!canvas || !bgCanvas || !user?.id) {
                toast.error(isArabic ? 'يرجى تسجيل الدخول' : 'Please sign in');
                return;
              }

              setIsSaving(true);
              try {
                // Capture combined canvas
                const exportCanvas = document.createElement('canvas');
                exportCanvas.width = canvas.width;
                exportCanvas.height = canvas.height;
                const exportCtx = exportCanvas.getContext('2d');
                if (!exportCtx) throw new Error('No context');

                exportCtx.fillStyle = '#ffffff';
                exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
                exportCtx.drawImage(bgCanvas, 0, 0);
                exportCtx.drawImage(canvas, 0, 0);

                const blob = await new Promise<Blob | null>((resolve) =>
                  exportCanvas.toBlob(resolve, 'image/png')
                );
                if (!blob) throw new Error('Failed to capture');

                // Upload to storage
                const fileName = `${user.id}/draw-${Date.now()}.png`;
                const { error: uploadErr } = await supabase.storage
                  .from('generated-images')
                  .upload(fileName, blob, { contentType: 'image/png', upsert: false });
                if (uploadErr) throw uploadErr;

                const { data: urlData } = supabase.storage
                  .from('generated-images')
                  .getPublicUrl(fileName);
                const imageUrl = (urlData?.publicUrl || '').replace(/%20/g, ' ').trim();
                if (!imageUrl) throw new Error('No public URL');

                // Insert into DB
                const { error: dbErr } = await (supabase as any)
                  .from('user_generated_images')
                  .insert({
                    user_id: user.id,
                    image_url: imageUrl,
                    prompt: prompt || null,
                    submode: 'draw',
                    quality: null,
                    meta: {},
                  });
                if (dbErr) throw dbErr;

                toast.success(isArabic ? 'تم الحفظ! يمكنك رؤيتها في المحفوظات' : 'Saved! Check your Saved tab');

                // Clear canvas
                clearCanvas();
              } catch (err: any) {
                console.error('Done & Save failed:', err);
                toast.error(isArabic ? 'فشل الحفظ' : 'Save failed');
              } finally {
                setIsSaving(false);
              }
            }}
            className={isMobile ? "p-2 min-w-[36px] bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400" : "gap-2 bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400"}
            title={isArabic ? 'حفظ وإنهاء' : 'Done & Save'}
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {!isMobile && (isArabic ? 'حفظ وإنهاء' : 'Done & Save')}
          </Button>
        </div>
      </div>
    </div>
  );
});

DrawAfterBGCanvas.displayName = 'DrawAfterBGCanvas';
