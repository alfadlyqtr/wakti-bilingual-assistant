
import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { ChatBubble } from '@/components/wakti-ai-v2/ChatBubble';
import { ChatInput } from '@/components/wakti-ai-v2/ChatInput';
import { AIMessage, WaktiAIV2Service } from '@/services/WaktiAIV2Service';
import { useToastHelper } from "@/hooks/use-toast-helper";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { CalendarIcon, ImageIcon, MessageSquareIcon, SearchIcon, Settings, SparklesIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from '@/components/ui/button';
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function WaktiAIV2() {
  const { theme, language } = useTheme();
  const { showSuccess, showError } = useToastHelper();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [calendarContext, setCalendarContext] = useState<any>(null);
  const [userContext, setUserContext] = useState<any>(null);
  const [enableAdvancedIntegration, setEnableAdvancedIntegration] = useState(true);
  const [enablePredictiveInsights, setEnablePredictiveInsights] = useState(true);
  const [enableWorkflowAutomation, setEnableWorkflowAutomation] = useState(true);
  const [activeTrigger, setActiveTrigger] = useState<string>('chat');

  useEffect(() => {
    loadChatSession();
    loadUserProfile();
    loadCalendarContext();
    loadUserContext();
  }, []);

  const loadChatSession = () => {
    const session = WaktiAIV2Service.loadChatSession();
    if (session) {
      setMessages(session.messages);
      setCurrentConversationId(session.conversationId);
    }
  };

  const loadUserProfile = async () => {
    try {
      const profile = await WaktiAIV2Service.getUserProfile();
      setUserProfile(profile);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadCalendarContext = async () => {
    try {
      const context = await WaktiAIV2Service.getCalendarContext();
      setCalendarContext(context);
    } catch (error) {
      console.error('Error loading calendar context:', error);
    }
  };

  const loadUserContext = async () => {
    try {
      const context = await WaktiAIV2Service.getUserContext();
      setUserContext(context);
    } catch (error) {
      console.error('Error loading user context:', error);
    }
  };

  const handleSendMessage = async (content: string, attachedFiles: any[] = []) => {
    if (!content.trim() && attachedFiles.length === 0) return;

    const userMessage: AIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
      inputType: 'text',
      attachedFiles
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const response = await WaktiAIV2Service.sendMessage(
        content,
        language,
        currentConversationId,
        'text',
        updatedMessages,
        attachedFiles,
        calendarContext,
        userContext,
        enableAdvancedIntegration,
        enablePredictiveInsights,
        enableWorkflowAutomation,
        activeTrigger
      );

      if (response) {
        const assistantMessage: AIMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.response,
          timestamp: new Date(),
          intent: response.intent,
          confidence: response.confidence,
          actionTaken: response.actionTaken,
          actionResult: response.actionResult,
          imageUrl: response.imageUrl,
          browsingUsed: response.browsingUsed,
          browsingData: response.browsingData,
          quotaStatus: response.quotaStatus,
          requiresSearchConfirmation: response.requiresSearchConfirmation,
          needsConfirmation: response.needsConfirmation,
          needsClarification: response.needsClarification,
          pendingTaskData: response.pendingTaskData,
          pendingReminderData: response.pendingReminderData,
          isTextGenerated: response.isTextGenerated || false
        };

        const finalMessages = [...updatedMessages, assistantMessage];
        setMessages(finalMessages);

        if (response.conversationId && response.conversationId !== currentConversationId) {
          setCurrentConversationId(response.conversationId);
        }

        WaktiAIV2Service.saveChatSession(finalMessages, response.conversationId || currentConversationId);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      showError(language === 'ar' ? 'فشل في إرسال الرسالة' : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerChange = (newTrigger: string) => {
    setActiveTrigger(newTrigger);
  };

  return (
    <div className="container relative min-h-screen flex flex-col">
      <header className="sticky top-0 border-b bg-background z-50">
        <div className="container flex h-16 items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <Avatar>
              <AvatarImage src="https://avatars.githubusercontent.com/u/88898944?v=4" alt="@shadcn" />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <h1 className="font-semibold">Wakti AI V2</h1>
              <p className="text-sm text-muted-foreground">
                {language === 'ar' ? 'مساعدك الشخصي الذكي' : 'Your smart personal assistant'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <Settings className="h-4 w-4" />
                  <span className="sr-only">Open settings</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[260px]">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  Billing
                </DropdownMenuItem>
                <DropdownMenuItem>
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Appearance</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={theme === "light"}
                  onCheckedChange={() => console.log("toggle light")}
                >
                  Light
                  <DropdownMenuShortcut>⌘⇧L</DropdownMenuShortcut>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={theme === "dark"}
                  onCheckedChange={() => console.log("toggle dark")}
                >
                  Dark
                  <DropdownMenuShortcut>⌘⇧D</DropdownMenuShortcut>
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Triggers</DropdownMenuLabel>
                <div className="p-2 space-y-1">
                  <Button
                    variant={activeTrigger === 'chat' ? 'secondary' : 'outline'}
                    className="w-full justify-start"
                    onClick={() => handleTriggerChange('chat')}
                  >
                    <MessageSquareIcon className="mr-2 h-4 w-4" />
                    Chat
                  </Button>
                  <Button
                    variant={activeTrigger === 'search' ? 'secondary' : 'outline'}
                    className="w-full justify-start"
                    onClick={() => handleTriggerChange('search')}
                  >
                    <SearchIcon className="mr-2 h-4 w-4" />
                    Search
                  </Button>
                  <Button
                    variant={activeTrigger === 'image' ? 'secondary' : 'outline'}
                    className="w-full justify-start"
                    onClick={() => handleTriggerChange('image')}
                  >
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Image
                  </Button>
                  <Button
                    variant={activeTrigger === 'advanced_search' ? 'secondary' : 'outline'}
                    className="w-full justify-start"
                    onClick={() => handleTriggerChange('advanced_search')}
                    disabled
                  >
                    <SparklesIcon className="mr-2 h-4 w-4" />
                    Advanced Search
                  </Button>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  Log out
                  <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="flex flex-col py-8">
          {messages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message}
              activeTrigger={activeTrigger}
              userProfile={userProfile}
            />
          ))}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageSquareIcon className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div className="max-w-[80%]">
                <div className="rounded-2xl px-4 py-3 bg-muted">
                  <Skeleton className="h-[20px] w-[200px]" />
                  <Skeleton className="h-[20px] w-[150px] mt-2" />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="sticky bottom-0 border-t bg-background z-50">
        <div className="container py-4">
          <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} activeTrigger={activeTrigger} onTriggerChange={handleTriggerChange} />
        </div>
      </div>
    </div>
  );
}
