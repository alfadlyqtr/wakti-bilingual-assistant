

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { QuotaIndicator } from '@/components/wakti-ai-v2/QuotaIndicator';
import { ChatBubble } from '@/components/wakti-ai-v2/ChatBubble';
import { ConversationsList } from '@/components/wakti-ai-v2/ConversationsList';
import { QuickActionsPanel } from '@/components/wakti-ai-v2/QuickActionsPanel';
import { TypingIndicator } from '@/components/wakti-ai-v2/TypingIndicator';
import {
  Menu,
  Plus,
  MoreVertical,
  Share2,
  MessageSquare,
  Settings,
  MessageCircle,
  Search,
  ImageIcon,
  Zap,
  Send,
  Mic,
  Camera
} from "lucide-react";
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { WaktiAIV2Service, AIMessage } from '@/services/WaktiAIV2Service';

export default function WaktiAIV2() {
  const { theme, language } = useTheme();
  const { toast } = useToast();
  const { user } = useAuth();
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeTrigger, setActiveTrigger] = useState<'chat' | 'search' | 'image' | 'advanced_search'>('chat');
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Adjust textarea height on input change
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputMessage]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const newMessage: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
      inputType: 'text'
    };

    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await WaktiAIV2Service.sendMessageWithTrigger(inputMessage, activeConversationId, language, 'text', activeTrigger);

      if (response.response) {
        const aiMessage: AIMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: response.response,
          timestamp: new Date(),
          intent: response.intent,
          confidence: response.confidence,
          imageUrl: response.imageUrl,
          browsingUsed: response.browsingUsed,
          browsingData: response.browsingData,
          quotaStatus: response.quotaStatus,
          inputType: 'text'
        };

        setMessages(prev => [...prev, aiMessage]);
        setActiveConversationId(response.conversationId);
      } else {
        toast({
          title: language === 'ar' ? 'خطأ' : 'Error',
          description: language === 'ar' ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في إرسال الرسالة' : 'Failed to send message',
        variant: 'destructive'
      });
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

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    // Load conversation messages here
  };

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
  };

  const handleSearchConfirm = async (messageContent: string) => {
    setIsLoading(true);
    try {
      const response = await WaktiAIV2Service.sendMessageWithSearchConfirmation(messageContent, activeConversationId, language, 'text');

      if (response.response) {
        const aiMessage: AIMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: response.response,
          timestamp: new Date(),
          intent: response.intent,
          confidence: response.confidence,
          imageUrl: response.imageUrl,
          browsingUsed: response.browsingUsed,
          browsingData: response.browsingData,
          quotaStatus: response.quotaStatus,
          inputType: 'text'
        };

        setMessages(prev => [...prev, aiMessage]);
        setActiveConversationId(response.conversationId);
      } else {
        toast({
          title: language === 'ar' ? 'خطأ' : 'Error',
          description: language === 'ar' ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error("Error confirming search:", error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في تأكيد البحث' : 'Failed to confirm search',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchToChat = () => {
    setActiveTrigger('chat');
  };

  const startRecording = () => {
    setIsRecording(true);
    // Implement voice recording logic here
  };

  const stopRecording = () => {
    setIsRecording(false);
    // Implement voice recording stop logic here
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {/* Left side */}
        <div className="flex items-center gap-3">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold">WAKTI AI</h2>
              </div>
              <div className="p-4 space-y-4">
                {/* Conversations */}
                <ConversationsList
                  conversations={conversations}
                  currentConversationId={activeConversationId}
                  onSelectConversation={handleSelectConversation}
                  onDeleteConversation={() => {}}
                  onRefresh={() => {}}
                />
                
                {/* Quick Actions Panel - Only show in Chat mode */}
                {activeTrigger === 'chat' && (
                  <QuickActionsPanel
                    onSendMessage={(message: string) => {
                      setInputMessage(message);
                      setTimeout(() => {
                        handleSendMessage();
                      }, 100);
                    }}
                    activeTrigger={activeTrigger}
                    onTriggerChange={setActiveTrigger}
                  />
                )}
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-primary-foreground text-sm font-bold">W</span>
            </div>
            <h1 className="text-xl font-bold">WAKTI AI</h1>
          </div>
        </div>

        {/* Center - Mode Tabs */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
          {[
            { id: 'chat', icon: MessageCircle, label: language === 'ar' ? 'محادثة' : 'Chat' },
            { id: 'search', icon: Search, label: language === 'ar' ? 'بحث' : 'Search' },
            { id: 'image', icon: ImageIcon, label: language === 'ar' ? 'صورة' : 'Image' },
            { id: 'advanced_search', icon: Zap, label: language === 'ar' ? 'متقدم' : 'Advanced' }
          ].map((mode) => {
            const Icon = mode.icon;
            return (
              <Button
                key={mode.id}
                variant={activeTrigger === mode.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTrigger(mode.id as any)}
                className="gap-2 px-3 py-1.5"
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs">{mode.label}</span>
              </Button>
            );
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Only show quota indicator in Search mode */}
          {activeTrigger === 'search' && <QuotaIndicator />}
          
          <Button variant="ghost" size="icon" className="rounded-full">
            <Plus className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full">
            <MoreVertical className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Share2 className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full">
            <MessageSquare className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full" asChild>
            <Link to="/settings">
              <Settings className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4 max-w-md">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <MessageCircle className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">
                  {language === 'ar' ? 'مرحباً بك في WAKTI AI' : 'Welcome to WAKTI AI'}
                </h3>
                <p className="text-muted-foreground">
                  {language === 'ar' 
                    ? 'اختر وضعاً أعلاه وابدأ المحادثة'
                    : 'Select a mode above and start chatting'
                  }
                </p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <ChatBubble
                  key={message.id}
                  message={message}
                  onSearchConfirm={handleSearchConfirm}
                  onSwitchToChat={handleSwitchToChat}
                  activeTrigger={activeTrigger}
                />
              ))}
              {isLoading && <TypingIndicator />}
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="flex items-end gap-2 max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  language === 'ar' 
                    ? 'اكتب رسالتك أو استخدم الصوت...'
                    : 'Type your message or use voice...'
                }
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-3 pr-24 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[48px] max-h-32"
                rows={1}
                disabled={isLoading}
              />
              
              {/* Voice and Camera controls in input area */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {/* Camera Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  disabled={isLoading}
                >
                  <Camera className="h-4 w-4" />
                </Button>
                
                {/* Voice Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-8 w-8 rounded-full",
                    isRecording && "bg-red-100 text-red-600"
                  )}
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onMouseLeave={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  disabled={isLoading}
                >
                  <Mic className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              size="icon"
              className="h-12 w-12 rounded-full"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

