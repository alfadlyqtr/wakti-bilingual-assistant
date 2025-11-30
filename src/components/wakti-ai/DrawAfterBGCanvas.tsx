import React, { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Undo2, Redo2 } from 'lucide-react';
import { useDrawAfterBG } from '@/hooks/useDrawAfterBG';
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
  const [isDrawing, setIsDrawing] = useState(false);
  const [strength, setStrength] = useState(0.5);
  const lastGenerationTimeRef = useRef<number>(0);
  const generationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Undo/Redo history management
  const [history, setHistory] = useState<string[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);

  const { isConnected, isGenerating, lastGeneratedImage, sendGenerationRequest, resetImage } = useDrawAfterBG();

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
    }
  }, []);

  // Render generated image on background canvas
  useEffect(() => {
    console.log('🔄 lastGeneratedImage changed:', lastGeneratedImage ? 'HAS URL' : 'NO URL', lastGeneratedImage);
    
    if (!lastGeneratedImage || !bgCanvasRef.current) return;

    const bgCanvas = bgCanvasRef.current;
    const bgCtx = bgCanvas.getContext('2d');
    if (!bgCtx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous'; // Try to handle CORS
    
    img.onload = () => {
      console.log('✅ AI image loaded, replacing canvas content');
      
      // Draw AI result to the DRAWING canvas (replaces sketch)
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      
      if (!canvas || !ctx) {
        console.error('❌ Canvas not available');
        return;
      }
      
      if (canvas.width === 0 || canvas.height === 0) {
        console.error('❌ Canvas has zero dimensions');
        toast.error('Canvas error - please refresh');
        return;
      }
      
      // Clear and draw AI result to drawing canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      console.log('✅ AI result drawn to canvas - you can now draw on top!');
      
      toast.success('AI enhanced! Draw more and send again to keep building.');
    };
    
    img.onerror = (err) => {
      console.error('❌ Image failed to load:', err);
      console.error('❌ Failed URL was:', lastGeneratedImage);
      toast.error('Failed to load generated image');
    };
    
    console.log('🔄 Setting img.src to:', lastGeneratedImage);
    img.src = lastGeneratedImage;
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
    if (!canvas) return null;

    try {
      // Render onto an offscreen canvas with a solid white background
      // so the model sees a white sketch instead of transparency (which becomes black in JPEG).
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const exportCtx = exportCanvas.getContext('2d');
      if (!exportCtx) return null;

      exportCtx.fillStyle = '#ffffff';
      exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
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
    console.log('🎨 DRAW FEATURE: Strength:', strength);

    const imageBase64 = captureCanvasAsBase64();
    if (!imageBase64) {
      console.error('❌ DRAW FEATURE: Failed to capture canvas');
      toast.error('Failed to capture drawing');
      return;
    }

    console.log('✅ DRAW FEATURE: Canvas captured, base64 length:', imageBase64.length);
    lastGenerationTimeRef.current = now;
    sendGenerationRequest(imageBase64, prompt, strength);
  }, [prompt, strength, captureCanvasAsBase64, sendGenerationRequest]);

  // Expose triggerGeneration to parent via ref
  useImperativeHandle(ref, () => ({
    triggerManualGeneration: triggerGeneration
  }), [triggerGeneration]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
    if (isDrawing) {
      setIsDrawing(false);
      // Save to history after stroke completion
      saveToHistory();
      // Don't auto-generate - user will click Send button when ready
    }
  };

  const handleMouseLeave = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveToHistory();
    }
  };

  // Touch event handlers for mobile/tablet support
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
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
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
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
    if (isDrawing) {
      setIsDrawing(false);
      // Save to history after stroke completion
      saveToHistory();
      // Don't auto-generate - user will click Send button when ready
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Reset history when canvas is cleared
    setHistory([]);
    setHistoryStep(-1);
    
    // Reset AI image state
    resetImage();

    toast.success('Canvas cleared - ready to draw!');
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
    <div className="flex flex-col gap-4 w-full h-full p-4">
      {/* Status Banner */}
      <div className="flex items-center justify-between bg-muted p-3 rounded-lg">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-muted-foreground">
            {isConnected ? 'Connected • Real-time drawing active' : 'Connecting...'}
          </span>
        </div>
        {isGenerating && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Enhancing...</span>
          </div>
        )}
      </div>

      {/* Canvas Container */}
      <div className="relative flex-1 border-2 border-border rounded-lg overflow-hidden bg-white">
        {/* Single canvas for drawing and AI results */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          style={{ 
            backgroundColor: 'white',
            touchAction: 'none'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
        
        {/* Hidden background canvas - only used for loading AI images */}
        <canvas
          ref={bgCanvasRef}
          style={{ display: 'none' }}
        />
        
        {/* DEBUG: Test if image URL loads at all */}
        {lastGeneratedImage && (
          <img 
            src={lastGeneratedImage} 
            alt="Debug test" 
            className="absolute bottom-2 right-2 w-20 h-20 border-2 border-green-500 object-cover"
            style={{ zIndex: 999 }}
            onLoad={() => console.log('✅ DEBUG img tag loaded successfully')}
            onError={() => console.error('❌ DEBUG img tag failed')}
          />
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 flex-1">
          <label className="text-sm text-muted-foreground whitespace-nowrap">
            Strength: {strength.toFixed(2)}
          </label>
          <input
            type="range"
            min="0.3"
            max="0.6"
            step="0.05"
            value={strength}
            onChange={(e) => setStrength(parseFloat(e.target.value))}
            className="flex-1"
            aria-label="Drawing strength slider"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={historyStep <= 0}
            className="gap-2"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
            Undo
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRedo}
            disabled={historyStep >= history.length - 1}
            className="gap-2"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
            Redo
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={clearCanvas}
            className="gap-2"
            title="Clear canvas"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
});

DrawAfterBGCanvas.displayName = 'DrawAfterBGCanvas';
