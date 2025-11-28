import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Trash2, Sparkles } from 'lucide-react';
import { useDrawAfterBG } from '@/hooks/useDrawAfterBG';
import { toast } from 'sonner';

interface DrawAfterBGCanvasProps {
  onClose?: () => void;
}

export const DrawAfterBGCanvas: React.FC<DrawAfterBGCanvasProps> = ({ onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [strength, setStrength] = useState(0.7);
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

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000000';
    }
  }, []);

  // Render generated image on background canvas
  useEffect(() => {
    if (!lastGeneratedImage || !bgCanvasRef.current) return;

    const bgCanvas = bgCanvasRef.current;
    const bgCtx = bgCanvas.getContext('2d');
    if (!bgCtx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
      bgCtx.drawImage(img, 0, 0, bgCanvas.width, bgCanvas.height);
      console.log('🖼️ Background image rendered');
    };
    img.onerror = (err) => {
      console.error('Failed to load generated image:', err);
      toast.error('Failed to display generated image');
    };
    img.src = lastGeneratedImage;
  }, [lastGeneratedImage]);

  const captureCanvasAsBase64 = useCallback((): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    try {
      return canvas.toDataURL('image/jpeg', 0.8);
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

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

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
    <div className="flex flex-col gap-4 w-full max-w-4xl mx-auto p-4">
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
      <div className="relative border-2 border-border rounded-lg overflow-hidden bg-background">
        {/* Background canvas for AI-generated images */}
        <canvas
          ref={bgCanvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ zIndex: 1 }}
        />
        
        {/* Drawing canvas (foreground) */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          style={{ zIndex: 2 }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Describe what you want to create..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="flex-1"
            disabled={!isConnected}
          />
          <Button
            onClick={triggerGeneration}
            disabled={!isConnected || !prompt.trim() || isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Enhance
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-sm text-muted-foreground whitespace-nowrap">
              Strength: {strength.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.6"
              max="0.8"
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

      {/* Instructions */}
      <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
        <p><strong>How it works:</strong></p>
        <ul className="list-disc list-inside mt-1 space-y-1">
          <li>Draw your sketch on the canvas</li>
          <li>Enter a prompt describing what you want</li>
          <li>AI will enhance your drawing in real-time as you draw</li>
          <li>Adjust strength to control how much the AI transforms your sketch</li>
        </ul>
      </div>
    </div>
  );
};
