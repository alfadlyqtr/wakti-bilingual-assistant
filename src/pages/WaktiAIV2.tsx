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
  X,
  Square,
  Search,
  CheckCircle,
  Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatBubble } from '@/components/wakti-ai-v2/ChatBubble';
import { ConversationsList } from '@/components/wakti-ai-v2/ConversationsList';
import { QuickActionsPanel } from '@/components/wakti-ai-v2/QuickActionsPanel';
import { KnowledgeModal } from '@/components/wakti-ai-v2/KnowledgeModal';
import { TypingIndicator } from '@/components/wakti-ai-v2/TypingIndicator';
import { MobileNav } from '@/components/MobileNav';
import { AppHeader } from '@/components/AppHeader';

// Add trigger types
type TriggerMode = 'chat' | 'search' | 'advanced_search' | 'image';

export default function WaktiAIV2() {
  const { user } = useAuth();
  const { theme, language } = useTheme();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [systemReady, setSystemReady] = useState(true);
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [knowledgeModalOpen, setKnowledgeModalOpen] = useState(false);
  const [attachedImages, setAttachedImages] = useState<File[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [browsingSources, setBrowsingSources] = useState<any[]>([]);
  const [quotaStatus, setQuotaStatus] = useState<any>(null);

  // Add trigger state
  const [activeTrigger, setActiveTrigger] = useState<TriggerMode>('chat');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const MAX_RECORDING_TIME = 45; // 45 seconds

  // Helper function to detect language from text input
  const detectLanguage = (text: string): 'en' | 'ar' => {
    // Check for Arabic characters using Unicode range
    const hasArabicChars = /[\u0600-\u06FF]/.test(text);
    return hasArabicChars ? 'ar' : 'en';
  };

  // Helper function to get trigger mode display name
  const getTriggerModeDisplay = (mode: TriggerMode): string => {
    switch (mode) {
      case 'chat':
        return language === 'ar' ? 'محادثة' : 'Chat';
      case 'search':
        return language === 'ar' ? 'بحث' : 'Search';
      case 'advanced_search':
        return language === 'ar' ? 'بحث متقدم' : 'Advanced Search';
      case 'image':
        return language === 'ar' ? 'صورة' : 'Image';
      default:
        return language === 'ar' ? 'محادثة' : 'Chat';
    }
  };

  // Helper function to get trigger mode color
  const getTriggerModeColor = (mode: TriggerMode): string => {
    switch (mode) {
      case 'chat':
        return 'bg-blue-500';
      case 'search':
        return 'bg-green-500';
      case 'advanced_search':
        return 'bg-purple-500';
      case 'image':
        return 'bg-orange-500';
      default:
        return 'bg-blue-500';
    }
  };

  // Handle trigger mode change
  const handleTriggerChange = (newTrigger: TriggerMode) => {
    setActiveTrigger(newTrigger);
    toast({
      title: language === 'ar' ? 'تم تغيير الوضع' : 'Mode Changed',
      description: `${language === 'ar' ? 'الوضع النشط:' : 'Active mode:'} ${getTriggerModeDisplay(newTrigger)}`,
      duration: 2000
    });
  };

  // Reset trigger to chat mode on page reload
  useEffect(() => {
    setActiveTrigger('chat');
  }, []);

  // Debug: Log component mount
  useEffect(() => {
    console.log('🔍 WAKTI AI: Component mounted');
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

  // Cleanup recording timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const initializeSystem = async () => {
    try {
      console.log('🔍 WAKTI AI: Initializing system...');
      
      // Show greeting immediately - no waiting!
      if (messages.length === 0) {
        initializeGreeting();
      }
      
      // Load conversations
      await loadConversations();
      
      // Run connection test in background (don't await it)
      backgroundConnectionTest();
      
      setSystemReady(true);
    } catch (error) {
      console.error('WAKTI AI: System initialization failed:', error);
      setSystemReady(true);
    }
  };

  const backgroundConnectionTest = async () => {
    try {
      console.log('🔍 WAKTI AI: Running background connection test...');
      const connectionTest = await WaktiAIV2Service.testConnection();
      console.log('🔍 WAKTI AI: Background connection test result:', connectionTest);
      
      if (!connectionTest.success) {
        console.warn('🔍 WAKTI AI: Background connection test failed:', connectionTest.error);
        // Optionally show a subtle warning toast, but don't block the UI
        toast({
          title: language === 'ar' ? 'تحذير' : 'Warning',
          description: language === 'ar' 
            ? 'قد تكون هناك مشاكل في الاتصال'
            : 'There may be connection issues',
          variant: 'default',
          duration: 3000
        });
      }
    } catch (error) {
      console.error('WAKTI AI: Background connection test error:', error);
    }
  };

  const initializeGreeting = () => {
    // Simple, fast greeting without any async calls
    const greeting = language === 'ar' 
      ? 'مرحباً! أنا WAKTI AI. كيف يمكنني مساعدتك اليوم؟'
      : 'Hello! I\'m WAKTI AI. How can I help you today?';
    
    const greetingMessage: AIMessage = {
      id: 'greeting-wakti-ai',
      role: 'assistant',
      content: greeting,
      timestamp: new Date()
    };
    
    setMessages([greetingMessage]);
    console.log('🔍 WAKTI AI: Greeting shown instantly');
  };

  const loadConversations = async () => {
    try {
      const data = await WaktiAIV2Service.getConversations();
      setConversations(data);
      console.log('🔍 WAKTI AI: Loaded conversations:', data.length);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadConversation = async (conversationId: string) => {
    try {
      setIsLoading(true);
      const data = await WaktiAIV2Service.getConversationMessages(conversationId);
      const convertedMessages: AIMessage[] = data.map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: msg.timestamp,
        intent: msg.intent,
        confidence: msg.confidence,
        actionTaken: msg.actionTaken,
        inputType: msg.inputType
      }));
      setMessages(convertedMessages);
      setCurrentConversationId(conversationId);
      setLeftDrawerOpen(false);
      console.log('🔍 WAKTI AI: Loaded conversation messages:', data.length);
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
    setBrowsingSources([]);
    setQuotaStatus(null);
    setActiveTrigger('chat'); // Reset trigger to chat mode
    initializeGreeting();
    console.log('🔍 WAKTI AI: Started new conversation');
  };

  const clearCurrentConversation = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setAttachedImages([]);
    setBrowsingSources([]);
    setQuotaStatus(null);
    setActiveTrigger('chat'); // Reset trigger to chat mode
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

    // Ensure user is authenticated
    if (!user?.id) {
      console.error('🔍 WAKTI AI: No authenticated user found');
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'يجب تسجيل الدخول أولاً' : 'Please log in first',
        variant: 'destructive'
      });
      return;
    }

    // Detect language from user input content
    const detectedLanguage = detectLanguage(content.trim());
    
    console.log('🔍 WAKTI AI: Language detection:', {
      originalContent: content.trim(),
      detectedLanguage,
      themeLanguage: language,
      activeTrigger
    });

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
      console.log('🔍 WAKTI AI: Sending message:', content.trim());
      
      // Get session with detailed logging
      const { data: session } = await supabase.auth.getSession();
      console.log('🔍 WAKTI AI: Session check:', !!session?.session);
      
      if (!session?.session) {
        throw new Error('No active session found');
      }

      console.log('🔍 WAKTI AI: Calling unified-ai-brain function via WaktiAIV2Service...');
      
      // Call the service with active trigger
      const result = await WaktiAIV2Service.sendMessageWithTrigger(
        content.trim(), 
        currentConversationId, 
        detectedLanguage, 
        inputType,
        activeTrigger
      );

      console.log('🔍 WAKTI AI: Service response received:', result);

      const assistantMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.response,
        timestamp: new Date(),
        intent: result.intent,
        confidence: result.confidence,
        browsingUsed: result.browsingUsed,
        browsingData: result.browsingData,
        quotaStatus: result.quotaStatus,
        requiresSearchConfirmation: result.requiresSearchConfirmation,
        imageUrl: result.imageUrl
      };

      console.log('🔍 WAKTI AI: Assistant message created:', assistantMessage);

      setMessages(prev => [...prev, assistantMessage]);

      // Update quota status and sources
      if (result.quotaStatus) {
        setQuotaStatus(result.quotaStatus);
      }

      if (result.browsingData?.sources) {
        setBrowsingSources(result.browsingData.sources);
      }

      // Update conversation ID if this was a new conversation
      if (!currentConversationId && result.conversationId) {
        setCurrentConversationId(result.conversationId);
        // Reload conversations list
        loadConversations();
      }

      console.log('🔍 WAKTI AI: Message processing completed successfully');

    } catch (error) {
      console.error('WAKTI AI: Error sending message:', error);
      
      // Enhanced error handling with specific error types
      let errorMessage = language === 'ar' 
        ? 'عذراً، حدث خطأ في النظام. يرجى المحاولة مرة أخرى. 🔧'
        : 'Sorry, there was a system error. Please try again. 🔧';

      if (error.message?.includes('session')) {
        errorMessage = language === 'ar'
          ? 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.'
          : 'Session expired. Please log in again.';
      } else if (error.message?.includes('Invalid JSON')) {
        errorMessage = language === 'ar'
          ? 'خطأ في تنسيق البيانات. يرجى إعادة تحميل الصفحة والمحاولة مرة أخرى.'
          : 'Data format error. Please refresh the page and try again.';
      }
      
      const errorAIMessage: AIMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorAIMessage]);
      
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في الاتصال مع النظام' : 'Failed to connect to system',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
      setIsTyping(false);
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

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = async () => {
    try {
      if (textareaRef.current) {
        textareaRef.current.blur();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setRecordingTime(0);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processVoiceInput(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_RECORDING_TIME - 1) {
            stopRecording();
            return MAX_RECORDING_TIME;
          }
          return prev + 1;
        });
      }, 1000);

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
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const processVoiceInput = async (audioBlob: Blob) => {
    try {
      setIsTranscribing(true);
      
      console.log('🎤 WAKTI AI: Processing voice input, blob size:', audioBlob.size);

      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session found');
      }

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('audioBlob', audioBlob, 'audio.webm');
      formData.append('language', language);

      console.log('🎤 WAKTI AI: Uploading audio blob to wakti-voice-v2...');

      // Use direct fetch instead of supabase.functions.invoke() for FormData
      const response = await fetch('https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/wakti-voice-v2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData
      });

      console.log('🎤 WAKTI AI: Voice transcription response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🎤 WAKTI AI: Voice transcription error:', errorText);
        throw new Error(`Voice transcription failed: ${errorText}`);
      }

      const result = await response.json();
      console.log('🎤 WAKTI AI: Voice transcription result:', result);

      const { text } = result;
      
      if (text && text.trim()) {
        // Insert transcription into input field instead of auto-sending
        setInputMessage(text.trim());
        
        // Focus back on textarea and expand it
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            // Move cursor to end
            const length = text.trim().length;
            textareaRef.current.setSelectionRange(length, length);
          }
        }, 100);

        // Show subtle feedback
        toast({
          title: language === 'ar' ? '✅ تم النسخ' : '✅ Transcribed',
          description: language === 'ar' ? 'تم إضافة النص - اضغط إرسال أو قم بالتعديل' : 'Text added — tap send or edit',
          duration: 3000
        });
      } else {
        throw new Error('No transcription received');
      }
    } catch (error) {
      console.error('🎤 WAKTI AI: Error processing voice input:', error);
      toast({
        title: language === 'ar' ? 'خطأ في الصوت' : 'Voice Error',
        description: language === 'ar' ? 'فشل في معالجة الصوت - يرجى المحاولة مرة أخرى' : 'Failed to process voice input - please try again',
        variant: 'destructive'
      });
    } finally {
      setIsTranscribing(false);
      setRecordingTime(0);
    }
  };

  const handleSearchConfirmation = async (messageContent: string) => {
    if (!user?.id) {
      console.error('🔍 WAKTI AI: No authenticated user for search confirmation');
      return;
    }

    setIsLoading(true);
    setIsTyping(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        throw new Error('No active session found');
      }

      // Use the service which now calls unified-ai-brain
      const result = await WaktiAIV2Service.sendMessageWithSearchConfirmation(messageContent, currentConversationId, language, 'text');

      const assistantMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.response,
        timestamp: new Date(),
        intent: result.intent,
        confidence: result.confidence,
        browsingUsed: result.browsingUsed,
        browsingData: result.browsingData,
        quotaStatus: result.quotaStatus
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (result.browsingUsed) {
        toast({
          title: language === 'ar' ? '✅ تم البحث' : '✅ Search Complete',
          description: language === 'ar' ? 'تم الحصول على النتائج' : 'Results retrieved',
          duration: 3000
        });
      }

    } catch (error) {
      console.error('Search confirmation error:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في البحث' : 'Search failed',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const remainingTime = MAX_RECORDING_TIME - seconds;
    const mins = Math.floor(remainingTime / 60);
    const secs = remainingTime % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  console.log('🔍 DEBUG: About to render input area');

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-background to-muted/20 relative">
      {/* App Header */}
      <AppHeader />

      {/* Header - Updated layout */}
      <div className="flex items-center justify-between p-2 border-b bg-background/80 backdrop-blur-sm relative z-30">
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
        
        {/* Centered Mode Indicator */}
        <div className="flex items-center justify-center gap-2 flex-1">
          <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded-full text-xs">
            <div className={cn("w-2 h-2 rounded-full", getTriggerModeColor(activeTrigger))}></div>
            <span className="font-medium text-xs">
              {getTriggerModeDisplay(activeTrigger)}
            </span>
          </div>

          {/* Search Quota Indicator - Only show in Search mode */}
          {quotaStatus && activeTrigger === 'search' && (
            <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded-full text-xs">
              <Globe className="h-3 w-3" />
              <span className={cn(
                "font-medium",
                quotaStatus.usagePercentage >= 80 ? "text-orange-600" : "text-green-600"
              )}>
                {quotaStatus.count}/{quotaStatus.limit}
              </span>
            </div>
          )}
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

      {/* Enhanced Messages Area with Search Confirmation */}
      <ScrollArea className="flex-1 p-4 pb-40 relative z-10">
        <div className="space-y-4 max-w-4xl mx-auto">
          {messages.map((message) => (
            <ChatBubble 
              key={message.id} 
              message={message} 
              onSearchConfirm={handleSearchConfirmation}
              activeTrigger={activeTrigger}
            />
          ))}
          
          {isTyping && <TypingIndicator />}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Left Drawer - Chat Archive with + icon moved here */}
      <div className={cn(
        "fixed top-[60px] bottom-[96px] left-0 w-[320px] z-40 transition-all duration-300 ease-in-out",
        leftDrawerOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full bg-white/50 dark:bg-gray-900/50 backdrop-blur-md shadow-xl border-r border-border/50 rounded-r-xl flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border/30">
            <h3 className="font-semibold text-lg">
              {language === 'ar' ? 'أرشيف المحادثات' : 'Chat Archive'}
            </h3>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={startNewConversation}
                className="h-8 w-8 hover:scale-110 transition-transform"
                title={language === 'ar' ? 'محادثة جديدة' : 'New conversation'}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLeftDrawerOpen(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto">
            <ConversationsList
              conversations={conversations}
              currentConversationId={currentConversationId}
              onSelectConversation={loadConversation}
              onDeleteConversation={deleteConversation}
              onRefresh={loadConversations}
            />
          </div>
        </div>
      </div>

      {/* Right Drawer - Quick Actions with Trigger Controls */}
      <div className={cn(
        "fixed top-[60px] bottom-[96px] right-0 w-[320px] z-40 transition-all duration-300 ease-in-out",
        rightDrawerOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="h-full bg-white/50 dark:bg-gray-900/50 backdrop-blur-md shadow-xl border-l border-border/50 rounded-l-xl flex flex-col">
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
          
          <div className="flex-1 p-4 overflow-y-auto">
            <QuickActionsPanel 
              onSendMessage={(message) => {
                sendMessage(message);
                setRightDrawerOpen(false);
              }}
              activeTrigger={activeTrigger}
              onTriggerChange={handleTriggerChange}
            />
          </div>
        </div>
      </div>

      {/* Enhanced Knowledge Modal */}
      <KnowledgeModal 
        open={knowledgeModalOpen} 
        onOpenChange={setKnowledgeModalOpen} 
      />

      {/* Overlay for both drawers */}
      {(leftDrawerOpen || rightDrawerOpen) && (
        <div 
          className="fixed inset-0 bg-black/10 z-35" 
          onClick={() => {
            setLeftDrawerOpen(false);
            setRightDrawerOpen(false);
          }}
        />
      )}

      {/* Enhanced Fixed Input Area with Voice Recording and Camera - Combined Upload/Camera */}
      <div className="fixed bottom-[84px] left-0 right-0 z-30 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Recording Timer Display */}
          {isRecording && (
            <div className="mb-3 flex items-center justify-center">
              <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-red-600 dark:text-red-400 font-mono text-sm">
                    {language === 'ar' ? 'تسجيل' : 'Recording'} {formatRecordingTime(recordingTime)}
                  </span>
                </div>
                <div className="flex-1 bg-red-200 dark:bg-red-800 rounded-full h-1">
                  <div 
                    className="bg-red-500 h-1 rounded-full transition-all duration-1000"
                    style={{ width: `${(recordingTime / MAX_RECORDING_TIME) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}

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
                  disabled={isLoading || isRecording || isTranscribing}
                  className={cn(
                    "border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base resize-none min-h-[44px] max-h-[140px] overflow-y-auto",
                    language === 'ar' ? 'text-right' : ''
                  )}
                  rows={1}
                />
              </div>
              
              {/* Combined Upload/Camera Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleFileUpload}
                disabled={isLoading || isRecording || isTranscribing}
                className="shrink-0 h-11 w-11 rounded-xl transition-all duration-200 hover:bg-muted"
                title={language === 'ar' ? 'رفع ملف أو التقاط صورة' : 'Upload file or take photo'}
              >
                <Upload className="h-5 w-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleRecording}
                disabled={isLoading || isTranscribing}
                className={cn(
                  "shrink-0 h-11 w-11 rounded-xl transition-all duration-200",
                  isRecording 
                    ? "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400 scale-105" 
                    : "hover:bg-muted",
                  isTranscribing && "opacity-50"
                )}
              >
                {isTranscribing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isRecording ? (
                  <Square className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </Button>
              
              <Button
                onClick={() => sendMessage(inputMessage)}
                disabled={!inputMessage.trim() || isLoading || isRecording || isTranscribing}
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
