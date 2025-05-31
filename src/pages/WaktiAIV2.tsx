
import React, { useState, useRef, useEffect } from 'react';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { useTheme } from '@/providers/ThemeProvider';
import { ChatBubble } from '@/components/wakti-ai-v2/ChatBubble';
import { QuickActionsPanel } from '@/components/wakti-ai-v2/QuickActionsPanel';
import { ConversationsList } from '@/components/wakti-ai-v2/ConversationsList';
import { QuotaIndicator } from '@/components/wakti-ai-v2/QuotaIndicator';
import { SearchModeIndicator } from '@/components/wakti-ai-v2/SearchModeIndicator';
import { TypingIndicator } from '@/components/wakti-ai-v2/TypingIndicator';
import { WaktiAIV2Service, type AIMessage } from '@/services/WaktiAIV2Service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Send, Paperclip, Menu, X, MessageSquare, Search, Zap, Image } from 'lucide-react';
import { cn } from '@/lib/utils';

type TriggerMode = 'chat' | 'search' | 'advanced_search' | 'image';

const WaktiAIV2 = () => {
  const { language } = useTheme();
  const { showSuccess, showError, showLoading } = useToastHelper();
  
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [awaitingSearchConfirmation, setAwaitingSearchConfirmation] = useState<any | null>(null);

  // Fix: Move activeTrigger declaration before useEffect that uses it
  const [activeTrigger, setActiveTrigger] = useState<TriggerMode>(() => {
    return (localStorage.getItem('wakti-ai-active-trigger') as TriggerMode) || 'chat';
  });

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
    
    // Restore trigger state from localStorage
    const storedTrigger = localStorage.getItem('wakti-ai-active-trigger') as TriggerMode;
    if (storedTrigger) {
      setActiveTrigger(storedTrigger);
    }
  }, []);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    // Listen for trigger changes from QuickActionsPanel
    const handleTriggerChange = () => {
      const storedTrigger = localStorage.getItem('wakti-ai-active-trigger') as TriggerMode;
      if (storedTrigger && storedTrigger !== activeTrigger) {
        setActiveTrigger(storedTrigger);
      }
    };

    window.addEventListener('ai-trigger-change', handleTriggerChange);

    return () => {
      window.removeEventListener('ai-trigger-change', handleTriggerChange);
    };
  }, [activeTrigger]);

  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedImageFile, setAttachedImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchConversations = async () => {
    try {
      const conversations = await WaktiAIV2Service.getConversations();
      setConversations(conversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      showError(
        language === 'ar'
          ? 'فشل في تحميل المحادثات'
          : 'Failed to load conversations'
      );
    }
  };

  const handleConversationSelect = async (conversationId: string) => {
    setCurrentConversationId(conversationId);
    setSidebarOpen(false);
    
    try {
      const messages = await WaktiAIV2Service.getConversationMessages(conversationId);
      
      // Map the messages to the AIMessage type
      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.created_at),
        intent: msg.intent,
        confidence: msg.confidence_level,
        actionTaken: msg.action_taken,
        inputType: msg.input_type,
        browsingUsed: msg.browsing_used,
        browsingData: msg.browsing_data,
        quotaStatus: msg.quota_status,
        imageUrl: msg.image_url
      }));
      
      setMessages(formattedMessages);
    } catch (error) {
      console.error('Error fetching conversation messages:', error);
      showError(
        language === 'ar'
          ? 'فشل في تحميل رسائل المحادثة'
          : 'Failed to load conversation messages'
      );
      setMessages([]);
    }
  };

  const handleNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setInputMessage('');
    setSidebarOpen(false);
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await WaktiAIV2Service.deleteConversation(conversationId);
      showSuccess(
        language === 'ar'
          ? 'تم حذف المحادثة بنجاح'
          : 'Conversation deleted successfully'
      );
      fetchConversations();
      
      if (currentConversationId === conversationId) {
        handleNewConversation();
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      showError(
        language === 'ar'
          ? 'فشل في حذف المحادثة'
          : 'Failed to delete conversation'
      );
    }
  };

  const handleQuickAction = (message: string) => {
    setInputMessage(message);
    handleSendMessage();
  };

  const handleSearchConfirmation = async () => {
    if (!awaitingSearchConfirmation) return;

    setIsLoading(true);
    try {
      const response = await WaktiAIV2Service.sendMessageWithSearchConfirmation(
        inputMessage.trim(),
        currentConversationId,
        language,
        'text'
      );

      const aiMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        intent: response.intent,
        confidence: response.confidence,
        actionTaken: response.actionTaken,
        browsingUsed: response.browsingUsed,
        browsingData: response.browsingData,
        quotaStatus: response.quotaStatus,
        imageUrl: response.imageUrl
      };

      setMessages(prev => [...prev, aiMessage]);
      setAwaitingSearchConfirmation(null);
      
      if (!currentConversationId && response.conversationId) {
        setCurrentConversationId(response.conversationId);
        fetchConversations();
      }
    } catch (error) {
      console.error('Error sending message with confirmation:', error);
      showError(
        language === 'ar'
          ? 'فشل في إرسال الرسالة. يرجى المحاولة مرة أخرى.'
          : 'Failed to send message. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageAttachment = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      // Convert file to base64 for display and processing
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setAttachedImage(result);
        setAttachedImageFile(file);
      };
      reader.readAsDataURL(file);
    } else {
      showError(language === 'ar' ? 'يرجى اختيار ملف صورة صالح' : 'Please select a valid image file');
    }
  };

  const removeImageAttachment = () => {
    setAttachedImage(null);
    setAttachedImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async () => {
    if ((!inputMessage.trim() && !attachedImage) || isLoading) return;

    const messageToSend = inputMessage.trim();
    const imageToSend = attachedImage;
    
    setInputMessage('');
    setAttachedImage(null);
    setAttachedImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Add user message to chat
    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageToSend || '[Image uploaded]',
      timestamp: new Date(),
      inputType: 'text'
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Get the current active trigger
      const currentTrigger = localStorage.getItem('wakti-ai-active-trigger') as TriggerMode || 'chat';
      
      const response = await WaktiAIV2Service.sendMessageWithTrigger(
        messageToSend || (imageToSend ? 'Process this image' : ''),
        currentConversationId,
        language,
        'text',
        currentTrigger,
        imageToSend
      );

      if (response.requiresSearchConfirmation) {
        setAwaitingSearchConfirmation(response);
        return;
      }

      // Add AI response to chat
      const aiMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        intent: response.intent,
        confidence: response.confidence,
        actionTaken: response.actionTaken,
        browsingUsed: response.browsingUsed,
        browsingData: response.browsingData,
        quotaStatus: response.quotaStatus,
        imageUrl: response.imageUrl
      };

      setMessages(prev => [...prev, aiMessage]);
      
      if (!currentConversationId && response.conversationId) {
        setCurrentConversationId(response.conversationId);
        fetchConversations();
      }

    } catch (error) {
      console.error('Error sending message:', error);
      showError(
        language === 'ar' 
          ? 'فشل في إرسال الرسالة. يرجى المحاولة مرة أخرى.'
          : 'Failed to send message. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const confirmSearch = () => {
    handleSearchConfirmation();
  };

  const cancelSearch = () => {
    setAwaitingSearchConfirmation(null);
    showSuccess(language === 'ar' ? 'تم إلغاء البحث' : 'Search cancelled');
  };

  return (
    <div className="h-screen flex bg-background">
      {/* Sidebar / Conversations Panel */}
      <aside
        className={cn(
          "bg-secondary border-r w-80 flex-none h-full overflow-y-auto transition-all duration-300 ease-in-out",
          sidebarOpen ? "block" : "hidden md:block"
        )}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {language === 'ar' ? 'المحادثات' : 'Conversations'}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="md:hidden">
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <Button variant="outline" className="w-full justify-start mb-4" onClick={handleNewConversation}>
            {language === 'ar' ? '+ محادثة جديدة' : '+ New Conversation'}
          </Button>
          
          <ConversationsList
            conversations={conversations}
            onSelectConversation={handleConversationSelect}
            onDeleteConversation={handleDeleteConversation}
            currentConversationId={currentConversationId}
            onRefresh={fetchConversations}
          />
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header with Trigger Mode Indicator */}
        <div className="border-b px-4 py-3 bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="md:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold">
                  {language === 'ar' ? 'WAKTI AI' : 'WAKTI AI'}
                </h1>
                <SearchModeIndicator isVisible={activeTrigger === 'search' || activeTrigger === 'advanced_search'} />
              </div>
            </div>
            
            <QuotaIndicator />
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 flex flex-col">
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <div className="max-w-md mx-auto">
                    <h3 className="text-lg font-medium mb-2">
                      {language === 'ar' ? 'مرحباً بك في WAKTI AI!' : 'Welcome to WAKTI AI!'}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {language === 'ar' 
                        ? 'اختر وضع الذكاء الاصطناعي من الشريط الجانبي وابدأ المحادثة'
                        : 'Select an AI mode from the sidebar and start chatting'
                      }
                    </p>
                    {activeTrigger === 'image' && (
                      <p className="text-sm text-blue-600 dark:text-blue-400">
                        {language === 'ar' 
                          ? 'في وضع الصور، يمكنك رفع صورة وطلب إزالة الخلفية أو إنشاء صور جديدة'
                          : 'In Image mode, you can upload an image and ask to remove background or generate new images'
                        }
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {messages.map((message) => (
                <ChatBubble key={message.id} message={message} />
              ))}
              
              {isLoading && <TypingIndicator />}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t bg-card">
              {/* Image Attachment Preview */}
              {attachedImage && (
                <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                      {language === 'ar' ? 'صورة مرفقة:' : 'Attached image:'}
                    </span>
                    <Button variant="ghost" size="sm" onClick={removeImageAttachment}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <img 
                    src={attachedImage} 
                    alt="Attached" 
                    className="max-h-32 rounded border"
                  />
                </div>
              )}

              <div className="flex gap-2 items-end">
                <div className="flex-1 relative">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    placeholder={
                      activeTrigger === 'image' && attachedImage
                        ? language === 'ar' 
                          ? 'اكتب ما تريد فعله بالصورة (مثل: احذف الخلفية)'
                          : 'Tell me what to do with the image (e.g., remove background)'
                        : activeTrigger === 'search'
                        ? language === 'ar' 
                          ? 'ابحث عن معلومات حديثة...'
                          : 'Search for current information...'
                        : activeTrigger === 'image'
                        ? language === 'ar' 
                          ? 'أرفق صورة أو اطلب إنشاء صورة...'
                          : 'Attach an image or ask to generate one...'
                        : language === 'ar' 
                        ? 'اكتب رسالتك هنا...'
                        : 'Type your message here...'
                    }
                    className="pr-10"
                    disabled={isLoading}
                  />
                  
                  {/* Image Attachment Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageAttachment}
                    className="hidden"
                  />
                </div>
                
                <Button 
                  onClick={handleSendMessage} 
                  disabled={(!inputMessage.trim() && !attachedImage) || isLoading}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Helper text for Image mode */}
              {activeTrigger === 'image' && !attachedImage && (
                <p className="text-xs text-muted-foreground mt-2">
                  {language === 'ar' 
                    ? 'أرفق صورة لإزالة الخلفية أو اطلب إنشاء صورة جديدة'
                    : 'Attach an image to remove background or ask to generate a new image'
                  }
                </p>
              )}
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="w-80 border-l bg-card overflow-y-auto">
            <QuickActionsPanel 
              onSendMessage={handleQuickAction}
              activeTrigger={activeTrigger}
              onTriggerChange={setActiveTrigger}
            />
          </div>
        </div>
      </div>

      {/* Search Confirmation Dialog */}
      {awaitingSearchConfirmation && (
        <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center">
          <Card className="max-w-md p-6">
            <h3 className="text-lg font-medium mb-4">
              {language === 'ar' ? 'تأكيد البحث' : 'Confirm Search'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {language === 'ar'
                ? `لقد استخدمت ${awaitingSearchConfirmation.quotaStatus.count} من ${awaitingSearchConfirmation.quotaStatus.limit} عملية بحث شهرية. هل أنت متأكد أنك تريد المتابعة؟`
                : `You've used ${awaitingSearchConfirmation.quotaStatus.count} of ${awaitingSearchConfirmation.quotaStatus.limit} monthly searches. Are you sure you want to proceed?`}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={cancelSearch}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button onClick={confirmSearch}>
                {language === 'ar' ? 'تأكيد' : 'Confirm'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default WaktiAIV2;
