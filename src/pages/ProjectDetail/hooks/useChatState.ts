// useChatState - Chat messages and input state management
// Part of Group A Enhancement: Performance & Code Quality

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ChatMessage, ImageAttachment } from '../types';

interface UseChatStateProps {
  projectId: string | undefined;
  isRTL: boolean;
}

export function useChatState({ projectId, isRTL }: UseChatStateProps) {
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [attachedImages, setAttachedImages] = useState<ImageAttachment[]>([]);
  const [aiEditing, setAiEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Pagination
  const MESSAGES_PER_PAGE = 10;
  const [visibleMessagesCount, setVisibleMessagesCount] = useState(MESSAGES_PER_PAGE);
  
  // Dynamic suggestions
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);
  
  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const wizardPromptRef = useRef<string | null>(null);
  
  // Flags for form wizard detection
  const skipFormWizardRef = useRef(false);
  const skipUserMessageSaveRef = useRef(false);
  
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
      } else if (data && data.length > 0) {
        console.log('[ProjectDetail] Loaded', data.length, 'chat messages');
        setChatMessages(data as ChatMessage[]);
      } else {
        console.log('[ProjectDetail] No chat messages found for project', projectId);
      }
    } catch (err) {
      console.error('Exception fetching chat history:', err);
    }
  }, [projectId]);
  
  // Save message to database
  const saveMessageToDb = useCallback(async (
    role: 'user' | 'assistant',
    content: string,
    snapshot?: Record<string, string>
  ): Promise<ChatMessage | null> => {
    if (!projectId) return null;
    
    try {
      const { data, error } = await (supabase
        .from('project_chat_messages' as any)
        .insert({
          project_id: projectId,
          role,
          content,
          snapshot: snapshot || null
        } as any)
        .select()
        .single() as any);
      
      if (error) {
        console.error(`Error saving ${role} message:`, error);
        return null;
      }
      
      return data as ChatMessage;
    } catch (err) {
      console.error(`Exception saving ${role} message:`, err);
      return null;
    }
  }, [projectId]);
  
  // Add message to local state
  const addMessage = useCallback((message: ChatMessage) => {
    setChatMessages(prev => [...prev, message]);
  }, []);
  
  // Add local message (without DB save)
  const addLocalMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    const message: ChatMessage = {
      id: `${role}-${Date.now()}`,
      role,
      content
    };
    setChatMessages(prev => [...prev, message]);
    return message;
  }, []);
  
  // Remove attached image by index
  const removeAttachedImage = useCallback((index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  }, []);
  
  // Clear attached images
  const clearAttachedImages = useCallback(() => {
    setAttachedImages([]);
  }, []);
  
  // Handle image selection
  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Handle PDF files
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        try {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const dataUrl = event.target?.result as string;
            
            const svg = `
              <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
                <rect width="200" height="200" fill="#1e293b" rx="8"/>
                <text x="100" y="90" text-anchor="middle" fill="#f8fafc" font-size="14" font-family="system-ui">📄 PDF</text>
                <text x="100" y="120" text-anchor="middle" fill="#94a3b8" font-size="12" font-family="system-ui">${file.name.slice(0, 20)}${file.name.length > 20 ? '...' : ''}</text>
              </svg>
            `.trim();
            
            const pdfPreview = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
            
            setAttachedImages(prev => [...prev, {
              file: new File([file], file.name, { type: 'application/pdf' }),
              preview: pdfPreview,
              pdfDataUrl: dataUrl
            }]);
          };
          reader.readAsDataURL(file);
        } catch (err) {
          console.error('Error processing PDF:', err);
        }
        continue;
      }
      
      // Handle image files
      if (!file.type.startsWith('image/')) continue;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const preview = event.target?.result as string;
        setAttachedImages(prev => [...prev, { file, preview }]);
      };
      reader.readAsDataURL(file);
    }
    
    // Reset input
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  }, []);
  
  // Handle paste event for images
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;
        
        const reader = new FileReader();
        reader.onload = (event) => {
          const preview = event.target?.result as string;
          setAttachedImages(prev => [...prev, { file, preview }]);
        };
        reader.readAsDataURL(file);
      }
    }
  }, []);
  
  // Show more messages (pagination)
  const showMoreMessages = useCallback(() => {
    setVisibleMessagesCount(prev => prev + MESSAGES_PER_PAGE);
  }, []);
  
  // Scroll to bottom of chat
  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  
  return {
    // State
    chatMessages,
    chatInput,
    attachedImages,
    aiEditing,
    isGenerating,
    visibleMessagesCount,
    dynamicSuggestions,
    
    // Refs
    chatEndRef,
    chatContainerRef,
    imageInputRef,
    wizardPromptRef,
    skipFormWizardRef,
    skipUserMessageSaveRef,
    
    // Setters
    setChatMessages,
    setChatInput,
    setAttachedImages,
    setAiEditing,
    setIsGenerating,
    setVisibleMessagesCount,
    setDynamicSuggestions,
    
    // Actions
    fetchChatHistory,
    saveMessageToDb,
    addMessage,
    addLocalMessage,
    removeAttachedImage,
    clearAttachedImages,
    handleImageSelect,
    handlePaste,
    showMoreMessages,
    scrollToBottom,
  };
}
