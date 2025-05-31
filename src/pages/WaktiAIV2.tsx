import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { 
  Send, 
  Mic, 
  MicOff, 
  Upload, 
  X, 
  MessageSquare, 
  Search, 
  Zap, 
  Image as ImageIcon,
  User,
  TrendingUp,
  Scissors,
  ArrowLeft,
  RotateCcw,
  Menu
} from 'lucide-react';
import { WaktiAIV2Service, AIMessage } from '@/services/WaktiAIV2Service';
import { ChatBubble } from '@/components/wakti-ai-v2/ChatBubble';
import { TypingIndicator } from '@/components/wakti-ai-v2/TypingIndicator';
import { QuickActionsPanel } from '@/components/wakti-ai-v2/QuickActionsPanel';
import { ConversationsList } from '@/components/wakti-ai-v2/ConversationsList';
import { QuotaIndicator } from '@/components/wakti-ai-v2/QuotaIndicator';
import { KnowledgeModal } from '@/components/wakti-ai-v2/KnowledgeModal';
import { cn } from '@/lib/utils';

// Updated trigger types with background removal
type TriggerMode = 'chat' | 'search' | 'advanced_search' | 'image';
type ImageMode = 'regular' | 'photomaker' | 'upscaling' | 'background_removal';

export default function WaktiAIV2() {
  const [isMounted, setIsMounted] = useState(false);
  const { language, theme } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showConversations, setShowConversations] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [showKnowledge, setShowKnowledge] = useState(false);
  
  // AI Trigger State with background removal support
  const [activeTrigger, setActiveTrigger] = useState<TriggerMode>(localStorage.getItem('wakti-ai-active-trigger') as TriggerMode || 'chat');
  const [imageMode, setImageMode] = useState<ImageMode>(localStorage.getItem('wakti-ai-image-mode') as ImageMode || 'regular');
  const [attachedImages, setAttachedImages] = useState<File[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewConversation = () => {
    setMessages([]);
    setInputMessage('');
    setConversationId(null);
    setShowConversations(false);
  };

  const handleTriggerChange = (trigger: TriggerMode) => {
    setActiveTrigger(trigger);
  };

  const handleSearchConfirm = async (messageContent: string) => {
    try {
      setIsLoading(true);
      
      // Add user message to chat
      const userMessage: AIMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: messageContent,
        timestamp: new Date(),
        inputType: 'text'
      };
      
      setMessages(prev => [...prev, userMessage]);
      setInputMessage('');
      
      // Send message with search confirmation
      const response = await WaktiAIV2Service.sendMessageWithSearchConfirmation(
        messageContent,
        conversationId,
        language,
        'text'
      );
      
      if (response.conversationId && !conversationId) {
        setConversationId(response.conversationId);
      }
      
      const assistantMessage: AIMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        intent: response.intent,
        confidence: response.confidence,
        actionTaken: response.actionTaken,
        browsingUsed: response.browsingUsed,
        browsingData: response.browsingData,
        quotaStatus: response.quotaStatus,
        requiresSearchConfirmation: response.requiresSearchConfirmation,
        imageUrl: response.imageUrl
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message with search confirmation:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message || (language === 'ar' ? 'حدث خطأ أثناء إرسال الرسالة' : 'Failed to send message'),
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getTriggerModeDisplay = () => {
    switch (activeTrigger) {
      case 'chat':
        return language === 'ar' ? 'محادثة' : 'Chat';
      case 'search':
        return language === 'ar' ? 'بحث' : 'Search';
      case 'advanced_search':
        return language === 'ar' ? 'بحث متقدم' : 'Advanced Search';
      case 'image':
        switch (imageMode) {
          case 'regular':
            return language === 'ar' ? 'مولد الصور' : 'Image Generator';
          case 'photomaker':
            return language === 'ar' ? 'صانع الصور الشخصية' : 'PhotoMaker Personal';
          case 'upscaling':
            return language === 'ar' ? 'تحسين جودة الصورة' : 'Image Upscaling';
          case 'background_removal':
            return language === 'ar' ? 'إزالة الخلفية' : 'Background Removal';
          default:
            return language === 'ar' ? 'صورة' : 'Image';
        }
      default:
        return language === 'ar' ? 'محادثة' : 'Chat';
    }
  };

  const getTriggerModeIcon = () => {
    switch (activeTrigger) {
      case 'chat':
        return MessageSquare;
      case 'search':
        return Search;
      case 'advanced_search':
        return Zap;
      case 'image':
        switch (imageMode) {
          case 'regular':
            return ImageIcon;
          case 'photomaker':
            return User;
          case 'upscaling':
            return TrendingUp;
          case 'background_removal':
            return Scissors;
          default:
            return ImageIcon;
        }
      default:
        return MessageSquare;
    }
  };

  const handleSendMessage = async (messageToSend?: string) => {
    const message = messageToSend || inputMessage.trim();
    
    // Validation for different modes
    if (activeTrigger === 'image') {
      if (imageMode === 'photomaker') {
        if (attachedImages.length === 0) {
          toast({
            title: language === 'ar' ? 'خطأ' : 'Error',
            description: language === 'ar' ? 'يرجى رفع 1-4 صور للوجوه' : 'Please upload 1-4 face images',
            variant: 'destructive'
          });
          return;
        }
        if (attachedImages.length > 4) {
          toast({
            title: language === 'ar' ? 'خطأ' : 'Error',
            description: language === 'ar' ? 'الحد الأقصى 4 صور' : 'Maximum 4 images allowed',
            variant: 'destructive'
          });
          return;
        }
        if (!message) {
          toast({
            title: language === 'ar' ? 'خطأ' : 'Error',
            description: language === 'ar' ? 'يرجى كتابة وصف الصورة المطلوبة' : 'Please describe the desired image',
            variant: 'destructive'
          });
          return;
        }
      } else if (imageMode === 'upscaling') {
        if (attachedImages.length !== 1) {
          toast({
            title: language === 'ar' ? 'خطأ' : 'Error',
            description: language === 'ar' ? 'يرجى رفع صورة واحدة فقط للتحسين' : 'Please upload exactly one image for upscaling',
            variant: 'destructive'
          });
          return;
        }
      } else if (imageMode === 'background_removal') {
        if (attachedImages.length !== 1) {
          toast({
            title: language === 'ar' ? 'خطأ' : 'Error',
            description: language === 'ar' ? 'يرجى رفع صورة واحدة فقط لإزالة الخلفية' : 'Please upload exactly one image for background removal',
            variant: 'destructive'
          });
          return;
        }
        // For background removal, no prompt is needed - auto-set message
        const autoMessage = language === 'ar' ? 'إزالة خلفية الصورة' : 'Remove background from image';
        // Override the message for background removal
        if (!messageToSend) {
          messageToSend = autoMessage;
        }
      } else if (imageMode === 'regular') {
        if (!message) {
          toast({
            title: language === 'ar' ? 'خطأ' : 'Error',
            description: language === 'ar' ? 'يرجى كتابة وصف الصورة المطلوبة' : 'Please describe the image you want to generate',
            variant: 'destructive'
          });
          return;
        }
      }
    } else {
      // For non-image modes, require a message
      if (!message) {
        toast({
          title: language === 'ar' ? 'خطأ' : 'Error',
          description: language === 'ar' ? 'يرجى كتابة رسالة' : 'Please enter a message',
          variant: 'destructive'
        });
        return;
      }
    }

    try {
      setIsLoading(true);
      const messageToUse = messageToSend || message;
      
      // Add user message to chat
      const userMessage: AIMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: messageToUse,
        timestamp: new Date(),
        inputType: 'text'
      };
      
      setMessages(prev => [...prev, userMessage]);
      setInputMessage('');
      
      // Send message with trigger information
      const response = await WaktiAIV2Service.sendMessageWithTrigger(
        messageToUse,
        conversationId,
        language,
        'text',
        activeTrigger,
        imageMode,
        attachedImages
      );
      
      if (response.conversationId && !conversationId) {
        setConversationId(response.conversationId);
      }
      
      const assistantMessage: AIMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        intent: response.intent,
        confidence: response.confidence,
        actionTaken: response.actionTaken,
        browsingUsed: response.browsingUsed,
        browsingData: response.browsingData,
        quotaStatus: response.quotaStatus,
        requiresSearchConfirmation: response.requiresSearchConfirmation,
        imageUrl: response.imageUrl
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Clear attached images after successful send
      setAttachedImages([]);
      
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message || (language === 'ar' ? 'حدث خطأ أثناء إرسال الرسالة' : 'Failed to send message'),
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Validate file types
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const invalidFiles = files.filter(file => !validTypes.includes(file.type));
    
    if (invalidFiles.length > 0) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'يرجى رفع صور فقط (JPEG, PNG, WebP)' : 'Please upload only images (JPEG, PNG, WebP)',
        variant: 'destructive'
      });
      return;
    }

    // Apply mode-specific limits
    if (activeTrigger === 'image') {
      if (imageMode === 'photomaker') {
        const totalFiles = attachedImages.length + files.length;
        if (totalFiles > 4) {
          toast({
            title: language === 'ar' ? 'خطأ' : 'Error',
            description: language === 'ar' ? 'الحد الأقصى 4 صور لصانع الصور الشخصية' : 'Maximum 4 images for PhotoMaker',
            variant: 'destructive'
          });
          return;
        }
        setAttachedImages(prev => [...prev, ...files]);
      } else if (imageMode === 'upscaling' || imageMode === 'background_removal') {
        // Only allow 1 image for upscaling and background removal
        if (files.length > 1) {
          toast({
            title: language === 'ar' ? 'خطأ' : 'Error',
            description: language === 'ar' ? 'صورة واحدة فقط مسموحة' : 'Only one image allowed',
            variant: 'destructive'
          });
          return;
        }
        setAttachedImages([files[0]]); // Replace any existing image
      } else {
        // Regular image generation - no images needed
        toast({
          title: language === 'ar' ? 'معلومة' : 'Info',
          description: language === 'ar' ? 'لا حاجة لرفع صور في وضع إنشاء الصور العادي' : 'No images needed for regular image generation',
          variant: 'default'
        });
      }
    }

    // Clear file input
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleImageModeChange = (newImageMode: ImageMode) => {
    setImageMode(newImageMode);
    
    // Clear images when switching modes
    setAttachedImages([]);
    
    // Set appropriate placeholder based on mode
    if (newImageMode === 'background_removal') {
      setInputMessage('');
    } else if (newImageMode === 'upscaling') {
      setInputMessage('');
    }
  };

  const getPlaceholderText = () => {
    if (activeTrigger === 'image') {
      switch (imageMode) {
        case 'photomaker':
          return language === 'ar' 
            ? 'ارفع 1-4 صور واكتب وصف الصورة المطلوبة...' 
            : 'Upload 1-4 images and describe your desired photo...';
        case 'upscaling':
          return language === 'ar' 
            ? 'ارفع صورة واحدة لتحسين الجودة...' 
            : 'Upload one image to enhance quality...';
        case 'background_removal':
          return language === 'ar' 
            ? 'ارفع صورة واحدة لإزالة الخلفية...' 
            : 'Upload one image to remove background...';
        case 'regular':
        default:
          return language === 'ar' 
            ? 'اكتب وصف الصورة المطلوبة...' 
            : 'Describe the image you want to generate...';
      }
    }
    
    switch (activeTrigger) {
      case 'search':
        return language === 'ar' ? 'ابحث عن معلومات حديثة...' : 'Search for current information...';
      case 'advanced_search':
        return language === 'ar' ? 'بحث متقدم وتحليل عميق...' : 'Advanced search and deep analysis...';
      case 'chat':
      default:
        return language === 'ar' ? 'اكتب رسالتك هنا...' : 'Type your message here...';
    }
  };

  const removeAttachedImage = (indexToRemove: number) => {
    setAttachedImages(prevImages => prevImages.filter((_, index) => index !== indexToRemove));
  };

  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  const toggleConversations = () => {
    setShowConversations(!showConversations);
  };

  const toggleQuickActions = () => {
    setShowQuickActions(!showQuickActions);
  };

  const toggleKnowledge = () => {
    setShowKnowledge(!showKnowledge);
  };

  const handleKeyDownFileInput = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter') {
      // Programmatically trigger the file input when Enter key is pressed on the button
      fileInputRef.current?.click();
    }
  };

  if (!isMounted) {
    return null;
  }

  return (
    <div className="relative h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          {showSidebar && (
            <Button variant="ghost" size="icon" onClick={toggleSidebar}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          {!showSidebar && (
            <Button variant="ghost" size="icon" onClick={toggleSidebar}>
              <Menu className="h-4 w-4" />
            </Button>
          )}
          <h1 className="text-lg font-semibold">
            {getTriggerModeDisplay()}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <QuotaIndicator />
          <Button variant="ghost" size="icon" onClick={handleNewConversation}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleKnowledge}>
            <ImageIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Sidebar (hidden on smaller screens) */}
        <aside
          className={cn(
            "w-full md:w-80 border-r border-border p-4 bg-secondary",
            showSidebar ? "block" : "hidden md:block"
          )}
        >
          <ConversationsList 
            showConversations={showConversations}
            onClose={() => setShowConversations(false)}
            onNewConversation={handleNewConversation}
            onConversationSelected={(id) => {
              setConversationId(id);
              setMessages([]);
              WaktiAIV2Service.getConversationMessages(id)
                .then(messages => {
                  const formattedMessages = messages.map(msg => ({
                    id: msg.id,
                    role: msg.role,
                    content: msg.content,
                    timestamp: new Date(msg.created_at),
                    intent: msg.intent,
                    confidence: msg.confidence,
                    actionTaken: msg.action_taken,
                    inputType: msg.input_type,
                    browsingUsed: msg.browsing_used,
                    browsingData: msg.browsing_data,
                    quotaStatus: msg.quota_status,
                    requiresSearchConfirmation: msg.requires_search_confirmation,
                    imageUrl: msg.image_url
                  }));
                  setMessages(formattedMessages);
                })
                .catch(error => {
                  console.error('Error fetching conversation messages:', error);
                  toast({
                    title: language === 'ar' ? 'خطأ' : 'Error',
                    description: language === 'ar' ? 'فشل في جلب الرسائل' : 'Failed to fetch messages',
                    variant: 'destructive'
                  });
                });
              setShowSidebar(false);
            }}
          />
        </aside>

        {/* Chat Area */}
        <main className="flex-1 p-4 relative">
          <ScrollArea className="h-full pb-20">
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message}
                onSearchConfirm={handleSearchConfirm}
                activeTrigger={activeTrigger}
                imageMode={imageMode}
              />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </ScrollArea>

          {/* Input Area */}
          <div className="absolute bottom-0 left-0 w-full border-t border-border bg-background p-4">
            {/* Attached Images Preview */}
            {attachedImages.length > 0 && (
              <div className="mb-3 flex items-center gap-2 overflow-x-auto">
                {attachedImages.map((image, index) => (
                  <div key={index} className="relative">
                    <img
                      src={URL.createObjectURL(image)}
                      alt={image.name}
                      className="h-20 w-20 rounded-md object-cover"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-0 right-0 h-6 w-6 p-1"
                      onClick={() => removeAttachedImage(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Input and Actions */}
            <div className="flex items-center gap-2">
              <Input
                placeholder={getPlaceholderText()}
                value={inputMessage}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className="flex-1"
              />
              <div className="flex items-center gap-2">
                {/* File Upload Button */}
                <Button
                  variant="outline"
                  size="icon"
                  disabled={isLoading}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={handleKeyDownFileInput}
                >
                  <Upload className="h-4 w-4" />
                </Button>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg, image/png, image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                  ref={fileInputRef}
                />

                {/* Send Button */}
                <Button
                  onClick={handleSendMessage}
                  disabled={isLoading}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'إرسال' : 'Send'}
                </Button>
              </div>
            </div>
          </div>
        </main>

        {/* Quick Actions Panel (hidden on smaller screens) */}
        <aside
          className={cn(
            "w-full md:w-80 border-l border-border p-4 bg-secondary",
            showQuickActions ? "block" : "hidden md:block"
          )}
        >
          <QuickActionsPanel 
            onSendMessage={handleSendMessage}
            activeTrigger={activeTrigger}
            onTriggerChange={handleTriggerChange}
            imageMode={imageMode}
            onImageModeChange={handleImageModeChange}
          />
        </aside>
      </div>

      {/* Knowledge Modal */}
      <KnowledgeModal 
        open={showKnowledge} 
        onOpenChange={setShowKnowledge} 
      />
    </div>
  );
}
