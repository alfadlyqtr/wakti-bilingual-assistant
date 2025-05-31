
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
  TrendingUp,
  Bot,
  ImageIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatBubble } from '@/components/wakti-ai-v2/ChatBubble';
import { ConversationsList } from '@/components/wakti-ai-v2/ConversationsList';
import { QuickActionsPanel } from '@/components/wakti-ai-v2/QuickActionsPanel';
import { KnowledgeModal } from '@/components/wakti-ai-v2/KnowledgeModal';
import { TypingIndicator } from '@/components/wakti-ai-v2/TypingIndicator';
import { MobileNav } from '@/components/MobileNav';
import { AppHeader } from '@/components/AppHeader';
import { PageContainer } from '@/components/PageContainer';
import { SearchModeIndicator } from '@/components/wakti-ai-v2/SearchModeIndicator';
import { QuotaIndicator } from '@/components/wakti-ai-v2/QuotaIndicator';

// Updated trigger types with stylized art
type TriggerMode = 'chat' | 'search' | 'advanced_search' | 'image';
type ImageMode = 'regular' | 'photomaker' | 'upscaling' | 'stylized';

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
  const [showConversations, setShowConversations] = useState(false);

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
        if (imgMode === 'stylized') {
          return language === 'ar' ? 'أسلوب ديزني، كتاب هزلي، أنمي...' : 'Disney style, comic book, anime...';
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
        if (imgMode === 'stylized') {
          return ImageIcon;
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
    setAttachedImages([]);
    
    // Set appropriate placeholder based on mode
    if (newImageMode === 'photomaker') {
      setInputMessage(language === 'ar' ? 'اكتب وصف الصورة الشخصية المطلوبة...' : 'Describe the personal image you want...');
    } else if (newImageMode === 'upscaling') {
      setInputMessage(language === 'ar' ? 'تحسين جودة الصورة' : 'Enhance image quality');
    } else if (newImageMode === 'stylized') {
      setInputMessage(language === 'ar' ? 'أسلوب ديزني، كتاب هزلي، أنمي...' : 'Disney style, comic book, anime...');
    } else {
      setInputMessage('');
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

  const handleConversationSelect = async (conversationId: string) => {
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
      setShowConversations(false);
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

  const handleNewConversation = () => {
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
        handleNewConversation();
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
        } else if (imageMode === 'stylized') {
          if (attachedImages.length >= 1) {
            toast({
              title: language === 'ar' ? 'حد الصور' : 'Image Limit',
              description: language === 'ar' ? 'يمكن رفع صورة واحدة فقط لوضع التحويل الفني' : 'Only one image allowed for Stylized mode',
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
      } else if (activeTrigger === 'image' && imageMode === 'stylized') {
        toastDescription = language === 'ar' ? 'جاهز للتحويل الفني' : 'Ready for stylization';
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
      handleSendMessage();
    }
  };

  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      sendMessage(inputMessage.trim());
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
      } else if (imageMode === 'stylized') {
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
            description: language === 'ar' ? 'يمكن رفع صورة واحدة فقط لوضع التحويل الفني' : 'Only one image allowed for Stylized mode',
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
            description: language === 'ar' ? 'تم تحسين جودة ودقت الصورة بنجاح' : 'Image quality and resolution enhanced successfully',
            duration: 4000
          });
        } else if (imageMode === 'stylized') {
          toast({
            title: language === 'ar' ? '✅ تم تحويل الصورة' : '✅ Image Stylized',
            description: language === 'ar' ? 'تم تحويل الصورة بنجاح' : 'Image has been successfully stylized',
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

  const handleQuickAction = (message: string) => {
    setInputMessage(message);
    setTimeout(() => {
      handleSendMessage();
    }, 100);
  };

  console.log('🔍 DEBUG: About to render input area');

  const isPhotoMakerMode = activeTrigger === 'image' && imageMode === 'photomaker';
  const isUpscalingMode = activeTrigger === 'image' && imageMode === 'upscaling';
  const isStylizedMode = activeTrigger === 'image' && imageMode === 'stylized';
  const isImageGenerationMode = activeTrigger === 'image';

  // Image upload validation
  const getMaxImages = () => {
    if (imageMode === 'photomaker') return 4;
    if (imageMode === 'upscaling' || imageMode === 'stylized') return 1;
    return 10; // regular mode
  };

  const getImageUploadText = () => {
    if (imageMode === 'photomaker') {
      return language === 'ar' ? 'رفع 1-4 صور بوجوه واضحة' : 'Upload 1-4 images with clear faces';
    }
    if (imageMode === 'upscaling') {
      return language === 'ar' ? 'رفع صورة واحدة للتحسين' : 'Upload one image to enhance';
    }
    if (imageMode === 'stylized') {
      return language === 'ar' ? 'رفع صورة واحدة للتحويل الفني' : 'Upload one image to stylize';
    }
    return language === 'ar' ? 'رفع الصور (اختياري)' : 'Upload images (optional)';
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    processFileUpload(event);
  };

  const removeImage = (index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <PageContainer>
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-border/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-xl font-bold">
                  {language === 'ar' ? 'وقتي الذكي V2' : 'Wakti AI V2'}
                </h1>
              </div>
              
              <div className="flex items-center gap-2">
                <SearchModeIndicator 
                  activeTrigger={activeTrigger} 
                  imageMode={imageMode}
                />
                <QuotaIndicator />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConversations(!showConversations)}
                className="text-muted-foreground hover:text-foreground"
              >
                <MessageSquare className="w-4 h-4" />
                {language === 'ar' ? 'المحادثات' : 'Conversations'}
              </Button>
              
              <KnowledgeModal 
                open={knowledgeModalOpen}
                onOpenChange={setKnowledgeModalOpen}
              />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Conversations Sidebar */}
          {showConversations && (
            <div className="w-80 border-r border-border/50 flex flex-col">
              <ConversationsList 
                onConversationSelect={handleConversationSelect}
                selectedConversationId={currentConversationId}
                onNewConversation={handleNewConversation}
              />
            </div>
          )}

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-4 max-w-md">
                    <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                      <Bot className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold">
                      {language === 'ar' ? 'مرحباً بك في وقتي الذكي V2' : 'Welcome to Wakti AI V2'}
                    </h2>
                    <p className="text-muted-foreground">
                      {language === 'ar' 
                        ? 'اختر وضع الذكاء الاصطناعي من الجانب الأيمن وابدأ المحادثة'
                        : 'Choose an AI mode from the right panel and start chatting'
                      }
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <ChatBubble 
                    key={message.id} 
                    message={message} 
                    onSearchConfirm={handleSearchConfirmation}
                    activeTrigger={activeTrigger}
                    imageMode={imageMode}
                  />
                ))
              )}
              
              {isTyping && <TypingIndicator />}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Image Upload Area */}
            {isImageGenerationMode && (
              <div className="flex-shrink-0 p-4 border-t border-border/50 bg-muted/30">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      multiple={imageMode !== 'upscaling' && imageMode !== 'stylized'}
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                      disabled={attachedImages.length >= getMaxImages()}
                    />
                    <label
                      htmlFor="image-upload"
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border cursor-pointer hover:bg-muted/50 transition-colors",
                        attachedImages.length >= getMaxImages() && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {getImageUploadText()}
                      </span>
                    </label>
                  </div>
                  
                  {attachedImages.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {attachedImages.length}/{getMaxImages()} {language === 'ar' ? 'صور' : 'images'}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAttachedImages([])}
                        className="h-8 px-2"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* Preview attached images */}
                {attachedImages.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {attachedImages.map((image, index) => (
                      <div key={index} className="relative">
                        <img
                          src={URL.createObjectURL(image)}
                          alt={`Uploaded ${index + 1}`}
                          className="w-16 h-16 object-cover rounded-lg border border-border"
                        />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Input Area */}
            <div className="flex-shrink-0 p-4 border-t border-border/50">
              <div className="flex items-end gap-3">
                <div className="flex-1 relative">
                  <Textarea
                    ref={textareaRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder={
                      activeTrigger === 'search' ? 
                        (language === 'ar' ? 'ابحث عن معلومات حديثة...' : 'Search for current information...') :
                      activeTrigger === 'advanced_search' ?
                        (language === 'ar' ? 'بحث متقدم وتحليل...' : 'Advanced search & analysis...') :
                      activeTrigger === 'image' && imageMode === 'photomaker' ?
                        (language === 'ar' ? 'اكتب وصف الصورة الشخصية...' : 'Describe the personal image...') :
                      activeTrigger === 'image' && imageMode === 'upscaling' ?
                        (language === 'ar' ? 'تحسين جودة الصورة' : 'Enhance image quality') :
                      activeTrigger === 'image' && imageMode === 'stylized' ?
                        (language === 'ar' ? 'أسلوب ديزني، كتاب هزلي، أنمي...' : 'Disney style, comic book, anime...') :
                      activeTrigger === 'image' && imageMode === 'regular' ?
                        (language === 'ar' ? 'اكتب وصف الصورة...' : 'Describe the image you want...') :
                        (language === 'ar' ? 'اكتب رسالتك هنا...' : 'Type your message here...')
                    }
                    onKeyDown={handleTextareaKeyPress}
                    className="min-h-[60px] resize-none pr-12"
                  />
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleSpeechRecognition}
                    className={cn(
                      "absolute bottom-2 right-2 w-8 h-8 p-0",
                      isListening && "bg-red-500 text-white hover:bg-red-600"
                    )}
                    disabled={isLoading}
                  >
                    <Mic className="w-4 h-4" />
                  </Button>
                </div>
                
                <Button 
                  onClick={handleSendMessage}
                  disabled={isLoading || inputMessage.trim() === '' || (isImageGenerationMode && attachedImages.length === 0 && (imageMode === 'upscaling' || imageMode === 'stylized'))}
                  className="h-[60px] px-6"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              
              {/* Mode-specific validation messages */}
              {isImageGenerationMode && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {imageMode === 'upscaling' || imageMode === 'stylized' ? (
                    attachedImages.length === 0 && (
                      <span className="text-orange-600">
                        {language === 'ar' ? 'يجب رفع صورة واحدة' : 'Please upload one image'}
                      </span>
                    )
                  ) : imageMode === 'photomaker' ? (
                    attachedImages.length === 0 && (
                      <span className="text-orange-600">
                        {language === 'ar' ? 'يجب رفع صورة واحدة على الأقل' : 'Please upload at least one image'}
                      </span>
                    )
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Quick Actions */}
          <div className="w-80 border-l border-border/50 p-4 overflow-y-auto">
            <QuickActionsPanel 
              onSendMessage={handleQuickAction}
              activeTrigger={activeTrigger}
              onTriggerChange={handleTriggerChange}
              imageMode={imageMode}
              onImageModeChange={handleImageModeChange}
            />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
