import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Mic, Send, Loader2, Upload, X, MessageSquare, Search, Zap, Image as ImageIcon, Settings, Menu, Users, LogOut, ArrowLeft, Download, FileDown, Trash2, Volume2, VolumeX, Palette, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatBubble } from '@/components/wakti-ai-v2/ChatBubble';
import { QuickActionsPanel } from '@/components/wakti-ai-v2/QuickActionsPanel';
import { ConversationsPanel } from '@/components/wakti-ai-v2/ConversationsPanel';
import { SearchModeIndicator } from '@/components/wakti-ai-v2/SearchModeIndicator';
import { WaktiAIV2Service, AIResponse, AIMessage, AIConversation } from '@/services/WaktiAIV2Service';

// Updated trigger types with stylized art
type TriggerMode = 'chat' | 'search' | 'advanced_search' | 'image';
type ImageMode = 'regular' | 'photomaker' | 'upscaling' | 'stylized';

interface ChatMessage extends AIMessage {
  id: string;
}

export default function WaktiAIV2() {
  const { language, setLanguage } = useTheme();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<AIConversation | null>(null);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [attachedImages, setAttachedImages] = useState<File[]>([]);
  const [conversationsPanelOpen, setConversationsPanelOpen] = useState(false);
  const [quickActionsPanelOpen, setQuickActionsPanelOpen] = useState(true);
  const [activeTrigger, setActiveTrigger] = useState<TriggerMode>('chat');
  const [imageMode, setImageMode] = useState<ImageMode>('regular');

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const storedTrigger = localStorage.getItem('wakti-ai-active-trigger') as TriggerMode || 'chat';
    const storedImageMode = localStorage.getItem('wakti-ai-image-mode') as ImageMode || 'regular';
    setActiveTrigger(storedTrigger);
    setImageMode(storedImageMode);
  }, []);

  useEffect(() => {
    loadConversations();
    // Load initial messages if a conversation is already selected
    if (selectedConversation) {
      loadConversationMessages(selectedConversation.id);
    }
  }, [language]);

  useEffect(() => {
    // Load messages when a conversation is selected
    if (selectedConversation) {
      loadConversationMessages(selectedConversation.id);
    } else {
      setChatHistory([]); // Clear chat history when no conversation is selected
    }
  }, [selectedConversation]);

  useEffect(() => {
    // Scroll to bottom when chat history changes
    scrollToBottom();
  }, [chatHistory]);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  const loadConversations = async () => {
    try {
      const conversations = await WaktiAIV2Service.getConversations();
      setConversations(conversations);
    } catch (error: any) {
      toast.error(language === 'ar' ? 'فشل في تحميل المحادثات' : 'Failed to load conversations');
      console.error('Error loading conversations:', error);
    }
  };

  const loadConversationMessages = async (conversationId: string) => {
    try {
      const messages = await WaktiAIV2Service.getConversationMessages(conversationId);
      const formattedMessages = messages.map((msg) => ({
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
      setChatHistory(formattedMessages);
    } catch (error: any) {
      toast.error(language === 'ar' ? 'فشل في تحميل الرسائل' : 'Failed to load messages');
      console.error('Error loading conversation messages:', error);
    }
  };

  const handleNewConversation = () => {
    setSelectedConversation(null);
    setChatHistory([]);
  };

  const handleSelectConversation = (conversation: AIConversation) => {
    setSelectedConversation(conversation);
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await WaktiAIV2Service.deleteConversation(conversationId);
      setConversations(conversations.filter((c) => c.id !== conversationId));
      setSelectedConversation(null);
      setChatHistory([]);
      toast.success(language === 'ar' ? 'تم حذف المحادثة' : 'Conversation deleted');
    } catch (error: any) {
      toast.error(language === 'ar' ? 'فشل في حذف المحادثة' : 'Failed to delete conversation');
      console.error('Error deleting conversation:', error);
    }
  };

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage as 'en' | 'ar');
  };

  const handleTriggerChange = (trigger: TriggerMode) => {
    setActiveTrigger(trigger);
  };

  const handleImageModeChange = (mode: ImageMode) => {
    setImageMode(mode);
  };

  const handleSearchConfirmation = async (messageContent: string) => {
    setIsLoading(true);
    try {
      const aiResponse = await WaktiAIV2Service.sendMessageWithSearchConfirmation(
        messageContent,
        selectedConversation?.id,
        language
      );
      handleAIResponse(aiResponse);
    } catch (error: any) {
      toast.error(language === 'ar' ? 'فشل في البحث' : 'Failed to search');
      console.error('Error during search confirmation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAIResponse = (aiResponse: AIResponse) => {
    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: aiResponse.response,
      timestamp: new Date(),
      intent: aiResponse.intent,
      confidence: aiResponse.confidence,
      actionTaken: aiResponse.actionTaken,
      browsingUsed: aiResponse.browsingUsed,
      browsingData: aiResponse.browsingData,
      quotaStatus: aiResponse.quotaStatus,
      requiresSearchConfirmation: aiResponse.requiresSearchConfirmation,
      imageUrl: aiResponse.imageUrl
    };

    setChatHistory((prev) => [...prev, newMessage]);
    setMessage('');

    // Update conversations list or create a new one
    if (aiResponse.conversationId) {
      // Update existing conversation
      setConversations((prevConversations) => {
        return prevConversations.map((c) =>
          c.id === aiResponse.conversationId
            ? { ...c, last_message_at: new Date().toISOString() }
            : c
        );
      });
      // Select the conversation if not already selected
      if (!selectedConversation || selectedConversation.id !== aiResponse.conversationId) {
        const updatedConversation = conversations.find(c => c.id === aiResponse.conversationId);
        if (updatedConversation) {
          setSelectedConversation(updatedConversation);
        }
      }
    } else {
      // Create new conversation
      loadConversations();
    }
  };

  // Handle message sending
  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || message.trim();
    if (!textToSend && attachedImages.length === 0) return;

    // Validation for stylized mode
    if (activeTrigger === 'image' && imageMode === 'stylized') {
      if (attachedImages.length !== 1) {
        toast.error(language === 'ar' ? 'يرجى رفع صورة واحدة فقط للفن المخصص' : 'Please upload exactly 1 image for stylized art');
        return;
      }
      if (!textToSend.trim()) {
        toast.error(language === 'ar' ? 'يرجى كتابة وصف النمط المطلوب' : 'Please write a style description');
        return;
      }
    }

    setIsLoading(true);
    try {
      let aiResponse: AIResponse;

      if (activeTrigger === 'chat') {
        aiResponse = await WaktiAIV2Service.sendMessage(
          textToSend,
          selectedConversation?.id,
          language
        );
      } else {
        // Convert images to base64
        const base64Images = await Promise.all(
          attachedImages.map(file => {
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                  resolve(reader.result);
                } else {
                  reject(new Error('Failed to convert image to base64'));
                }
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
          })
        );

        aiResponse = await WaktiAIV2Service.sendMessageWithTrigger(
          textToSend,
          selectedConversation?.id,
          language,
          'text',
          activeTrigger,
          imageMode,
          attachedImages
        );
      }

      const newMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: textToSend,
        timestamp: new Date(),
        inputType: 'text',
      };
      setChatHistory((prev) => [...prev, newMessage]);
      handleAIResponse(aiResponse);
      setAttachedImages([]);
    } catch (error: any) {
      toast.error(language === 'ar' ? 'فشل في إرسال الرسالة' : 'Failed to send message');
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const toggleRecording = () => {
    setIsRecording((prev) => !prev);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (activeTrigger === 'image' && imageMode === 'stylized') {
      if (files.length > 1) {
        toast.error(language === 'ar' ? 'يمكنك رفع صورة واحدة فقط' : 'You can only upload one image');
        return;
      }
    }
    setAttachedImages(files);
  };

  const handleRemoveAttachedImage = (index: number) => {
    const newImages = [...attachedImages];
    newImages.splice(index, 1);
    setAttachedImages(newImages);
  };

  const handleDownloadImage = (imageUrl: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = 'image.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPlaceholderText = () => {
    if (activeTrigger === 'image') {
      switch (imageMode) {
        case 'photomaker':
          return language === 'ar' ? 'اكتب وصف الصورة الشخصية المطلوبة...' : 'Describe the personal image you want...';
        case 'upscaling':
          return language === 'ar' ? 'رفع الصورة سيتم تحسينها تلقائياً...' : 'Upload an image to enhance automatically...';
        case 'stylized':
          return language === 'ar' ? 'اكتب النمط المطلوب (مثل: شخصية ديزني، أنمي، قصة مصورة)...' : 'Write desired style (e.g., Disney character, anime, comic book)...';
        default:
          return language === 'ar' ? 'اكتب وصف الصورة المطلوبة...' : 'Describe the image you want...';
      }
    }
    return language === 'ar' ? 'اكتب رسالتك هنا...' : 'Type your message here...';
  };

  return (
    <div className="h-screen bg-gradient-to-br from-background via-background to-muted/30 flex flex-col">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="flex items-center justify-between p-4">
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            className="lg:hidden"
            onClick={() => setConversationsPanelOpen((open) => !open)}
          >
            <Menu className="w-5 h-5" />
          </Button>

          {/* Logo and Title */}
          <div className="flex items-center gap-2">
            <ImageIcon className="w-6 h-6" />
            <h1 className="text-lg font-semibold">Wakti AI V2</h1>
          </div>
          
          {/* Mode Indicators */}
          <div className="flex items-center gap-2">
            {activeTrigger === 'search' && (
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <Search className="w-3 h-3 mr-1" />
                {language === 'ar' ? 'وضع البحث' : 'Search Mode'}
              </Badge>
            )}
            {activeTrigger === 'advanced_search' && (
              <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                <Zap className="w-3 h-3 mr-1" />
                {language === 'ar' ? 'بحث متقدم' : 'Advanced Search'}
              </Badge>
            )}
            {activeTrigger === 'image' && (
              <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                {imageMode === 'photomaker' && <Users className="w-3 h-3 mr-1" />}
                {imageMode === 'upscaling' && <TrendingUp className="w-3 h-3 mr-1" />}
                {imageMode === 'stylized' && <Palette className="w-3 h-3 mr-1" />}
                {imageMode === 'regular' && <ImageIcon className="w-3 h-3 mr-1" />}
                {imageMode === 'photomaker' && (language === 'ar' ? 'صانع الصور الشخصية' : 'PhotoMaker')}
                {imageMode === 'upscaling' && (language === 'ar' ? 'تحسين الصور' : 'Upscaling')}
                {imageMode === 'stylized' && (language === 'ar' ? 'فن مخصص' : 'Stylized Art')}
                {imageMode === 'regular' && (language === 'ar' ? 'إنشاء صور' : 'Image Gen')}
              </Badge>
            )}
          </div>

          {/* Header Controls */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/account')}>
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/logout')}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Main Chat Panel */}
          <ResizablePanel defaultSize={conversationsPanelOpen || quickActionsPanelOpen ? 65 : 85} minSize={50}>
            <div className="h-full flex flex-col">
              {/* Messages Area */}
              <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                <div className="space-y-6 max-w-4xl mx-auto">
                  {chatHistory.map((message) => (
                    <ChatBubble
                      key={message.id}
                      message={message}
                      onSearchConfirm={handleSearchConfirmation}
                      activeTrigger={activeTrigger}
                      imageMode={imageMode}
                    />
                  ))}
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="border-t p-4 bg-background/95 backdrop-blur">
                <div className="max-w-4xl mx-auto space-y-3">
                  {/* Image Upload Section */}
                  {activeTrigger === 'image' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">
                          {imageMode === 'stylized' 
                            ? (language === 'ar' ? 'رفع الصورة (1 فقط)' : 'Upload Image (1 only)')
                            : (language === 'ar' ? 'رفع الصور' : 'Upload Images')
                          }
                        </label>
                        <span className="text-xs text-muted-foreground">
                          {imageMode === 'photomaker' && (language === 'ar' ? '1-4 صور' : '1-4 images')}
                          {imageMode === 'upscaling' && (language === 'ar' ? 'صورة واحدة' : '1 image')}
                          {imageMode === 'stylized' && (language === 'ar' ? 'صورة واحدة' : '1 image')}
                          {imageMode === 'regular' && (language === 'ar' ? 'اختياري' : 'Optional')}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="file"
                          id="image-upload"
                          multiple={imageMode !== 'stylized'}
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                        <Button variant="outline" size="sm" asChild>
                          <label htmlFor="image-upload" className="cursor-pointer">
                            {language === 'ar' ? 'تحميل' : 'Upload'}
                            <Upload className="w-4 h-4 ml-2" />
                          </label>
                        </Button>
                        {attachedImages.length > 0 && (
                          <div className="flex items-center space-x-1">
                            {attachedImages.map((image, index) => (
                              <div key={index} className="relative">
                                <img
                                  src={URL.createObjectURL(image)}
                                  alt={image.name}
                                  className="w-12 h-12 rounded-md object-cover"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="absolute -top-2 -right-2 bg-background hover:bg-muted"
                                  onClick={() => handleRemoveAttachedImage(index)}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Message Input */}
                  <div className="flex gap-3 items-end">
                    <div className="flex-1 relative">
                      <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={getPlaceholderText()}
                        onKeyDown={handleKeyDown}
                        className="min-h-[44px] max-h-32 resize-none pr-12"
                        disabled={isLoading}
                      />
                      
                      {/* Voice Input Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-2 h-8 w-8 p-0"
                        onClick={toggleRecording}
                        disabled={isLoading}
                      >
                        <Mic className={cn("h-4 w-4", isRecording && "text-red-500")} />
                      </Button>
                    </div>

                    {/* Send Button */}
                    <Button 
                      onClick={() => handleSendMessage()}
                      disabled={isLoading}
                      className="h-11 px-4"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </ResizablePanel>

          {/* Resizable Handle */}
          {(conversationsPanelOpen || quickActionsPanelOpen) && (
            <ResizableHandle withHandle />
          )}

          {/* Right Panels */}
          {(conversationsPanelOpen || quickActionsPanelOpen) && (
            <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
              {conversationsPanelOpen ? (
                <ConversationsPanel
                  conversations={conversations}
                  selectedConversation={selectedConversation}
                  onSelectConversation={handleSelectConversation}
                  onNewConversation={handleNewConversation}
                  onDeleteConversation={handleDeleteConversation}
                  setConversationsPanelOpen={setConversationsPanelOpen}
                />
              ) : (
                <QuickActionsPanel
                  onSendMessage={handleSendMessage}
                  activeTrigger={activeTrigger}
                  onTriggerChange={handleTriggerChange}
                  imageMode={imageMode}
                  onImageModeChange={handleImageModeChange}
                />
              )}
            </ResizablePanel>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
