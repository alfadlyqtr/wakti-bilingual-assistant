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
  Globe,
  User,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatBubble } from '@/components/wakti-ai-v2/ChatBubble';
import { ConversationsList } from '@/components/wakti-ai-v2/ConversationsList';
import { QuickActionsPanel } from '@/components/wakti-ai-v2/QuickActionsPanel';
import { KnowledgeModal } from '@/components/wakti-ai-v2/KnowledgeModal';
import { TypingIndicator } from '@/components/wakti-ai-v2/TypingIndicator';
import { MobileNav } from '@/components/MobileNav';
import { AppHeader } from '@/components/AppHeader';

// Updated trigger types with image upscaling
type TriggerMode = 'chat' | 'search' | 'advanced_search' | 'image';
type ImageMode = 'regular' | 'photomaker' | 'upscaling';

export default function WaktiAIV2() {
  const { user } = useAuth();
  const { theme, language } = useTheme();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [systemReady, setSystemReady] = useState(true);
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [knowledgeModalOpen, setKnowledgeModalOpen] = useState(false);
  const [attachedImages, setAttachedImages] = useState<File[]>([]);
  const [browsingSources, setBrowsingSources] = useState<any[]>([]);
  const [quotaStatus, setQuotaStatus] = useState<any>(null);

  // Updated trigger state - separate image mode state with upscaling
  const [activeTrigger, setActiveTrigger] = useState<TriggerMode>('chat');
  const [imageMode, setImageMode] = useState<ImageMode>('regular');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const speechRecognitionRef = useRef<any>(null);

  // Helper function to detect language from text input
  const detectLanguage = (text: string): 'en' | 'ar' => {
    // Check for Arabic characters using Unicode range
    const hasArabicChars = /[\u0600-\u06FF]/.test(text);
    return hasArabicChars ? 'ar' : 'en';
  };

  // Helper function to get trigger mode display name
  const getTriggerModeDisplay = (mode: TriggerMode, imgMode?: ImageMode): string => {
    switch (mode) {
      case 'chat':
        return language === 'ar' ? 'محادثة' : 'Chat';
      case 'search':
        return language === 'ar' ? 'بحث' : 'Search';
      case 'advanced_search':
        return language === 'ar' ? 'بحث متقدم' : 'Advanced Search';
      case 'image':
        if (imgMode === 'photomaker') {
          return language === 'ar' ? 'صانع الصور الشخصية' : 'Photo Maker Personal';
        }
        if (imgMode === 'upscaling') {
          return language === 'ar' ? 'تحسين جودة الصورة' : 'Image Upscaling';
        }
        return language === 'ar' ? 'مولد الصور' : 'Image Generator';
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

  // Helper function to get trigger mode icon
  const getTriggerModeIcon = (mode: TriggerMode, imgMode?: ImageMode) => {
    switch (mode) {
      case 'image':
        if (imgMode === 'photomaker') {
          return User;
        }
        if (imgMode === 'upscaling') {
          return TrendingUp;
        }
        return ({ className }: { className?: string }) => <Upload className={className} />;
      default:
        return ({ className }: { className?: string }) => <MessageSquare className={className} />;
    }
  };

  // Handle trigger mode change
  const handleTriggerChange = (newTrigger: TriggerMode) => {
    setActiveTrigger(newTrigger);
    
    // Reset image mode when switching away from image trigger
    if (newTrigger !== 'image') {
      setImageMode('regular');
    }
    
    toast({
      title: language === 'ar' ? 'تم تغيير الوضع' : 'Mode Changed',
      description: `${language === 'ar' ? 'الوضع النشط:' : 'Active mode:'} ${getTriggerModeDisplay(newTrigger)}`,
      duration: 2000
    });
  };

  // Handle image mode change with upscaling support
  const handleImageModeChange = (newImageMode: ImageMode) => {
    setImageMode(newImageMode);
    
    // Clear existing images when switching modes
    setAttachedImages([]);
    
    // Set pre-filled prompt for upscaling mode
    if (newImageMode === 'upscaling') {
      setInputMessage(language === 'ar' ? 'تحسين جودة الصورة' : 'enhance image quality');
      toast({
        title: language === 'ar' ? 'وضع تحسين الصور' : 'Image Upscaling Mode',
        description: language === 'ar' 
          ? 'ارفع صورة واحدة لتحسين جودتها ودقتها'
          : 'Upload a single image to enhance its quality and resolution',
        duration: 4000
      });
    } else if (newImageMode === 'photomaker') {
      setInputMessage('');
      toast({
        title: language === 'ar' ? 'وضع صانع الصور الشخصية' : 'PhotoMaker Mode',
        description: language === 'ar' 
          ? 'ارفع 1-4 صور بوجوه واضحة واكتب الوصف المطلوب'
          : 'Upload 1-4 images with clear faces and write your prompt',
        duration: 4000
      });
    } else {
      setInputMessage('');
      toast({
        title: language === 'ar' ? 'وضع مولد الصور' : 'Image Generator Mode',
        description: language === 'ar' 
          ? 'اكتب وصف الصورة المطلوبة'
          : 'Write a description of the desired image',
        duration: 2000
      });
    }
  };

  // Reset trigger to chat mode on page reload
  useEffect(() => {
    setActiveTrigger('chat');
    setImageMode('regular');
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

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      
      // Set language based on current UI language
      recognition.lang = language === 'ar' ? 'ar-SA' : 'en-US';
      
      recognition.onstart = () => {
        console.log('🎤 Speech recognition started');
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        console.log('🎤 Speech recognition result:', transcript);
        
        if (transcript && transcript.trim()) {
          // Insert transcription into input field
          setInputMessage(transcript.trim());
          
          // Focus back on textarea and expand it
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.focus();
              // Move cursor to end
              const length = transcript.trim().length;
              textareaRef.current.setSelectionRange(length, length);
            }
          }, 100);

          // Show subtle feedback
          toast({
            title: language === 'ar' ? '✅ تم النسخ' : '✅ Transcribed',
            description: language === 'ar' ? 'تم إضافة النص - اضغط إرسال أو قم بالتعديل' : 'Text added — tap send or edit',
            duration: 3000
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.error('🎤 Speech recognition error:', event.error);
        
        let errorMessage = language === 'ar' 
          ? 'حدث خطأ في التعرف على الصوت'
          : 'Speech recognition error occurred';

        if (event.error === 'not-allowed') {
          errorMessage = language === 'ar'
            ? 'يرجى السماح بالوصول للميكروفون'
            : 'Please allow microphone access';
        } else if (event.error === 'no-speech') {
          errorMessage = language === 'ar'
            ? 'لم يتم اكتشاف صوت - يرجى المحاولة مرة أخرى'
            : 'No speech detected - please try again';
        }

        toast({
          title: language === 'ar' ? 'خطأ في الصوت' : 'Voice Error',
          description: errorMessage,
          variant: 'destructive'
        });
      };

      recognition.onend = () => {
        console.log('🎤 Speech recognition ended');
        setIsListening(false);
      };

      speechRecognitionRef.current = recognition;
    } else {
      console.warn('🎤 Speech recognition not supported');
    }
  }, [language]);

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
    setImageMode('regular'); // Reset image mode
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
    setImageMode('regular'); // Reset image mode
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
      // Validate image upload limits based on mode
      if (activeTrigger === 'image') {
        if (imageMode === 'photomaker') {
          if (attachedImages.length >= 4) {
            toast({
              title: language === 'ar' ? 'حد الصور' : 'Image Limit',
              description: language === 'ar' ? 'يمكن رفع 4 صور كحد أقصى لوضع صانع الصور الشخصية' : 'Maximum 4 images for PhotoMaker mode',
              variant: 'destructive'
            });
            event.target.value = '';
            return;
          }
        } else if (imageMode === 'upscaling') {
          if (attachedImages.length >= 1) {
            toast({
              title: language === 'ar' ? 'حد الصور' : 'Image Limit',
              description: language === 'ar' ? 'يمكن رفع صورة واحدة فقط لوضع تحسين الصور' : 'Only one image allowed for Upscaling mode',
              variant: 'destructive'
            });
            event.target.value = '';
            return;
          }
        }
      }
      
      setAttachedImages(prev => [...prev, file]);
      
      let toastDescription = file.name;
      if (activeTrigger === 'image' && imageMode === 'photomaker') {
        toastDescription = `${file.name} (${attachedImages.length + 1}/4)`;
      } else if (activeTrigger === 'image' && imageMode === 'upscaling') {
        toastDescription = language === 'ar' ? 'جاهز للتحسين' : 'Ready for upscaling';
      }
      
      toast({
        title: language === 'ar' ? 'تم إرفاق الصورة' : 'Image Attached',
        description: toastDescription
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

    // Image mode validations
    if (activeTrigger === 'image') {
      if (imageMode === 'photomaker') {
        if (attachedImages.length === 0) {
          toast({
            title: language === 'ar' ? 'صور مطلوبة' : 'Images Required',
            description: language === 'ar' ? 'يرجى رفع 1-4 صور للوجوه قبل الإرسال' : 'Please upload 1-4 face images before sending',
            variant: 'destructive'
          });
          return;
        }
        if (attachedImages.length > 4) {
          toast({
            title: language === 'ar' ? 'كثرة الصور' : 'Too Many Images',
            description: language === 'ar' ? 'الحد الأقصى 4 صور لوضع صانع الصور الشخصية' : 'Maximum 4 images for PhotoMaker mode',
            variant: 'destructive'
          });
          return;
        }
      } else if (imageMode === 'upscaling') {
        if (attachedImages.length === 0) {
          toast({
            title: language === 'ar' ? 'صورة مطلوبة' : 'Image Required',
            description: language === 'ar' ? 'يرجى رفع صورة واحدة قبل الإرسال' : 'Please upload an image before sending',
            variant: 'destructive'
          });
          return;
        }
        if (attachedImages.length > 1) {
          toast({
            title: language === 'ar' ? 'كثرة الصور' : 'Too Many Images',
            description: language === 'ar' ? 'يمكن رفع صورة واحدة فقط لوضع تحسين الصور' : 'Only one image allowed for Upscaling mode',
            variant: 'destructive'
          });
          return;
        }
      }
    }

    // Detect language from user input content
    const detectedLanguage = detectLanguage(content.trim());
    
    console.log('🔍 WAKTI AI: Language detection:', {
      originalContent: content.trim(),
      detectedLanguage,
      themeLanguage: language,
      activeTrigger,
      imageMode,
      attachedImages: attachedImages.length
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
    const currentAttachedImages = [...attachedImages];
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
      
      // Call the service with trigger and image mode information
      const result = await WaktiAIV2Service.sendMessageWithTrigger(
        content.trim(), 
        currentConversationId, 
        detectedLanguage, 
        inputType,
        activeTrigger,
        imageMode,
        currentAttachedImages
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

      // Show success message for image operations
      if (activeTrigger === 'image' && result.imageUrl) {
        if (imageMode === 'photomaker') {
          toast({
            title: language === 'ar' ? '✅ تم إنشاء الصورة الشخصية' : '✅ Personal Image Generated',
            description: language === 'ar' ? 'تم إنشاء صورتك الشخصية بنجاح' : 'Your personalized image has been created',
            duration: 4000
          });
        } else if (imageMode === 'upscaling') {
          toast({
            title: language === 'ar' ? '✅ تم تحسين الصورة' : '✅ Image Upscaled',
            description: language === 'ar' ? 'تم تحسين جودة ودقة الصورة بنجاح' : 'Image quality and resolution enhanced successfully',
            duration: 4000
          });
        }
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

  // Updated speech recognition functions
  const toggleSpeechRecognition = () => {
    if (isListening) {
      stopSpeechRecognition();
    } else {
      startSpeechRecognition();
    }
  };

  const startSpeechRecognition = () => {
    if (!speechRecognitionRef.current) {
      toast({
        title: language === 'ar' ? 'غير مدعوم' : 'Not Supported',
        description: language === 'ar' 
          ? 'التعرف على الصوت غير مدعوم في هذا المتصفح'
          : 'Speech recognition not supported in this browser',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Blur textarea to prevent keyboard issues
      if (textareaRef.current) {
        textareaRef.current.blur();
      }

      // Update language before starting
      speechRecognitionRef.current.lang = language === 'ar' ? 'ar-SA' : 'en-US';
      
      console.log('🎤 Starting speech recognition with language:', speechRecognitionRef.current.lang);
      speechRecognitionRef.current.start();
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في بدء التعرف على الصوت' : 'Failed to start speech recognition',
        variant: 'destructive'
      });
    }
  };

  const stopSpeechRecognition = () => {
    if (speechRecognitionRef.current && isListening) {
      speechRecognitionRef.current.stop();
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
              {getTriggerModeDisplay(activeTrigger, imageMode)}
            </span>
            {/* Show mode-specific icons when active */}
            {activeTrigger === 'image' && imageMode === 'photomaker' && (
              <User className="h-3 w-3 ml-1" />
            )}
            {activeTrigger === 'image' && imageMode === 'upscaling' && (
              <TrendingUp className="h-3 w-3 ml-1" />
            )}
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
        accept={activeTrigger === 'image' ? 'image/*' : '*/*'}
        multiple={activeTrigger === 'image' && imageMode === 'photomaker'}
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
              imageMode={imageMode}
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
              imageMode={imageMode}
              onImageModeChange={handleImageModeChange}
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

      {/* Enhanced Fixed Input Area with Voice Recognition */}
      <div className="fixed bottom-[84px] left-0 right-0 z-30 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Listening Status Display */}
          {isListening && (
            <div className="mb-3 flex items-center justify-center">
              <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-blue-600 dark:text-blue-400 font-medium text-sm">
                    {language === 'ar' ? 'جاري الاستماع...' : 'Listening...'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Image Attachments Preview */}
          {attachedImages.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-muted-foreground">
                  {(activeTrigger === 'image' && imageMode === 'photomaker')
                    ? (language === 'ar' ? `صور الوجوه (${attachedImages.length}/4)` : `Face Images (${attachedImages.length}/4)`)
                    : (activeTrigger === 'image' && imageMode === 'upscaling')
                    ? (language === 'ar' ? 'صورة للتحسين' : 'Image for Upscaling')
                    : (language === 'ar' ? 'الصور المرفقة' : 'Attached Images')
                  }
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
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
            </div>
          )}

          {/* PhotoMaker Mode Banner */}
          {activeTrigger === 'image' && imageMode === 'photomaker' && (
            <div className="mb-3 p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
              <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                <User className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {language === 'ar' ? 'وضع صانع الصور الشخصية نشط' : 'PhotoMaker Mode Active'}
                </span>
              </div>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                {language === 'ar' 
                  ? 'ارفع 1-4 صور بوجوه واضحة واكتب الوصف'
                  : 'Upload 1-4 clear face images and write your prompt'
                }
              </p>
            </div>
          )}

          {/* Image Upscaling Mode Banner */}
          {activeTrigger === 'image' && imageMode === 'upscaling' && (
            <div className="mb-3 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {language === 'ar' ? 'وضع تحسين الصور نشط' : 'Image Upscaling Mode Active'}
                </span>
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                {language === 'ar' 
                  ? 'ارفع صورة واحدة لتحسين جودتها ودقتها 2x'
                  : 'Upload one image to enhance quality & resolution 2x'
                }
              </p>
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
                  placeholder={
                    (activeTrigger === 'image' && imageMode === 'photomaker')
                      ? (language === 'ar' ? 'اكتب وصف الصورة المطلوبة...' : 'Describe the image you want...')
                      : (activeTrigger === 'image' && imageMode === 'upscaling')
                      ? (language === 'ar' ? 'وصف اختياري (مُعبأ مسبقاً)...' : 'Optional description (pre-filled)...')
                      : (language === 'ar' ? 'اكتب رسالتك أو استخدم الصوت...' : 'Type your message or use voice...')
                  }
                  disabled={isLoading || isListening}
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
                disabled={isLoading || isListening}
                className="shrink-0 h-11 w-11 rounded-xl transition-all duration-200 hover:bg-muted"
                title={
                  (activeTrigger === 'image' && imageMode === 'photomaker')
                    ? (language === 'ar' ? 'رفع صور الوجوه' : 'Upload face images')
                    : (activeTrigger === 'image' && imageMode === 'upscaling')
                    ? (language === 'ar' ? 'رفع صورة للتحسين' : 'Upload image for upscaling')
                    : (language === 'ar' ? 'رفع ملف أو التقاط صورة' : 'Upload file or take photo')
                }
              >
                <Upload className="h-5 w-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSpeechRecognition}
                disabled={isLoading}
                className={cn(
                  "shrink-0 h-11 w-11 rounded-xl transition-all duration-200",
                  isListening 
                    ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400 scale-105" 
                    : "hover:bg-muted"
                )}
              >
                {isListening ? (
                  <Square className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </Button>
              
              <Button
                onClick={() => sendMessage(inputMessage)}
                disabled={!inputMessage.trim() || isLoading || isListening || 
                  (activeTrigger === 'image' && imageMode === 'photomaker' && attachedImages.length === 0) ||
                  (activeTrigger === 'image' && imageMode === 'upscaling' && attachedImages.length === 0)
                }
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
