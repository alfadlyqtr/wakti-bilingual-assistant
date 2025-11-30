import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface UseDrawAfterBGReturn {
  isConnected: boolean;
  isGenerating: boolean;
  lastGeneratedImage: string | null;
  sendGenerationRequest: (imageBase64: string, prompt: string, strength?: number) => void;
  disconnect: () => void;
  resetImage: () => void;
}

export const useDrawAfterBG = (): UseDrawAfterBGReturn => {
  const [isConnected, setIsConnected] = useState(true); // Always connected (HTTP-based)
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGeneratedImage, setLastGeneratedImage] = useState<string | null>(null);

  const sendGenerationRequest = useCallback(async (imageBase64: string, prompt: string, strength = 0.7) => {
    if (!imageBase64 || !prompt.trim()) {
      toast.error('Please draw something and add a prompt');
      return;
    }

    console.log('🚀 Sending generation request');
    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('wakti-co-draw', {
        body: {
          imageBase64,
          prompt: prompt.trim(),
          strength
        }
      });

      if (error) {
        console.error('❌ Generation error:', error);
        toast.error(`Generation failed: ${error.message}`);
        setIsGenerating(false);
        return;
      }

      console.log('📦 DRAW FEATURE: Full API response:', data);
      
      if (data?.success && data?.imageUrl) {
        console.log('✅ DRAW FEATURE: Image generated successfully');
        console.log('🖼️ DRAW FEATURE: Image URL:', data.imageUrl);
        setLastGeneratedImage(data.imageUrl);
        // Toast will be shown by DrawAfterBGCanvas component
      } else {
        console.error('❌ DRAW FEATURE: No image in response');
        console.error('📦 DRAW FEATURE: Response data:', JSON.stringify(data, null, 2));
        toast.error('Generation failed: No image returned');
      }

      setIsGenerating(false);
    } catch (err: any) {
      console.error('❌ Request failed:', err);
      toast.error(`Generation failed: ${err.message || 'Unknown error'}`);
      setIsGenerating(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    // No-op for HTTP-based approach
    setIsConnected(true);
    setIsGenerating(false);
  }, []);

  const resetImage = useCallback(() => {
    setLastGeneratedImage(null);
  }, []);

  return {
    isConnected,
    isGenerating,
    lastGeneratedImage,
    sendGenerationRequest,
    disconnect,
    resetImage
  };
};
