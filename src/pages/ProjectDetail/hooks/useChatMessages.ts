import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ChatMessage, ImageAttachment } from '../types';

interface UseChatMessagesOptions {
  projectId: string | undefined;
  isRTL: boolean;
}

interface UseChatMessagesReturn {
  messages: ChatMessage[];
  input: string;
  attachedImages: ImageAttachment[];
  isGenerating: boolean;
  thinkingStartTime: number | null;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  setAttachedImages: React.Dispatch<React.SetStateAction<ImageAttachment[]>>;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  setThinkingStartTime: React.Dispatch<React.SetStateAction<number | null>>;
  addMessage: (message: ChatMessage) => void;
  clearInput: () => void;
  removeAttachment: (index: number) => void;
  fetchChatHistory: () => Promise<void>;
  saveChatMessage: (message: ChatMessage) => Promise<void>;
}

export function useChatMessages({ projectId, isRTL }: UseChatMessagesOptions): UseChatMessagesReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [attachedImages, setAttachedImages] = useState<ImageAttachment[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [thinkingStartTime, setThinkingStartTime] = useState<number | null>(null);

  // Add a new message to the list
  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  }, []);

  // Clear input and attachments
  const clearInput = useCallback(() => {
    setInput('');
    setAttachedImages([]);
  }, []);

  // Remove an attached image by index
  const removeAttachment = useCallback((index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Fetch chat history from database
  const fetchChatHistory = useCallback(async () => {
    if (!projectId) return;
    
    try {
      const { data, error } = await (supabase
        .from('project_chat_messages' as any)
        .select('id, role, content, snapshot')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true }) as any);

      if (error) {
        console.error('Error fetching chat history:', error);
      } else if (data && Array.isArray(data) && data.length > 0) {
        console.log('[useChatMessages] Loaded', data.length, 'chat messages');
        setMessages(data as ChatMessage[]);
      }
    } catch (err) {
      console.error('Exception fetching chat history:', err);
    }
  }, [projectId]);

  // Save a chat message to the database
  const saveChatMessage = useCallback(async (message: ChatMessage) => {
    if (!projectId) return;

    try {
      await supabase
        .from('project_chat_messages' as any)
        .insert({
          project_id: projectId,
          role: message.role,
          content: message.content,
          snapshot: message.snapshot || null,
        });
    } catch (err) {
      console.error('Exception saving chat message:', err);
    }
  }, [projectId]);

  return {
    messages,
    input,
    attachedImages,
    isGenerating,
    thinkingStartTime,
    setMessages,
    setInput,
    setAttachedImages,
    setIsGenerating,
    setThinkingStartTime,
    addMessage,
    clearInput,
    removeAttachment,
    fetchChatHistory,
    saveChatMessage,
  };
}
