import React, { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2 } from 'lucide-react';
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

  const { isConnected, isGenerating, lastGeneratedImage, sendGenerationRequest } = useDrawAfterBG();

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
      console.log('✅ Image loaded successfully, drawing to canvas');
      bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
      bgCtx.drawImage(img, 0, 0, bgCanvas.width, bgCanvas.height);
      toast.success('Drawing enhanced!');
    };
    
    img.onerror = (err) => {
      console.error('❌ Image failed to load:', err);
      console.error('❌ Failed URL was:', lastGeneratedImage);
      toast.error('Failed to load generated image');
    };
    
    console.log('🔄 Setting img.src to:', lastGeneratedImage);
    img.src = lastGeneratedImage;
  }, [lastGeneratedImage]);

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

    const imageBase64 = captureCanvasAsBase64();
    if (!imageBase64) {
      toast.error('Failed to capture drawing');
      return;
    }

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
    setIsDrawing(false);
    // Trigger generation after stroke completion
    if (prompt.trim() && isConnected) {
      triggerGeneration();
    }
  };

  const handleMouseLeave = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const bgCanvas = bgCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    const bgCtx = bgCanvas?.getContext('2d');

    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (bgCtx && bgCanvas) {
      bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    }

    toast.success('Canvas cleared');
  };

  // Auto-generation interval during continuous drawing
  useEffect(() => {
    if (isDrawing && prompt.trim() && isConnected) {
      generationIntervalRef.current = setInterval(() => {
        triggerGeneration();
      }, 200);
    } else {
      if (generationIntervalRef.current) {
        clearInterval(generationIntervalRef.current);
        generationIntervalRef.current = null;
      }
    }

    return () => {
      if (generationIntervalRef.current) {
        clearInterval(generationIntervalRef.current);
      }
    };
  }, [isDrawing, prompt, isConnected, triggerGeneration]);

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
      <div className="relative flex-1 border-2 border-border rounded-lg overflow-hidden bg-background">
        {/* Background canvas for AI-generated images */}
        <canvas
          ref={bgCanvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ zIndex: 1 }}
        />
        
        {/* Drawing canvas (foreground) - transparent to show background */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          style={{ zIndex: 2, backgroundColor: 'transparent' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
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
          />
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={clearCanvas}
          className="gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Clear
        </Button>
      </div>
    </div>
  );
});

DrawAfterBGCanvas.displayName = 'DrawAfterBGCanvas';
