import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface UseDrawAfterBGReturn {
  isConnected: boolean;
  isGenerating: boolean;
  lastGeneratedImage: string | null;
  sendGenerationRequest: (imageBase64: string, prompt: string, strength?: number) => void;
  disconnect: () => void;
}

export const useDrawAfterBG = (): UseDrawAfterBGReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGeneratedImage, setLastGeneratedImage] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    try {
      // Get Supabase URL from env
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        toast.error('Supabase URL not configured');
        return;
      }

      // Build WebSocket URL
      const wsUrl = supabaseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
      const fullWsUrl = `${wsUrl}/functions/v1/wakti-co-draw`;

      console.log('🔌 Connecting to:', fullWsUrl);

      const ws = new WebSocket(fullWsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        toast.success('Real-time drawing ready!');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 Received:', message.type);

          switch (message.type) {
            case 'connected':
              console.log('✅ Server confirmed connection');
              break;

            case 'progress':
              console.log('⏳ Progress:', message.status);
              setIsGenerating(true);
              break;

            case 'image':
              console.log('🖼️ Image received');
              setLastGeneratedImage(message.data);
              setIsGenerating(false);
              break;

            case 'error':
              console.error('❌ Error:', message.message);
              toast.error(`Generation failed: ${message.message}`);
              setIsGenerating(false);
              break;

            default:
              console.log('Unknown message type:', message.type);
          }
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        toast.error('Connection error');
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket closed');
        setIsConnected(false);
        setIsGenerating(false);

        // Auto-reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Attempting to reconnect...');
          connect();
        }, 3000);
      };

      wsRef.current = ws;

    } catch (error) {
      console.error('Connection failed:', error);
      toast.error('Failed to connect');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsGenerating(false);
  }, []);

  const sendGenerationRequest = useCallback((imageBase64: string, prompt: string, strength = 0.7) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast.error('Not connected to server');
      return;
    }

    if (!imageBase64 || !prompt.trim()) {
      toast.error('Please draw something and add a prompt');
      return;
    }

    console.log('🚀 Sending generation request');
    setIsGenerating(true);

    wsRef.current.send(JSON.stringify({
      imageBase64,
      prompt: prompt.trim(),
      strength
    }));
  }, []);

  // Connect on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    isGenerating,
    lastGeneratedImage,
    sendGenerationRequest,
    disconnect
  };
};
