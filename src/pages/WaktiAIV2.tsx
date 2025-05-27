import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { WaktiAIV2Service, type AIResponse, type TranscriptionResponse, type AIMessage, type AIConversation } from '@/services/WaktiAIV2Service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import { 
  Mic, 
  MicOff, 
  Send, 
  Menu, 
  MessageSquare, 
  Plus,
  Loader2,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatBubble } from '@/components/wakti-ai-v2/ChatBubble';
import { ConversationsList } from '@/components/wakti-ai-v2/ConversationsList';
import { QuickActionsPanel } from '@/components/wakti-ai-v2/QuickActionsPanel';
import { TypingIndicator } from '@/components/wakti-ai-v2/TypingIndicator';

export default function WaktiAIV2() {
  const { user } = useAuth();
  const { theme, language } = useTheme();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [systemReady, setSystemReady] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Debug: Log component mount
  useEffect(() => {
    console.log('🔍 WAKTI AI V2.1: Component mounted');
    console.log('🔍 User:', user?.id);
    console.log('🔍 Language:', language);
    console.log('🔍 System Ready:', systemReady);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (user) {
      initializeSystem();
    }
  }, [user, language]);

  const initializeSystem = async () => {
    try {
      await loadConversations();
      
      if (messages.length === 0) {
        await initializeGreeting();
      }
      
      setSystemReady(true);
    } catch (error) {
      console.error('WAKTI AI V2.1: System initialization failed:', error);
      
      const errorMessage: AIMessage = {
        id: 'system-error',
        role: 'assistant',
        content: language === 'ar' 
          ? '⚠️ نظام الذكاء الاصطناعي غير متاح حالياً. يرجى المحاولة مرة أخرى.'
          : '⚠️ AI system is currently unavailable. Please try again.',
        timestamp: new Date()
      };
      
      setMessages([errorMessage]);
      setSystemReady(true);
    }
  };

  const initializeGreeting = async () => {
    let userName = 'there';
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, username')
        .eq('id', user?.id)
        .single();
      
      userName = profile?.display_name || profile?.username || 'there';
    } catch (error) {
      console.log('Could not fetch user profile for greeting');
    }

    const greeting = language === 'ar' 
      ? `مرحباً ${userName}! 👋\n\nأنا WAKTI AI V2.1، مساعدك الذكي المطور. 🚀\n\nيمكنني مساعدتك في:\n• إنشاء المهام والأحداث والتذكيرات ✅\n• إدارة جدولك اليومي 📅\n• الإجابة على أسئلتك 💬\n• تنفيذ الأوامر تلقائياً ⚡\n\nكيف يمكنني مساعدتك اليوم؟ ✨`
      : `Hello ${userName}! 👋\n\nI'm WAKTI AI V2.1, your enhanced smart assistant. 🚀\n\nI can help you with:\n• Creating tasks, events, and reminders ✅\n• Managing your daily schedule 📅\n• Answering your questions 💬\n• Executing commands automatically ⚡\n\nHow can I assist you today? ✨`;
    
    const greetingMessage: AIMessage = {
      id: 'greeting-v2-1',
      role: 'assistant',
      content: greeting,
      timestamp: new Date()
    };
    
    setMessages([greetingMessage]);
  };

  const loadConversations = async () => {
    try {
      const data = await WaktiAIV2Service.getConversations();
      setConversations(data);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadConversation = async (conversationId: string) => {
    try {
      setIsLoading(true);
      const data = await WaktiAIV2Service.getConversationMessages(conversationId);
      setMessages(data);
      setCurrentConversationId(conversationId);
    } catch (error) {
      console.error('Error loading conversation:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في تحميل المحادثة' : 'Failed to load conversation',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(null);
    initializeGreeting();
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      await WaktiAIV2Service.deleteConversation(conversationId);
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      
      if (currentConversationId === conversationId) {
        startNewConversation();
      }

      toast({
        title: language === 'ar' ? 'تم الحذف' : 'Deleted',
        description: language === 'ar' ? 'تم حذف المحادثة بنجاح' : 'Conversation deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في حذف المحادثة' : 'Failed to delete conversation',
        variant: 'destructive'
      });
    }
  };

  const sendMessage = async (content: string, inputType: 'text' | 'voice' = 'text') => {
    if (!content.trim() || isLoading) return;

    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      inputType
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      const response = await WaktiAIV2Service.sendMessage(
        content.trim(),
        currentConversationId || undefined,
        language
      );

      const assistantMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        intent: response.intent,
        confidence: response.confidence,
        actionTaken: response.actionTaken
      };

      setMessages(prev => [...prev, assistantMessage]);
      setCurrentConversationId(response.conversationId);
      
      loadConversations();

      if (response.actionTaken) {
        const actionLabels = {
          create_task: language === 'ar' ? 'تم إنشاء المهمة' : 'Task Created',
          create_event: language === 'ar' ? 'تم إنشاء الحدث' : 'Event Created',
          create_reminder: language === 'ar' ? 'تم إنشاء التذكير' : 'Reminder Created',
          generate_image: language === 'ar' ? 'تم إنشاء الصورة' : 'Image Generated'
        };
        
        const confidenceIcons = {
          high: '⚡',
          medium: '⏳',
          low: '❓'
        };
        
        toast({
          title: language === 'ar' ? '✅ تم التنفيذ' : '✅ Action Completed',
          description: `${confidenceIcons[response.confidence]} ${actionLabels[response.actionTaken as keyof typeof actionLabels] || response.actionTaken}`
        });
      }

      if (response.needsConfirmation) {
        toast({
          title: language === 'ar' ? '⏳ تأكيد مطلوب' : '⏳ Confirmation Required',
          description: language === 'ar' ? 'يرجى تأكيد الإجراء' : 'Please confirm the action'
        });
      }

      if (response.needsClarification) {
        toast({
          title: language === 'ar' ? '❓ توضيح مطلوب' : '❓ Clarification Needed',
          description: language === 'ar' ? 'يرجى توضيح طلبك' : 'Please clarify your request'
        });
      }

    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: AIMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: language === 'ar' 
          ? 'عذراً، حدث خطأ في النظام. يرجى المحاولة مرة أخرى. 🔧'
          : 'Sorry, there was a system error. Please try again. 🔧',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في إرسال الرسالة' : 'Failed to send message',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processVoiceInput(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في بدء التسجيل' : 'Failed to start recording',
        variant: 'destructive'
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processVoiceInput = async (audioBlob: Blob) => {
    try {
      setIsLoading(true);
      
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('');
      const base64Audio = btoa(binaryString);

      const transcription = await WaktiAIV2Service.transcribeVoice(
        base64Audio,
        language
      );

      if (transcription.text && transcription.text.trim()) {
        await sendMessage(transcription.text, 'voice');
      } else {
        throw new Error('No transcription received');
      }
    } catch (error) {
      console.error('Error processing voice input:', error);
      toast({
        title: language === 'ar' ? 'خطأ في الصوت' : 'Voice Error',
        description: language === 'ar' ? 'فشل في معالجة الصوت' : 'Failed to process voice input',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const retryLastMessage = () => {
    if (messages.length >= 2) {
      const lastUserMessage = messages[messages.length - 2];
      if (lastUserMessage.role === 'user') {
        sendMessage(lastUserMessage.content, lastUserMessage.inputType);
      }
    }
  };

  // Debug: Log render
  console.log('🔍 WAKTI AI V2.1: Rendering component', {
    messagesCount: messages.length,
    isLoading,
    systemReady,
    inputMessage
  });

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-background to-muted/20">
      {/* Enhanced Header with System Status */}
      <div className="flex items-center justify-between p-4 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="hover:scale-110 transition-transform">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80">
              <ConversationsList
                conversations={conversations}
                currentConversationId={currentConversationId}
                onSelectConversation={loadConversation}
                onDeleteConversation={deleteConversation}
              />
            </SheetContent>
          </Sheet>
          
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-2 rounded-lg bg-gradient-to-r transition-all duration-300",
              systemReady ? "from-blue-500 to-purple-600" : "from-gray-400 to-gray-500"
            )}>
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  WAKTI AI V2.1
                </h1>
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  systemReady ? "bg-green-500" : "bg-red-500"
                )} />
              </div>
              <p className="text-xs text-muted-foreground">
                {language === 'ar' ? 'المساعد الذكي المطور' : 'Enhanced Smart Assistant'}
                {!systemReady && (language === 'ar' ? ' • غير متصل' : ' • Offline')}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={retryLastMessage}
            disabled={isLoading || messages.length < 2}
            className="hover:scale-110 transition-transform"
          >
            <RefreshCw className="h-5 w-5" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={startNewConversation}
            className="hover:scale-110 transition-transform"
          >
            <Plus className="h-5 w-5" />
          </Button>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="hover:scale-110 transition-transform">
                <MessageSquare className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <QuickActionsPanel onSendMessage={sendMessage} />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Enhanced Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-4xl mx-auto">
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}
          
          {isTyping && <TypingIndicator />}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Clean Professional Input Area */}
      <div className="sticky bottom-0 z-50 border-t bg-background/90 backdrop-blur-md p-4">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <div className="flex-1 relative">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={language === 'ar' ? 'اكتب رسالتك أو استخدم الصوت...' : 'Type your message or use voice...'}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(inputMessage);
                }
              }}
              disabled={isLoading}
              className={cn(
                "pr-4 transition-all duration-200 focus:ring-2 focus:ring-primary/20 h-12 text-lg border-border/50 bg-background/80",
                language === 'ar' ? 'text-right' : ''
              )}
            />
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            disabled={isLoading}
            className={cn(
              "transition-all duration-200 hover:scale-110 h-12 w-12 border-border/50",
              isRecording && "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400 scale-110"
            )}
          >
            {isRecording ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>
          
          <Button
            onClick={() => sendMessage(inputMessage)}
            disabled={!inputMessage.trim() || isLoading}
            size="icon"
            className="hover:scale-110 transition-transform h-12 w-12"
          >
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Send className="h-6 w-6" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
