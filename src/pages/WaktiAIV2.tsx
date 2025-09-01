import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToastHelper } from "@/hooks/use-toast-helper";
import { PersonalTouchManager } from '@/components/wakti-ai-v2/PersonalTouchManager';
import { FileUploader } from '@/components/wakti-ai-v2/FileUploader';
import { AIMessage, WaktiAIV2Service } from '@/services/WaktiAIV2Service';
import { Send, Paperclip, Loader2 } from 'lucide-react';

interface PersonalTouchData {
  nickname: string;
  tone: string;
  style: string;
  instruction: string;
  aiNickname?: string;
  pt_version?: number;
  pt_updated_at?: string;
}

type ChatMessage = AIMessage & { isError?: boolean };

const FRONTEND_MEMORY_KEY = "wakti_frontend_memory";
const PERSONAL_TOUCH_KEY = "wakti_personal_touch";

export default function WaktiAIV2() {
  const { language, theme } = useTheme();
  const { showSuccess } = useToastHelper();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<any[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversationMemory, setConversationMemory] = useState<any[]>([]);
  const [personalTouch, setPersonalTouch] = useState<PersonalTouchData | null>(null);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadPersonalTouch = () => {
    try {
      const stored = localStorage.getItem(PERSONAL_TOUCH_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPersonalTouch(parsed);
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to load Personal Touch:', e);
    }
    return null;
  };

  const loadFrontendMemory = () => {
    try {
      const stored = sessionStorage.getItem(FRONTEND_MEMORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
          setConversationMemory(parsed.map((m: any) => ({ role: m.role, content: m.content })));
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load frontend memory:', e);
    }
    return [];
  };

  const saveFrontendMemory = (msgs: ChatMessage[]) => {
    try {
      sessionStorage.setItem(FRONTEND_MEMORY_KEY, JSON.stringify(msgs));
    } catch (e) {
      console.warn('Failed to save frontend memory:', e);
    }
  };

  useEffect(() => {
    loadFrontendMemory();
    const initialTouch = loadPersonalTouch();
    if (initialTouch) {
      setPersonalTouch(initialTouch);
    }
  }, []);

  useEffect(() => {
    const handlePersonalTouchUpdate = (event: CustomEvent<PersonalTouchData>) => {
      console.log('🧩 PT_EVENT:', event.detail);
      setPersonalTouch(event.detail);
    };
    window.addEventListener('wakti-personal-touch-updated', handlePersonalTouchUpdate as any);
    return () => {
      window.removeEventListener('wakti-personal-touch-updated', handlePersonalTouchUpdate as any);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, currentResponse, isTyping]);

  const handleSendMessage = () => {
    sendStreamingMessage(newMessage, 'chat', attachedFiles);
    setNewMessage('');
    setAttachedFiles([]);
    if (inputRef.current) {
      inputRef.current.style.height = 'inherit';
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileUpload = (files: File[]) => {
    if (!files || files.length === 0) return;

    setIsLoading(true);
    Promise.all(
      Array.from(files).map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
        return {
          name: file.name,
          type: file.type,
          size: file.size,
          content: base64
        };
      })
    )
    .then(results => {
      setAttachedFiles(results);
      setIsLoading(false);
      showSuccess(language === 'ar' ? 'تم تحميل الملفات!' : 'Files uploaded!');
    })
    .catch(error => {
      console.error('File upload error:', error);
      setIsLoading(false);
    });
  };

  const handleTextAreaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = event.target;
    textarea.style.height = 'inherit';
    textarea.style.height = `${textarea.scrollHeight}px`;
    setNewMessage(textarea.value);
  };

  const sendStreamingMessage = async (
    userMessage: string,
    activeTrigger = 'chat',
    files: any[] = []
  ) => {
    if (!userMessage.trim() && !files?.length) return;

    setIsLoading(true);
    setCurrentResponse('');
    setIsTyping(true);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
      attachedFiles: files?.map(f => ({ name: f.name, type: f.type, size: f.size })) || []
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    if (personalTouch) {
      console.log('🎯 STRICT PT ACTIVE:', {
        nickname: personalTouch.nickname || 'none',
        tone: personalTouch.tone || 'neutral',
        style: personalTouch.style || 'short answers',
        aiNickname: personalTouch.aiNickname || 'none',
        instruction: personalTouch.instruction ? 'yes' : 'no'
      });
    } else {
      console.log('⚠️ NO PERSONAL TOUCH LOADED');
    }

    try {
      const result = await WaktiAIV2Service.sendStreamingMessage(
        userMessage,                        // message
        undefined,                          // userId (auto from session)
        language,                           // language
        currentConversationId,              // conversationId
        files?.some(f => f?.type?.startsWith('image/')) ? 'vision' : 'text', // inputType
        conversationMemory.slice(-20) as AIMessage[], // recentMessages
        false,                              // skipContextLoad
        activeTrigger,                      // activeTrigger
        '',                                 // conversationSummary (service builds)
        files,                               // attachedFiles
        (token) => {
          setCurrentResponse(prev => prev + token);
        },
        (metadata) => {
          console.log('🔥 DEBUG: Chat streaming onComplete called');
        },
        (error) => {
          console.error('❌ STREAM ERROR:', error);
        }
      );

      const accumulatedResponse = (result?.response || '').trim();

      if (accumulatedResponse) {
        const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: accumulatedResponse,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, aiMsg]);

        setConversationMemory(prev => [
          ...prev,
          { role: 'user', content: userMessage },
          { role: 'assistant', content: accumulatedResponse }
        ]);

        saveFrontendMemory([...updatedMessages, aiMsg]);
      }

    } catch (error) {
      console.error('❌ STREAMING ERROR:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: language === 'ar' 
          ? 'عذراً، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.'
          : 'Sorry, there was an error processing your request. Please try again.',
        timestamp: new Date(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
      setCurrentResponse('');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black text-slate-800 dark:text-slate-200">
      {/* Header */}
      <div className="border-b border-white/20 dark:border-white/10 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar>
            <AvatarImage src="/wakti-logo-square.png" />
            <AvatarFallback>WK</AvatarFallback>
          </Avatar>
          <h1 className="text-lg font-semibold">Wakti AI V2</h1>
        </div>
        <div className="flex items-center gap-4">
          <PersonalTouchManager />
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 flex flex-col gap-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-2xl rounded-lg p-3 text-sm break-words ${msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/20 dark:bg-black/20'
                  }`}>
                  {msg.content}
                  {msg.attachedFiles && msg.attachedFiles.length > 0 && (
                    <div className="mt-2">
                      {msg.attachedFiles.map((file: any, index: number) => (
                        <div key={index} className="text-xs text-slate-400">
                          {file.name} ({file.type}, {file.size} bytes)
                        </div>
                      ))}
                    </div>
                  )}
                  {msg.isError && (
                    <div className="mt-2 text-red-500 text-xs">
                      {language === 'ar' ? 'حدث خطأ' : 'An error occurred'}
                    </div>
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {msg.timestamp?.toLocaleTimeString()}
                </div>
              </div>
            ))}
            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex items-start">
                <div className="max-w-2xl rounded-lg p-3 text-sm bg-white/20 dark:bg-black/20">
                  {language === 'ar' ? 'يكتب...' : 'Typing...'}
                </div>
              </div>
            )}
            {/* Current Response (for streaming) */}
            {currentResponse && (
              <div className="flex items-start">
                <div className="max-w-2xl rounded-lg p-3 text-sm bg-white/20 dark:bg-black/20">
                  {currentResponse}
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/20 dark:border-white/10">
        <div className="flex items-center gap-2">
          <FileUploader onFileUpload={handleFileUpload} isLoading={isLoading} />
          <Textarea
            ref={inputRef}
            rows={1}
            value={newMessage}
            onChange={handleTextAreaChange}
            onKeyDown={handleKeyDown}
            placeholder={language === 'ar' ? 'اكتب رسالتك هنا...' : 'Type your message here...'}
            className="resize-none flex-1 bg-white/10 dark:bg-black/10 border-white/20 dark:border-white/10 text-sm"
            disabled={isLoading}
          />
          <Button onClick={handleSendMessage} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {language === 'ar' ? 'إرسال' : 'Send'}
          </Button>
        </div>
        {attachedFiles.length > 0 && (
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {language === 'ar' ? 'الملفات المرفقة:' : 'Attached Files:'}
            {attachedFiles.map((file, index) => (
              <div key={index}>
                {file.name} ({file.type}, {file.size} bytes)
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
