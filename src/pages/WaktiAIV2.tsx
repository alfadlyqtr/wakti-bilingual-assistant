import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { WaktiAIV2Service, type AIResponse, type TranscriptionResponse, type AIMessage, type AIConversation } from '@/services/WaktiAIV2Service';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
  Trash2,
  Upload,
  Camera,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatBubble } from '@/components/wakti-ai-v2/ChatBubble';
import { ConversationsList } from '@/components/wakti-ai-v2/ConversationsList';
import { QuickActionsPanel } from '@/components/wakti-ai-v2/QuickActionsPanel';
import { TypingIndicator } from '@/components/wakti-ai-v2/TypingIndicator';
import { MobileNav } from '@/components/MobileNav';
import { AppHeader } from '@/components/AppHeader';

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
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [attachedImages, setAttachedImages] = useState<File[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    initializeSystem();
  }, [language]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 140; // 5 lines max
      textarea.style.height = Math.min(scrollHeight, maxHeight) + 'px';
    }
  }, [inputMessage]);

  const initializeSystem = async () => {
    try {
      console.log('🔍 WAKTI AI V2.1: Initializing system...');
      
      // Test connection first
      const connectionTest = await WaktiAIV2Service.testConnection();
      console.log('🔍 WAKTI AI V2.1: Connection test result:', connectionTest);
      
      if (!connectionTest.success) {
        console.warn('🔍 WAKTI AI V2.1: Connection test failed:', connectionTest.error);
        // Continue anyway, but show a warning in the greeting
      }
      
      await loadConversations();
      
      if (messages.length === 0) {
        await initializeGreeting(connectionTest.success);
      }
      
      setSystemReady(true);
    } catch (error) {
      console.error('WAKTI AI V2.1: System initialization failed:', error);
      
      const errorMessage: AIMessage = {
        id: 'system-error',
        role: 'assistant',
        content: language === 'ar' 
          ? '⚠️ نظام الذكاء الاصطناعي غير متاح حالياً. يرجى المحاولة مرة أخرى.\n\nإذا استمرت المشكلة، يرجى التحقق من إعدادات API أو التواصل مع الدعم الفني.'
          : '⚠️ AI system is currently unavailable. Please try again.\n\nIf the issue persists, please check API settings or contact support.',
        timestamp: new Date()
      };
      
      setMessages([errorMessage]);
      setSystemReady(true);
    }
  };

  const initializeGreeting = async (connectionOk: boolean = true) => {
    let userName = 'there';
    try {
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, username')
          .eq('id', user.id)
          .single();
        
        userName = profile?.display_name || profile?.username || 'there';
      }
    } catch (error) {
      console.log('Could not fetch user profile for greeting');
    }

    let greeting = language === 'ar' 
      ? `مرحباً ${userName}! 👋\n\nأنا WAKTI AI V2.1، مساعدك الذكي المطور. 🚀\n\nيمكنني مساعدتك في:\n• إنشاء المهام والأحداث والتذكيرات ✅\n• إدارة جدولك اليومي 📅\n• الإجابة على أسئلتك 💬\n• تنفيذ الأوامر تلقائياً ⚡\n\nكيف يمكنني مساعدتك اليوم؟ ✨`
      : `Hello ${userName}! 👋\n\nI'm WAKTI AI V2.1, your enhanced smart assistant. 🚀\n\nI can help you with:\n• Creating tasks, events, and reminders ✅\n• Managing your daily schedule 📅\n• Answering your questions 💬\n• Executing commands automatically ⚡\n\nHow can I assist you today? ✨`;
    
    // Add connection warning if needed
    if (!connectionOk) {
      greeting += language === 'ar' 
        ? '\n\n⚠️ ملاحظة: قد تكون هناك مشاكل في الاتصال. إذا واجهت صعوبات، يرجى إعادة المحاولة لاحقاً.'
        : '\n\n⚠️ Note: There may be connection issues. If you experience difficulties, please try again later.';
    }
    
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
      setLeftDrawerOpen(false);
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
    setAttachedImages([]);
    initializeGreeting();
  };

  const clearCurrentConversation = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setAttachedImages([]);
    initializeGreeting();
    toast({
      title: language === 'ar' ? 'تم المسح' : 'Cleared',
      description: language === 'ar' ? 'تم مسح المحادثة الحالية' : 'Current conversation cleared'
    });
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

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleCameraCapture = () => {
    cameraInputRef.current?.click();
  };

  const processFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      setAttachedImages(prev => [...prev, file]);
      toast({
        title: language === 'ar' ? 'تم إرفاق الصورة' : 'Image Attached',
        description: file.name
      });
    } else {
      toast({
        title: language === 'ar' ? 'جاري الرفع' : 'Uploading',
        description: language === 'ar' ? `جاري رفع ${file.name}` : `Uploading ${file.name}`
      });
    }

    // Reset the input
    event.target.value = '';
  };

  const removeAttachedImage = (index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleTextareaKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputMessage);
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
    setAttachedImages([]);
    setIsLoading(true);
    setIsTyping(true);

    try {
      console.log('🔍 WAKTI AI V2.1: Sending message:', content.trim());
      
      const response = await WaktiAIV2Service.sendMessage(
        content.trim(),
        currentConversationId || undefined,
        language
      );

      console.log('🔍 WAKTI AI V2.1: Received response:', response);

      const assistantMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        intent: response.intent,
        confidence: response.confidence,
        actionTaken: response.actionTaken
      };

      // Add image URL if image was generated
      if (response.actionTaken === 'generate_image' && response.actionResult?.imageUrl) {
        assistantMessage.imageUrl = response.actionResult.imageUrl;
      }

      setMessages(prev => [...prev, assistantMessage]);
      
      // Only update conversation ID if we got a valid response
      if (response.conversationId && !response.conversationId.includes('error')) {
        setCurrentConversationId(response.conversationId);
        loadConversations();
      }

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
      console.error('WAKTI AI V2.1: Error sending message:', error);
      
      const errorMessage: AIMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: language === 'ar' 
          ? 'عذراً، حدث خطأ في النظام. يرجى المحاولة مرة أخرى. 🔧\n\nإذا استمرت المشكلة، يرجى التحقق من الاتصال أو إعدادات النظام.'
          : 'Sorry, there was a system error. Please try again. 🔧\n\nIf the issue persists, please check your connection or system settings.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في إرسال الرسالة - يرجى المحاولة مرة أخرى' : 'Failed to send message - please try again',
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

  console.log('🔍 DEBUG: About to render input area');

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-background to-muted/20 relative">
      {/* App Header */}
      <AppHeader />

      {/* Centered Header with Actions */}
      <div className="flex items-center justify-between p-2 border-b bg-background/80 backdrop-blur-sm relative z-40">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLeftDrawerOpen(true)}
            className="hover:scale-110 transition-transform"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Centered Action Icons */}
        <div className="flex items-center justify-center gap-2 flex-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={startNewConversation}
            className="hover:scale-110 transition-transform"
            title={language === 'ar' ? 'محادثة جديدة' : 'New conversation'}
          >
            <Plus className="h-5 w-5" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={clearCurrentConversation}
            className="hover:scale-110 transition-transform"
            title={language === 'ar' ? 'مسح المحادثة' : 'Clear conversation'}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleFileUpload}
            className="hover:scale-110 transition-transform"
            title={language === 'ar' ? 'رفع ملف' : 'Upload file'}
          >
            <Upload className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleCameraCapture}
            className="hover:scale-110 transition-transform"
            title={language === 'ar' ? 'التقاط صورة' : 'Take photo'}
          >
            <Camera className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setRightDrawerOpen(true)}
            className="hover:scale-110 transition-transform"
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={processFileUpload}
        className="hidden"
        accept="*/*"
      />
      <input
        type="file"
        ref={cameraInputRef}
        onChange={processFileUpload}
        className="hidden"
        accept="image/*"
        capture="environment"
      />

      {/* Enhanced Messages Area */}
      <ScrollArea className="flex-1 p-4 pb-40 relative z-10">
        <div className="space-y-4 max-w-4xl mx-auto">
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}
          
          {isTyping && <TypingIndicator />}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Left Drawer - Chat Archive */}
      <div className={cn(
        "fixed top-[60px] bottom-[96px] left-0 w-[320px] z-50 transition-all duration-300 ease-in-out",
        leftDrawerOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full bg-white/50 dark:bg-gray-900/50 backdrop-blur-md shadow-xl border-r border-border/50 rounded-r-xl flex flex-col">
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/30">
            <h3 className="font-semibold text-lg">
              {language === 'ar' ? 'أرشيف المحادثات' : 'Chat Archive'}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLeftDrawerOpen(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Drawer Content */}
          <div className="flex-1 p-4 overflow-y-auto">
            <ConversationsList
              conversations={conversations}
              currentConversationId={currentConversationId}
              onSelectConversation={loadConversation}
              onDeleteConversation={deleteConversation}
            />
          </div>
        </div>
      </div>

      {/* Right Drawer - Quick Actions */}
      <div className={cn(
        "fixed top-[60px] bottom-[96px] right-0 w-[320px] z-50 transition-all duration-300 ease-in-out",
        rightDrawerOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="h-full bg-white/50 dark:bg-gray-900/50 backdrop-blur-md shadow-xl border-l border-border/50 rounded-l-xl flex flex-col">
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/30">
            <h3 className="font-semibold text-lg">
              {language === 'ar' ? 'الإجراءات السريعة' : 'Quick Actions'}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRightDrawerOpen(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Drawer Content */}
          <div className="flex-1 p-4 overflow-y-auto">
            <QuickActionsPanel onSendMessage={(message) => {
              sendMessage(message);
              setRightDrawerOpen(false);
            }} />
          </div>
        </div>
      </div>

      {/* Overlay for both drawers */}
      {(leftDrawerOpen || rightDrawerOpen) && (
        <div 
          className="fixed inset-0 bg-black/10 z-40" 
          onClick={() => {
            setLeftDrawerOpen(false);
            setRightDrawerOpen(false);
          }}
        />
      )}

      {/* Enhanced Fixed Input Area - Mobile Optimized */}
      <div className="fixed bottom-[72px] left-0 right-0 z-[65] p-4">
        <div className="max-w-4xl mx-auto">
          {/* Image Attachments Preview */}
          {attachedImages.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {attachedImages.map((image, index) => (
                <div key={index} className="relative">
                  <img
                    src={URL.createObjectURL(image)}
                    alt={`Attachment ${index + 1}`}
                    className="w-16 h-16 object-cover rounded-lg border-2 border-border"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => removeAttachedImage(index)}
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Input Container */}
          <div className="bg-background/95 backdrop-blur-md border border-border/50 rounded-2xl shadow-xl p-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleTextareaKeyPress}
                  placeholder={language === 'ar' ? 'اكتب رسالتك أو استخدم الصوت...' : 'Type your message or use voice...'}
                  disabled={isLoading}
                  className={cn(
                    "border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base resize-none min-h-[44px] max-h-[140px] overflow-y-auto",
                    language === 'ar' ? 'text-right' : ''
                  )}
                  rows={1}
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
                  "shrink-0 h-11 w-11 rounded-xl transition-all duration-200",
                  isRecording 
                    ? "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400 scale-105" 
                    : "hover:bg-muted"
                )}
              >
                {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              
              <Button
                onClick={() => sendMessage(inputMessage)}
                disabled={!inputMessage.trim() || isLoading}
                size="icon"
                className="shrink-0 h-11 w-11 rounded-xl transition-all duration-200 hover:scale-105"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <MobileNav />
    </div>
  );
}
